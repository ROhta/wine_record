import { describe, it, expect } from 'vitest';
import { buildOverallText, buildOverallUpsert } from '../../src/storage/recordMapping.js';
import type { WineRecord } from '../../src/domain/wineRecord.js';

const rec: WineRecord = {
  wineId: 'w1',
  name: 'Chablis',
  color: 'white',
  producer: 'Domaine X',
  region: { country: 'France', region: 'Bourgogne', subregion: null, commune: null },
  vintage: 2020,
  importer: null,
  store: null,
  appearanceTerms: ['澄んだ'],
  aromaTerms: ['閉じている'],
  tasteTerms: ['軽い'],
  imageUrl: null,
  recordedAt: '2026-06-18T00:00:00.000Z',
};

describe('buildOverallText', () => {
  it('名前・生産者・産地・全表現を結合し、null/空は除外する', () => {
    const t = buildOverallText(rec);
    expect(t).toContain('Chablis');
    expect(t).toContain('France');
    expect(t).toContain('澄んだ');
    expect(t).toContain('閉じている');
    expect(t).not.toContain('null');
  });
});

describe('buildOverallUpsert', () => {
  it('id/data/metadata を構築し、産地を階層展開する', () => {
    const item = buildOverallUpsert(rec);
    expect(item.id).toBe('w1');
    expect(item.data).toContain('Chablis');
    expect(item.metadata['country']).toBe('France');
    expect(item.metadata['vintage']).toBe(2020);
    expect(item.metadata['color']).toBe('white');
    expect(item.metadata['aromaTerms']).toEqual(['閉じている']);
  });
});
