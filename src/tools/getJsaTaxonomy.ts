import type {ColorTaxonomy, ExpressionCategory, ExpressionTaxonomy, WineColor} from "../domain/taxonomy.js"
import {EXPRESSION_CATEGORIES, parseWineColor} from "../domain/taxonomy.js"
import {asRecord} from "../domain/region.js"
import type {FieldError} from "../domain/recordInput.js"

/** get_jsa_taxonomy の依存。 */
export interface GetJsaTaxonomyDeps {
	taxonomy: ExpressionTaxonomy
}

/**
 * 1 色分の語彙ビュー。`category` 指定時は該当カテゴリのみキーが存在する。
 * サブカテゴリ（清澄度・色調…）を `selectCount`（参考情報）付きでそのまま返す。
 */
export interface TaxonomyView {
	color: WineColor
	version: string
	appearance?: ColorTaxonomy["appearance"]
	aroma?: ColorTaxonomy["aroma"]
	taste?: ColorTaxonomy["taste"]
}

export type GetJsaTaxonomyResult = {ok: true; value: TaxonomyView} | {ok: false; errors: FieldError[]}

function parseCategory(raw: unknown): {ok: true; value: ExpressionCategory | null} | {ok: false} {
	if (raw === undefined || raw === null) return {ok: true, value: null}
	const match = EXPRESSION_CATEGORIES.find(c => c === raw)
	return match !== undefined ? {ok: true, value: match} : {ok: false}
}

/**
 * get_jsa_taxonomy ツールのハンドラを生成する。
 * `color`（必須）で白用/赤用の語彙セットを選び、`category` 指定時はそのカテゴリのみ返す。
 * 読み取り専用（副作用なし）。検証は語彙の所属のみで、`selectCount` は強制しない。
 */
export function createGetJsaTaxonomy(deps: GetJsaTaxonomyDeps) {
	return function getJsaTaxonomy(input: unknown): GetJsaTaxonomyResult {
		const obj = asRecord(input)

		const color = parseWineColor(obj["color"])
		if (color === null) {
			return {
				ok: false,
				errors: [{field: "color", message: 'color は "white" または "red" が必須です'}],
			}
		}

		const category = parseCategory(obj["category"])
		if (!category.ok) {
			return {
				ok: false,
				errors: [{field: "category", message: "category は appearance / aroma / taste のいずれかです"}],
			}
		}

		const colorTaxonomy = deps.taxonomy[color]
		const value: TaxonomyView = {color, version: deps.taxonomy.version}
		for (const c of EXPRESSION_CATEGORIES) {
			if (category.value === null || category.value === c) value[c] = colorTaxonomy[c]
		}
		return {ok: true, value}
	}
}
