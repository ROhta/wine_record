import { describe, it, expect } from 'vitest';
import { validateRecordInput } from '../../src/domain/recordInput.js';
import type { ExpressionTaxonomy } from '../../src/domain/taxonomy.js';

/**
 * spec.md「エッジケース」のうち記録フローに関わるもの（部分抽出 / NV / 画像欠落）を
 * validateRecordInput レベルで固定する。vintage/region 単体の正規化は
 * vintage.test.ts / region.test.ts で網羅済みなので、ここでは合成（部分入力）に焦点を当てる。
 */
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
const BASE = 'https://img.example.com';

describe('エッジケース（部分抽出 / NV / 画像欠落）', () => {
  it('部分抽出: name+color のみでも受理し、欠落フィールドは null / 空配列になる', () => {
    const r = validateRecordInput({ name: 'ラベル判読不能ワイン', color: 'red' }, tax, BASE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.producer).toBeNull();
      expect(r.value.region).toEqual({
        country: null,
        region: null,
        subregion: null,
        commune: null,
      });
      expect(r.value.vintage).toBeNull();
      expect(r.value.importer).toBeNull();
      expect(r.value.store).toBeNull();
      expect(r.value.appearanceTerms).toEqual([]);
      expect(r.value.aromaTerms).toEqual([]);
      expect(r.value.tasteTerms).toEqual([]);
      expect(r.value.imageUrl).toBeNull();
    }
  });

  it('部分抽出: 産地が国だけ判明 → 国のみ埋まり残りの階層は null', () => {
    const r = validateRecordInput(
      { name: 'W', color: 'white', region: { country: '日本' } },
      tax,
      BASE,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.region.country).toBe('日本');
      expect(r.value.region.region).toBeNull();
      expect(r.value.region.subregion).toBeNull();
      expect(r.value.region.commune).toBeNull();
    }
  });

  it('NV: vintage="NV" を保持する（"不明"=null と区別する）', () => {
    const r = validateRecordInput({ name: 'W', color: 'white', vintage: 'NV' }, tax, BASE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.vintage).toBe('NV');
  });

  it('vintage 欠落 → null（不明）として受理（"NV" とは別状態）', () => {
    const r = validateRecordInput({ name: 'W', color: 'white' }, tax, BASE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.vintage).toBeNull();
  });

  it('画像欠落: imageUrl 未指定でも記録は成立し、imageUrl は null', () => {
    const r = validateRecordInput({ name: 'W', color: 'white' }, tax, BASE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.imageUrl).toBeNull();
  });

  it('画像欠落: imageUrl=null を明示しても受理する', () => {
    const r = validateRecordInput({ name: 'W', color: 'white', imageUrl: null }, tax, BASE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.imageUrl).toBeNull();
  });
});
