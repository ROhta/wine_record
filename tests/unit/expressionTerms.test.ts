import { describe, it, expect } from 'vitest';
import { validateRecordInput } from '../../src/domain/recordInput.js';
import type { ExpressionTaxonomy } from '../../src/domain/taxonomy.js';

/**
 * US2 / FR-005・原則I: 表現タグは当該 color の JSA 語彙内の値のみ受理する。
 * 語彙照合は US1 で `validateRecordInput` に実装済み（T028）。本テストはその保証、
 * とくに「color 横断の拒否」（白用語彙と赤用語彙の分離）を固定する。
 */
const tax: ExpressionTaxonomy = {
  version: 't',
  white: {
    appearance: [{ name: '清澄度', selectCount: 1, terms: ['澄んだ'] }],
    aroma: [{ name: '第一印象', selectCount: 1, terms: ['白の香り'] }],
    taste: [{ name: 'アタック', selectCount: 1, terms: ['軽い'] }],
  },
  red: {
    appearance: [{ name: '清澄度', selectCount: 1, terms: ['澄んだ'] }],
    aroma: [{ name: '第一印象', selectCount: 1, terms: ['赤の香り'] }],
    taste: [{ name: 'タンニン分', selectCount: 1, terms: ['緻密'] }],
  },
};
const BASE = 'https://img.example.com';

describe('表現タグの語彙内検証（US2 / FR-005）', () => {
  it('当該 color の語彙内の表現は受理する', () => {
    const r = validateRecordInput(
      { name: 'W', color: 'white', aromaTerms: ['白の香り'], tasteTerms: ['軽い'] },
      tax,
      BASE,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.aromaTerms).toEqual(['白の香り']);
  });

  it('別 color の語彙（赤用「赤の香り」）は white では弾く（color 横断の拒否）', () => {
    const r = validateRecordInput(
      { name: 'W', color: 'white', aromaTerms: ['赤の香り'] },
      tax,
      BASE,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === 'aromaTerms')).toBe(true);
  });

  it('複数カテゴリの語彙内表現をまとめて受理する', () => {
    const r = validateRecordInput(
      {
        name: 'R',
        color: 'red',
        appearanceTerms: ['澄んだ'],
        aromaTerms: ['赤の香り'],
        tasteTerms: ['緻密'],
      },
      tax,
      BASE,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.appearanceTerms).toEqual(['澄んだ']);
      expect(r.value.aromaTerms).toEqual(['赤の香り']);
      expect(r.value.tasteTerms).toEqual(['緻密']);
    }
  });

  it('表現を1つも選ばなくても受理する（表現は任意）', () => {
    const r = validateRecordInput({ name: 'W', color: 'white' }, tax, BASE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.appearanceTerms).toEqual([]);
      expect(r.value.aromaTerms).toEqual([]);
      expect(r.value.tasteTerms).toEqual([]);
    }
  });
});
