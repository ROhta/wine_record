/**
 * [SPIKE] T022a: MCP Apps ウィジェット描画検証（捨てコード）
 *
 * 殺したい未知数:
 *   Claude（モバイル/デスクトップ）が MCP Apps の UI リソースを実際に iframe 描画し、
 *   ウィジェット内 JS からのブリッジ（callServerTool / sendMessage）が往復するか。
 *   成立すれば、確認ウィジェット(T022)の「承認ボタンが record_wine を直接呼ぶ」設計が実現可能。
 *
 * 実行（既存トンネルが localhost:3100 を指しているのでポート3100で起動）:
 *   node --env-file=.env --env-file=<dummy-r2-env> spikes/widget-render/server.ts ... ではなく
 *   この spike は env 不要。PORT だけ見る:
 *   PORT=3100 node --import tsx spikes/widget-render/server.ts
 *
 * ローカル確認:
 *   - ヘッドレス JSON-RPC（tools/list に _meta.ui、resources/read に mime=text/html;profile=mcp-app）
 *   - ブラウザ: http://localhost:3100/widget-preview  （ExtApps shim で描画だけ確認）
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';

const require = createRequire(import.meta.url);
const WIDGET_URI = 'ui://widgets/spike.html';

// ext-apps のブラウザ用バンドルを HTML にインライン（CSP で CDN fetch が塞がれるため必須）。
const bundle = readFileSync(
  require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'),
  'utf8',
).replace(/export\{([^}]+)\};?\s*$/, (_m, body: string) => {
  const map = body
    .split(',')
    .map((p) => {
      const [local, exported] = p.split(' as ').map((s) => s.trim());
      return `${exported ?? local}:${local}`;
    })
    .join(',');
  return `globalThis.ExtApps={${map}};`;
});

const widgetPath = fileURLToPath(new URL('./widget.html', import.meta.url));
const widgetHtml = readFileSync(widgetPath, 'utf8').replace(
  '/*__EXT_APPS_BUNDLE__*/',
  () => bundle,
);

function buildServer(): McpServer {
  const server = new McpServer({ name: 'wine-widget-spike', version: '0.0.1' });

  // 1) ウィジェット付きツール: 結果は JSON。_meta.ui.resourceUri で描画する UI を指定。
  registerAppTool(
    server,
    'spike_widget',
    {
      description:
        '【スパイク】MCP Apps ウィジェットの描画検証用。インタラクティブな確認ウィジェットを開く。',
      annotations: { title: 'ウィジェット描画スパイク', readOnlyHint: true },
      inputSchema: { note: z.string().optional().describe('ウィジェットに表示する任意メモ') },
      _meta: { ui: { resourceUri: WIDGET_URI } },
    },
    async ({ note }) => {
      const payload = {
        message: 'hello from wine MCP server',
        note: note ?? '(なし)',
        serverTime: new Date().toISOString(),
      };
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  // 2) UI リソース: HTML を RESOURCE_MIME_TYPE で配信。
  registerAppResource(server, 'Spike Widget', WIDGET_URI, {}, async () => ({
    contents: [{ uri: WIDGET_URI, mimeType: RESOURCE_MIME_TYPE, text: widgetHtml }],
  }));

  // 3) ブリッジ往復確認用: ウィジェットのボタンが callServerTool で呼ぶ（record_wine の代役）。
  //    ウィジェットを持たないプレーンツールなので、通常の registerTool を使う（registerAppTool は _meta.ui 必須）。
  server.registerTool(
    'spike_echo',
    {
      title: 'echo',
      description: '【スパイク】ウィジェットからの callServerTool 往復確認。受け取った text を返す。',
      inputSchema: { text: z.string().describe('エコーするテキスト') },
    },
    async ({ text }) => {
      return {
        content: [
          { type: 'text', text: JSON.stringify({ echoed: text, at: new Date().toISOString() }) },
        ],
      };
    },
  );

  return server;
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', spike: 'widget-render' }));

app.post('/mcp', async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// ローカル確認用: ExtApps を shim してブラウザで描画だけ見る。
// 例: /widget-preview?payload={"message":"hi"}
app.get('/widget-preview', (req, res) => {
  const payload = typeof req.query.payload === 'string' ? req.query.payload : '{"message":"preview"}';
  const shim = `globalThis.ExtApps={applyHostStyleVariables:()=>{},App:class{
    constructor(){this.h={}} ontoolresult; ontoolinput; onhostcontextchanged;
    async connect(){const p=${JSON.stringify(payload)}; this.ontoolresult?.({content:[{type:"text",text:p}]});}
    getHostContext(){return{theme:"light"}}
    sendMessage(m){console.log("sendMessage",m)} updateModelContext(){}
    callServerTool(a){console.log("callServerTool",a);return Promise.resolve({content:[{type:"text",text:JSON.stringify({echoed:a?.arguments?.text,at:"preview"})}]})}
    openLink(){} downloadFile(){}
  }};`;
  res.type('html').send(widgetHtml.replace('/*__EXT_APPS_BUNDLE__*/', () => shim));
});

const port = Number(process.env.PORT ?? 3100);
app.listen(port, () => {
  console.log(`[spike] widget-render MCP server listening on :${port}`);
});
