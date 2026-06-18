import express from 'express';
import helmet from 'helmet';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';

/**
 * MCP サーバーを生成する（骨組み）。
 * ツール（record_wine / get_jsa_taxonomy / get_upload_url）の登録は US1 以降で行う。
 */
export function createMcpServer(): McpServer {
  return new McpServer({ name: 'wine-record', version: '0.1.0' });
}

/** Express アプリを生成する。Helmet でセキュアヘッダを既定適用（憲章 Security）。 */
export function createApp(): express.Express {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Streamable HTTP（ステートレス: リクエストごとに transport を生成）
  app.post('/mcp', async (req, res) => {
    const server = createMcpServer();
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

/** サーバーを起動する。 */
export function start(): void {
  const config = loadConfig();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`wine-record MCP server listening on :${config.port}`);
  });
}

// 直接実行された場合のみ起動（`tsx watch src/server.ts` / `node dist/server.js`）
if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  start();
}
