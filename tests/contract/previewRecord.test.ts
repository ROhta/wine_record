import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer, type McpServerDeps } from '../../src/server.js';
import { createRecordWine } from '../../src/tools/recordWine.js';
import { createPreviewRecord } from '../../src/tools/previewRecord.js';
import { createGetJsaTaxonomy } from '../../src/tools/getJsaTaxonomy.js';
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

function makeDeps(): { deps: McpServerDeps; upserts: { namespace: Namespace; item: UpsertItem }[] } {
  const upserts: { namespace: Namespace; item: UpsertItem }[] = [];
  const store: VectorStore = {
    upsert: (namespace, item) => {
      upserts.push({ namespace, item });
      return Promise.resolve();
    },
    fetch: () => Promise.resolve([]),
    query: () => Promise.resolve([]),
  };
  const common = { taxonomy: tax, allowedImageBaseUrl: 'https://img.example.com' };
  const recordWine = createRecordWine({
    ...common,
    store,
    generateId: () => 'wine-123',
    now: () => '2026-06-18T00:00:00.000Z',
  });
  const previewRecord = createPreviewRecord(common);
  const getJsaTaxonomy = createGetJsaTaxonomy({ taxonomy: tax });
  return { deps: { recordWine, previewRecord, getJsaTaxonomy }, upserts };
}

async function connectClient(deps: McpServerDeps): Promise<Client> {
  const server = createMcpServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'contract-test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('preview_record 契約', () => {
  it('preview_record がツール一覧に登録されている', async () => {
    const { deps } = makeDeps();
    const client = await connectClient(deps);
    const list = await client.listTools();
    expect(list.tools.map((t) => t.name)).toContain('preview_record');
  });

  it('正規化した「保存される内容」を structuredContent.preview で返し、保存しない', async () => {
    const { deps, upserts } = makeDeps();
    const client = await connectClient(deps);
    const res = await client.callTool({
      name: 'preview_record',
      arguments: { name: 'シャブリ', color: 'white', vintage: 2020, region: { country: 'フランス' } },
    });
    expect(res.isError).toBeFalsy();
    const sc = res.structuredContent as {
      preview: {
        name: string;
        color: string;
        vintage: number | string | null;
        region: { country: string | null };
      };
    };
    expect(sc.preview.name).toBe('シャブリ');
    expect(sc.preview.color).toBe('white');
    expect(sc.preview.vintage).toBe(2020);
    expect(sc.preview.region.country).toBe('フランス');
    expect(upserts).toHaveLength(0); // 読み取り専用＝副作用なし
  });

  it('name/color 欠落はフィールド別エラーを返し、保存しない', async () => {
    const { deps, upserts } = makeDeps();
    const client = await connectClient(deps);
    const res = await client.callTool({ name: 'preview_record', arguments: { vintage: 'NV' } });
    expect(res.isError).toBe(true);
    const sc = res.structuredContent as { errors: { field: string }[] };
    const fields = sc.errors.map((e) => e.field);
    expect(fields).toContain('name');
    expect(fields).toContain('color');
    expect(upserts).toHaveLength(0);
  });
});
