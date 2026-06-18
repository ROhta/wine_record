import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { ExpressionTaxonomy } from './taxonomy.js';

const SubcategorySchema = z.object({
  name: z.string().min(1),
  selectCount: z.number().int().positive(),
  terms: z.array(z.string().min(1)).min(1),
});

const ColorSchema = z.object({
  appearance: z.array(SubcategorySchema).min(1),
  aroma: z.array(SubcategorySchema).min(1),
  taste: z.array(SubcategorySchema).min(1),
});

const TaxonomySchema = z.object({
  version: z.string().min(1),
  white: ColorSchema,
  red: ColorSchema,
});

/** 任意のオブジェクトを検証して ExpressionTaxonomy にする。不正なら不正フィールド名を列挙して throw。 */
export function parseTaxonomy(raw: unknown): ExpressionTaxonomy {
  const result = TaxonomySchema.safeParse(raw);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((i) => i.path.map(String).join('.'))),
    ].sort();
    throw new Error(`JSA タクソノミーが不正です: ${fields.join(', ')}`);
  }
  return result.data;
}

/** JSON ファイルから JSA タクソノミーを読み込んで検証する。 */
export function loadTaxonomyFromFile(path: string): ExpressionTaxonomy {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  return parseTaxonomy(raw);
}
