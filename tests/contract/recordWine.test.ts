import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer, type McpServerDeps } from '../../src/server.js';
import { createRecordWine } from '../../src/tools/recordWine.js';
import { createPreviewRecord } from '../../src/tools/previewRecord.js';
import type { VectorStore, Namespace, UpsertItem } from '../../src/storage/vectorStore.js';
import type { ExpressionTaxonomy } from '../../src/domain/taxonomy.js';

const tax: ExpressionTaxonomy = {
  version: 't',
  white: {
    appearance: [{ name: '清澄度', selectCount: 1, terms: ['澄んだ'] }],
    aroma: [{ name: '第一印象', selectCount: 1, terms: ['閉じている'] }],
    taste: [{ name: 'アタック', selectCount: 1, terms: ['軽い'] }],
  },
  red: {
    appearance: [{ name: '清澄度', selectCount: 1, terms: ['澄んだ'] }],
    aroma: [{ name: '第一印象', selectCount: 1, terms: ['閉じている'] }],
    taste: [{ name: 'タンニン分', selectCount: 1, terms: ['緻密'] }],
  },
};

/** record_wine の実ハンドラ（fake store）を組み込んだ McpServerDeps を作る。 */
function makeServerDeps(): {
  deps: McpServerDeps;
  upserts: { namespace: Namespace; item: UpsertItem }[];
} {
  const upserts: { namespace: Namespace; item: UpsertItem }[] = [];
  const store: VectorStore = {
    upsert: (namespace, item) => {
      upserts.push({ namespace, item });
      return Promise.resolve();
    },
    fetch: () => Promise.resolve([]),
    query: () => Promise.resolve([]),
  };
  const recordWine = createRecordWine({
    taxonomy: tax,
    store,
    allowedImageBaseUrl: 'https://img.example.com',
    generateId: () => 'wine-123',
    now: () => '2026-06-18T00:00:00.000Z',
  });
  const previewRecord = createPreviewRecord({ taxonomy: tax, allowedImageBaseUrl: 'https://img.example.com' });
  return { deps: { recordWine, previewRecord }, upserts };
}

/** Client と McpServer を InMemoryTransport で結線し、接続済み Client を返す。 */
async function connectClient(deps: McpServerDeps): Promise<Client> {
  const server = createMcpServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'contract-test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

/** content 配列から最初の text を取り出す。 */
function firstText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const first = content[0] as { type?: string; text?: string } | undefined;
  return first?.type === 'text' ? (first.text ?? '') : '';
}

const validArgs = {
  name: 'Chablis',
  color: 'white',
  vintage: '2020',
  appearanceTerms: ['澄んだ'],
  aromaTerms: ['閉じている'],
  tasteTerms: ['軽い'],
};

describe('record_wine 契約（MCP プロトコル経由）', () => {
  it('tools/list に record_wine が入力スキーマ付きで現れる', async () => {
    const { deps } = makeServerDeps();
    const client = await connectClient(deps);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'record_wine');
    expect(tool).toBeDefined();
    expect(tool?.inputSchema).toBeDefined();
    await client.close();
  });

  it('妥当な入力 → wineId/recordedAt を structuredContent で返し overall に upsert する', async () => {
    const { deps, upserts } = makeServerDeps();
    const client = await connectClient(deps);
    const res = await client.callTool({ name: 'record_wine', arguments: validArgs });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({
      wineId: 'wine-123',
      recordedAt: '2026-06-18T00:00:00.000Z',
    });
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.namespace).toBe('overall');
    expect(upserts[0]?.item.id).toBe('wine-123');
    await client.close();
  });

  it('不正な入力（name 欠落）→ isError かつ構造化された name エラーを返し、永続化しない（SC-005）', async () => {
    const { deps, upserts } = makeServerDeps();
    const client = await connectClient(deps);
    const res = await client.callTool({ name: 'record_wine', arguments: { color: 'white' } });
    expect(res.isError).toBe(true);
    expect(firstText(res.content)).toContain('name');
    expect(upserts).toHaveLength(0);
    await client.close();
  });
});
