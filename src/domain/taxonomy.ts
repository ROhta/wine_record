/**
 * JSA（日本ソムリエ協会）の定義済み表現語彙。
 * 外観 / 香り / 味わいのカテゴリごとにタームを持つ。
 * 供給源は `data/jsa-taxonomy.json`（前提タスク T010 で生成）。
 */
export interface ExpressionTaxonomy {
  appearance: readonly string[];
  aroma: readonly string[];
  taste: readonly string[];
}

/** 表現カテゴリ。`ExpressionTaxonomy` のキーと一致させる。 */
export type ExpressionCategory = keyof ExpressionTaxonomy;
