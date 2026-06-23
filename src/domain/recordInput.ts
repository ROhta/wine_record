import type {ExpressionTaxonomy, ExpressionCategory, WineColor} from "./taxonomy.js"
import {EXPRESSION_CATEGORIES, parseWineColor} from "./taxonomy.js"
import type {RegionPath} from "./region.js"
import type {Vintage} from "./wineRecord.js"
import {normalizeVintage} from "./vintage.js"
import {normalizeRegion, cleanOptionalString, asRecord} from "./region.js"

/** フィールド単位の検証エラー（LLM が修正提示できるよう構造化）。 */
export interface FieldError {
	field: string
	message: string
}

/** 検証・正規化済みの記録（wineId/recordedAt はツール側で付与）。 */
export interface ValidatedRecord {
	name: string
	color: WineColor
	producer: string | null
	region: RegionPath
	vintage: Vintage
	importer: string | null
	store: string | null
	appearanceTerms: string[]
	aromaTerms: string[]
	tasteTerms: string[]
	imageUrl: string | null
}

export type ValidationResult = {ok: true; value: ValidatedRecord} | {ok: false; errors: FieldError[]}

/** ある色・カテゴリで許可される全用語の集合（サブカテゴリ横断）。 */
function collectAllowedTerms(taxonomy: ExpressionTaxonomy, color: WineColor, category: ExpressionCategory): Set<string> {
	const set = new Set<string>()
	for (const sub of taxonomy[color][category]) {
		for (const term of sub.terms) set.add(term)
	}
	return set
}

function asStringArray(v: unknown): string[] {
	if (!Array.isArray(v)) return []
	return v.filter((x): x is string => typeof x === "string")
}

/**
 * imageUrl が許可された自ストレージの https URL かを検証する。
 * 単純な前方一致だと `https://img.example.com.evil.com/x.jpg` を誤許可するため、
 * URL としてパースし「ホスト完全一致」＋「パス境界」で判定する。
 */
function isAllowedImageUrl(rawUrl: string, allowedBaseUrl: string): boolean {
	let url: URL
	let base: URL
	try {
		url = new URL(rawUrl)
		base = new URL(allowedBaseUrl)
	} catch {
		return false
	}
	if (url.protocol !== "https:") return false
	if (url.host !== base.host) return false
	const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`
	const urlPath = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`
	return urlPath.startsWith(basePath)
}

/**
 * record_wine の入力（型不定）を検証・正規化する。
 * 最初のエラーで止めず、全フィールドのエラーを収集して返す（contract 準拠）。
 *
 * @param taxonomy JSA タクソノミー（語彙照合に使用）
 * @param allowedImageBaseUrl 許可するラベル画像 URL の接頭辞（自ストレージの公開ベース URL）
 */
export function validateRecordInput(input: unknown, taxonomy: ExpressionTaxonomy, allowedImageBaseUrl: string): ValidationResult {
	const errors: FieldError[] = []
	const obj = asRecord(input)

	const name = cleanOptionalString(obj["name"])
	if (name === null) errors.push({field: "name", message: "ワイン名は必須です"})

	const color = parseWineColor(obj["color"])
	if (color === null) errors.push({field: "color", message: 'color は "white" または "red" が必須です'})

	let vintage: Vintage = null
	try {
		vintage = normalizeVintage(obj["vintage"])
	} catch (e) {
		errors.push({
			field: "vintage",
			message: e instanceof Error ? e.message : "不正なヴィンテージです",
		})
	}

	const terms: Record<ExpressionCategory, string[]> = {appearance: [], aroma: [], taste: []}
	for (const category of EXPRESSION_CATEGORIES) {
		const field = `${category}Terms` as const
		const arr = asStringArray(obj[field])
		terms[category] = arr
		if (color !== null) {
			const allowed = collectAllowedTerms(taxonomy, color, category)
			const unknownTerms = arr.filter(t => !allowed.has(t))
			if (unknownTerms.length > 0) {
				errors.push({field, message: `JSA 語彙にない表現: ${unknownTerms.join(", ")}`})
			}
		}
	}

	let imageUrl: string | null = null
	const imgRaw = obj["imageUrl"]
	if (imgRaw !== null && imgRaw !== undefined && imgRaw !== "") {
		if (typeof imgRaw === "string" && isAllowedImageUrl(imgRaw, allowedImageBaseUrl)) {
			imageUrl = imgRaw
		} else {
			errors.push({
				field: "imageUrl",
				message: "許可された画像ストレージの https URL のみ指定できます",
			})
		}
	}

	if (errors.length > 0 || name === null || color === null) {
		// name/color が null の場合は必ず errors に入っている
		return {ok: false, errors}
	}

	return {
		ok: true,
		value: {
			name,
			color,
			producer: cleanOptionalString(obj["producer"]),
			region: normalizeRegion(obj["region"]),
			vintage,
			importer: cleanOptionalString(obj["importer"]),
			store: cleanOptionalString(obj["store"]),
			appearanceTerms: terms.appearance,
			aromaTerms: terms.aroma,
			tasteTerms: terms.taste,
			imageUrl,
		},
	}
}
