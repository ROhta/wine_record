import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTaxonomy, loadTaxonomyFromFile } from '../../src/domain/taxonomyLoader.js';

const minValid = {
  version: '2020.01.11',
  white: {
    appearance: [{ name: '清澄度', selectCount: 1, terms: ['澄んだ'] }],
    aroma: [{ name: '第一印象', selectCount: 2, terms: ['閉じている'] }],
    taste: [{ name: 'アタック', selectCount: 1, terms: ['軽い'] }],
  },
  red: {
    appearance: [{ name: '清澄度', selectCount: 1, terms: ['澄んだ'] }],
    aroma: [{ name: '第一印象', selectCount: 2, terms: ['閉じている'] }],
    taste: [{ name: 'アタック', selectCount: 1, terms: ['軽い'] }],
  },
};

describe('parseTaxonomy', () => {
  it('正しい構造を受理する', () => {
    const t = parseTaxonomy(minValid);
    expect(t.white.appearance[0]?.name).toBe('清澄度');
    expect(t.red.taste[0]?.terms[0]).toBe('軽い');
  });

  it('terms が空のサブカテゴリは不正として throw する', () => {
    const bad = {
      ...minValid,
      white: { ...minValid.white, appearance: [{ name: '清澄度', selectCount: 1, terms: [] }] },
    };
    expect(() => parseTaxonomy(bad)).toThrowError(/white\.appearance/);
  });
});

describe('loadTaxonomyFromFile（実データ検証）', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, '../../data/jsa-taxonomy.json');

  it('data/jsa-taxonomy.json を読み込み・検証し、転記内容が正しい', () => {
    const t = loadTaxonomyFromFile(path);
    expect(t.version).toBe('2020.01.11');
    // 白: 色調=7語 / 赤: 色調=10語
    expect(t.white.appearance.find((s) => s.name === '色調')?.terms.length).toBe(7);
    expect(t.red.appearance.find((s) => s.name === '色調')?.terms.length).toBe(10);
    // 赤の香り「特徴（果実・花・植物）」=28語
    expect(t.red.aroma.find((s) => s.name === '特徴（果実・花・植物）')?.terms.length).toBe(28);
    // 白は「苦味」、赤は「タンニン分」を持つ
    expect(t.white.taste.some((s) => s.name === '苦味')).toBe(true);
    expect(t.red.taste.some((s) => s.name === 'タンニン分')).toBe(true);
  });
});
