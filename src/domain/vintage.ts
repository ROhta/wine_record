import type { Vintage } from './wineRecord.js';

/** 妥当な収穫年の下限。 */
const MIN_VINTAGE_YEAR = 1900;

/** 妥当な収穫年か（整数・1900〜翌年）。 */
function isValidVintageYear(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_VINTAGE_YEAR && n <= new Date().getFullYear() + 1;
}

/**
 * OCR 抽出値やユーザー入力（型不定）を Vintage に正規化する。
 *
 * Vintage = number（収穫年） | "NV"（ノン・ヴィンテージ＝意図的に年が無い） | null（不明）。
 * 「"NV"」と「null」は別状態として区別する。
 *
 * 方針（ユーザー決定）:
 * - null / undefined / 空文字 → null（不明）
 * - "NV"（前後空白・大小文字の揺れ許容） → "NV"
 * - 数字文字列・全角数字（"2020" / "２０２０"）→ number に変換（NFKC 正規化）
 * - 妥当な収穫年は 1900〜翌年。範囲外・解釈不能・不正型は throw（厳格）
 */
export function normalizeVintage(raw: unknown): Vintage {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (isValidVintageYear(raw)) return raw;
    throw new Error(
      `不正なヴィンテージ年です: ${String(raw)}（${String(MIN_VINTAGE_YEAR)}〜翌年）`,
    );
  }

  if (typeof raw === 'string') {
    const s = raw.normalize('NFKC').trim();
    if (s === '') return null;
    if (s.toUpperCase() === 'NV') return 'NV';
    if (/^\d{1,4}$/.test(s)) {
      const n = Number(s);
      if (isValidVintageYear(n)) return n;
      throw new Error(`不正なヴィンテージ年です: ${s}（${String(MIN_VINTAGE_YEAR)}〜翌年）`);
    }
    throw new Error(`ヴィンテージを解釈できません: ${s}`);
  }

  throw new Error('ヴィンテージの型が不正です');
}
