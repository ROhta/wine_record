import {EXPRESSION_CATEGORIES, parseWineColor, type ExpressionCategory, type WineColor} from "../domain/taxonomy.js"
import {asRecord, cleanOptionalString, normalizeRegion, regionToParts, type RegionPath} from "../domain/region.js"
import {normalizeVintage} from "../domain/vintage.js"
import type {Vintage} from "../domain/wineRecord.js"
import type {FieldError} from "../domain/recordInput.js"

/** 観点ごとの重み（解決済み・未指定は 1）。 */
export type AspectWeights = Record<ExpressionCategory, number>

/** 検証・正規化済みの検索クエリ。 */
export interface SearchQuery {
	/** 観点別の表現（自然文・未指定は null）。 */
	appearance: string | null
	aroma: string | null
	taste: string | null
	/** 構造的絞り込み（各層は不明なら null）。 */
	region: RegionPath
	vintage: Vintage
	color: WineColor | null
	/** 観点重み（> 0・未指定は 1）。 */
	weights: AspectWeights
	/** 返却件数上限（≥ 1・未指定は既定 10）。 */
	limit: number
}

export type SearchQueryResult = {ok: true; value: SearchQuery} | {ok: false; errors: FieldError[]}

/** 既定の返却件数（FR-008）。 */
const DEFAULT_LIMIT = 10

/** 観点表現が指定されているか（FR-012 判定にも使う）。 */
export function hasAspectPhrases(q: SearchQuery): boolean {
	return EXPRESSION_CATEGORIES.some(c => q[c] !== null)
}

/** 構造条件が指定されているか。 */
export function hasStructuralFilter(q: SearchQuery): boolean {
	return regionToParts(q.region).length > 0 || q.vintage !== null || q.color !== null
}

/** weights を解決する。未指定の観点は 1。各重みは `> 0` の有限数として検証し、満たさなければ errors に積む。 */
function resolveWeights(raw: unknown, errors: FieldError[]): AspectWeights {
	const obj = asRecord(raw)
	const weights: AspectWeights = {appearance: 1, aroma: 1, taste: 1}
	for (const c of EXPRESSION_CATEGORIES) {
		const v = obj[c]
		if (v === undefined || v === null) continue
		if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
			errors.push({field: "weights", message: `${c} の重みは 0 より大きい有限数である必要があります`})
			continue
		}
		weights[c] = v
	}
	return weights
}

/** 構造条件の color を解釈する。未指定は null、指定が white/red 以外はエラー。 */
function resolveColor(raw: unknown, errors: FieldError[]): WineColor | null {
	if (raw === undefined || raw === null || raw === "") return null
	const color = parseWineColor(raw)
	if (color === null) errors.push({field: "color", message: 'color は "white" または "red" を指定してください'})
	return color
}

function resolveLimit(raw: unknown, errors: FieldError[]): number {
	if (raw === undefined || raw === null) return DEFAULT_LIMIT
	if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
		errors.push({field: "limit", message: "limit は 1 以上の整数である必要があります"})
		return DEFAULT_LIMIT
	}
	return raw
}

/**
 * 検索クエリ（型不定）を検証・正規化する。
 * 観点表現（appearance/aroma/taste）または構造条件（region/vintage/color）の**最低ひとつ**が必須（FR-009）。
 * 全フィールドのエラーを収集して返す。構造条件の正規化・型は 001 ドメインを再利用する。
 */
export function validateSearchQuery(input: unknown): SearchQueryResult {
	const errors: FieldError[] = []
	const obj = asRecord(input)

	const appearance = cleanOptionalString(obj["appearance"])
	const aroma = cleanOptionalString(obj["aroma"])
	const taste = cleanOptionalString(obj["taste"])

	const region = normalizeRegion(obj["region"])

	let vintage: Vintage = null
	try {
		vintage = normalizeVintage(obj["vintage"])
	} catch (e) {
		errors.push({field: "vintage", message: e instanceof Error ? e.message : "不正なヴィンテージです"})
	}

	const color = resolveColor(obj["color"], errors)
	const weights = resolveWeights(obj["weights"], errors)
	const limit = resolveLimit(obj["limit"], errors)

	const hasAspect = appearance !== null || aroma !== null || taste !== null
	const hasStructural = regionToParts(region).length > 0 || vintage !== null || color !== null
	if (!hasAspect && !hasStructural) {
		errors.push({field: "query", message: "観点表現（外観/香り/味わい）または構造条件（産地/ヴィンテージ/色）を最低ひとつ指定してください"})
	}

	if (errors.length > 0) return {ok: false, errors}

	return {ok: true, value: {appearance, aroma, taste, region, vintage, color, weights, limit}}
}
