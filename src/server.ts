import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, type Config } from './config.js';
import { loadTaxonomyFromFile } from './domain/taxonomyLoader.js';
import { createVectorStore } from './storage/vectorStore.js';
import { createRecordWine, type RecordWineResult } from './tools/recordWine.js';

/**
 * MCP サーバーの依存。MCP 層は「ツール契約 ⇄ ドメイン結果」の変換だけを担い、
 * 永続化やタクソノミーには直接依存しない（ハンドラ越しに注入）。
 */
export interface McpServerDeps {
  recordWine: (input: unknown) => Promise<RecordWineResult>;
}

/**
 * record_wine の入力スキーマ（構造ゲート）。
 * 業務ルール（語彙照合・年範囲・URL 許可・name/color 必須）は `validateRecordInput` 一本に集約するため、
 * ここは寛容に（全フィールド optional/nullable）保ち、未知キー除去で正当な値が落ちないよう全フィールドを列挙する。
 * 必須・許容値の意図は description でクライアント（LLM）に伝える。
 */
const recordWineInputSchema = {
  name: z.string().optional().describe('ワイン名（必須・非空）'),
  color: z.string().optional().describe('"white" または "red"（必須）'),
  producer: z.string().nullish().describe('生産者（任意）'),
  region: z
    .object({
      country: z.string().nullish(),
      region: z.string().nullish(),
      subregion: z.string().nullish(),
      commune: z.string().nullish(),
    })
    .nullish()
    .describe('産地（国/地方/小地区/村。階層・任意）'),
  vintage: z.union([z.number(), z.string()]).nullish().describe('収穫年 / "NV" / null'),
  importer: z.string().nullish().describe('輸入者（任意）'),
  store: z.string().nullish().describe('購入店（任意）'),
  appearanceTerms: z.array(z.string()).optional().describe('外観の表現（JSA 語彙内のみ）'),
  aromaTerms: z.array(z.string()).optional().describe('香りの表現（JSA 語彙内のみ）'),
  tasteTerms: z.array(z.string()).optional().describe('味わいの表現（JSA 語彙内のみ）'),
  imageUrl: z.string().nullish().describe('ラベル画像 URL（自ストレージの https のみ・任意）'),
};

/**
 * MCP サーバーを生成し、ツールを登録する。
 * 現状は record_wine のみ（get_jsa_taxonomy / get_upload_url は後続フェーズ）。
 */
export function createMcpServer(deps: McpServerDeps): McpServer {
  const server = new McpServer({ name: 'wine-record', version: '0.1.0' });

  server.registerTool(
    'record_wine',
    {
      title: 'ワインを記録する',
      description:
        '確認済みのワイン記録を永続化する。name は必須・非空、color は "white" または "red"、' +
        '各 *Terms は当該 color の JSA 語彙内のみ、imageUrl は自ストレージの https のみ。' +
        '検証に失敗した場合は保存せず、フィールド別エラーを返す。',
      inputSchema: recordWineInputSchema,
    },
    async (args): Promise<CallToolResult> => {
      const result = await deps.recordWine(args);
      if (result.ok) {
        const payload = { wineId: result.wineId, recordedAt: result.recordedAt };
        return {
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          structuredContent: payload,
        };
      }
      // 検証失敗: isError を立て、人間可読の text（field: message）と
      // 機械可読の structuredContent（{ errors }）の両方で「どこがなぜ不正か」を返す。
      // 成功時の structuredContent（{wineId,recordedAt}）と形が混ざらないよう errors のみを載せる。
      return {
        isError: true,
        content: [
          { type: 'text', text: result.errors.map((e) => `${e.field}: ${e.message}`).join('\n') },
        ],
        structuredContent: { errors: result.errors },
      };
    },
  );

  return server;
}

/** Express アプリを生成する。Helmet でセキュアヘッダを既定適用（憲章 Security）。 */
export function createApp(deps: McpServerDeps): express.Express {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Streamable HTTP（ステートレス: リクエストごとに transport / server を生成。依存は共有）
  app.post('/mcp', async (req, res) => {
    const server = createMcpServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}

/** 実依存（Upstash / タクソノミー）を構築して返す。store と taxonomy は一度だけ生成し共有する。 */
function buildDeps(config: Config): McpServerDeps {
  const taxonomyPath = fileURLToPath(new URL('../data/jsa-taxonomy.json', import.meta.url));
  const taxonomy = loadTaxonomyFromFile(taxonomyPath);
  const store = createVectorStore(config);
  const recordWine = createRecordWine({
    taxonomy,
    store,
    allowedImageBaseUrl: config.r2.publicBaseUrl,
    generateId: () => randomUUID(),
    now: () => new Date().toISOString(),
  });
  return { recordWine };
}

/** サーバーを起動する。 */
export function start(): void {
  const config = loadConfig();
  const app = createApp(buildDeps(config));
  app.listen(config.port, () => {
    console.log(`wine-record MCP server listening on :${config.port}`);
  });
}

// 直接実行された場合のみ起動（`tsx watch src/server.ts` / `node dist/server.js`）
if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  start();
}
