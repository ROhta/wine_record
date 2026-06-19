import { describe, it, expect, vi } from 'vitest';
import { createRecordWine, type RecordWineDeps } from '../../src/tools/recordWine.js';
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

function makeFakeStore(): { store: VectorStore; upserts: { namespace: Namespace; item: UpsertItem }[] } {
  const upserts: { namespace: Namespace; item: UpsertItem }[] = [];
  const store: VectorStore = {
    upsert: (namespace, item) => {
      upserts.push({ namespace, item });
      return Promise.resolve();
    },
    fetch: () => Promise.resolve([]),
    query: () => Promise.resolve([]),
  };
  return { store, upserts };
}

function makeDeps(store: VectorStore): RecordWineDeps {
  return {
    taxonomy: tax,
    store,
    allowedImageBaseUrl: 'https://img.example.com',
    generateId: () => 'wine-123',
    now: () => '2026-06-18T00:00:00.000Z',
  };
}

describe('US2 表現選択の記録反映（観点別 namespace）', () => {
  it('選択した表現が各観点 namespace に id=wineId / metadata={wineId} で upsert される', async () => {
    const { store, upserts } = makeFakeStore();
    const recordWine = createRecordWine(makeDeps(store));
    const r = await recordWine({
      name: 'Chablis',
      color: 'white',
      appearanceTerms: ['澄んだ'],
      aromaTerms: ['閉じている'],
      tasteTerms: ['軽い'],
    });
    expect(r.ok).toBe(true);

    const byNs = (ns: Namespace): typeof upserts => upserts.filter((u) => u.namespace === ns);
    for (const ns of ['appearance', 'aroma', 'taste'] as const) {
      const items = byNs(ns);
      expect(items).toHaveLength(1);
      expect(items[0]?.item.id).toBe('wine-123');
      expect(items[0]?.item.metadata).toEqual({ wineId: 'wine-123' });
      expect(items[0]?.item.data.length).toBeGreaterThan(0);
    }
    // overall（正本）も書かれる
    expect(byNs('overall')).toHaveLength(1);
  });

  it('未選択カテゴリの namespace には書かない（空はスキップ）', async () => {
    const { store, upserts } = makeFakeStore();
    const recordWine = createRecordWine(makeDeps(store));
    const r = await recordWine({ name: 'Chablis', color: 'white', aromaTerms: ['閉じている'] });
    expect(r.ok).toBe(true);

    const namespaces = upserts.map((u) => u.namespace);
    expect(namespaces).toContain('overall');
    expect(namespaces).toContain('aroma');
    expect(namespaces).not.toContain('appearance');
    expect(namespaces).not.toContain('taste');
  });

  it('観点別 upsert が失敗しても overall が成功すれば記録は成立する（ベストエフォート・原則IV）', async () => {
    const written: Namespace[] = [];
    const store: VectorStore = {
      upsert: (namespace) => {
        if (namespace !== 'overall') return Promise.reject(new Error('aspect namespace down'));
        written.push(namespace);
        return Promise.resolve();
      },
      fetch: () => Promise.resolve([]),
      query: () => Promise.resolve([]),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const recordWine = createRecordWine(makeDeps(store));
      const r = await recordWine({ name: 'Chablis', color: 'white', aromaTerms: ['閉じている'] });
      expect(r.ok).toBe(true); // overall が書けたので記録は成立
      expect(written).toEqual(['overall']);
      expect(warn).toHaveBeenCalled(); // 失敗は警告する（silent failure にしない）
    } finally {
      warn.mockRestore();
    }
  });
});
