/**
 * JSA（日本ソムリエ協会）の定義済みテイスティング用語。
 * 「テイスティング用語選択用紙」（白用・赤用）に基づく。
 * 白ワインと赤ワインで項目・用語が異なるため、色ごとに保持する。
 * 供給源は `data/jsa-taxonomy.json`（T010 で PDF から構築）。
 */

/** ワインの色。白用・赤用で用語セットが異なる。 */
export type WineColor = 'white' | 'red';

/** 表現カテゴリ（外観 / 香り / 味わい）。 */
export type ExpressionCategory = 'appearance' | 'aroma' | 'taste';

/**
 * サブカテゴリ（例: 清澄度・色調・第一印象・アタック…）。
 * 用紙のグルーピングを保持し、タップ選択 UI でサブカテゴリ単位に提示する。
 */
export interface ExpressionSubcategory {
  /** サブカテゴリ名（例: 「清澄度」）。 */
  name: string;
  /** 試験での選択用語数（用紙の「(n)」）。参考情報。 */
  selectCount: number;
  /** 選択肢の用語一覧。 */
  terms: readonly string[];
}

/** 1 つの色に対する 外観 / 香り / 味わい のサブカテゴリ集合。 */
export interface ColorTaxonomy {
  appearance: readonly ExpressionSubcategory[];
  aroma: readonly ExpressionSubcategory[];
  taste: readonly ExpressionSubcategory[];
}

/** タクソノミー全体（バージョンと白/赤）。 */
export interface ExpressionTaxonomy {
  /** 用紙の版（例: "2020.01.11"）。 */
  version: string;
  white: ColorTaxonomy;
  red: ColorTaxonomy;
}
