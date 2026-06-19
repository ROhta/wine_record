/**
 * 産地の階層。判明した範囲のみ埋める（不明な層は null）。
 * 後続の観点別検索では、この階層の「最長共通接頭辞」で産地近接をランクする。
 */
export interface RegionPath {
	country: string | null
	region: string | null
	subregion: string | null
	commune: string | null
}

/** 任意の値を「トリム済み非空文字列、なければ null」に正規化する。 */
export function cleanOptionalString(v: unknown): string | null {
	if (typeof v !== "string") return null
	const t = v.trim()
	return t === "" ? null : t
}

/** 型不定の値を Record として安全に扱う（オブジェクトでなければ空オブジェクト）。 */
export function asRecord(v: unknown): Record<string, unknown> {
	return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {}
}

/** RegionPath を 国→地方→地区→村 の順の非空文字列配列に平坦化する（null/空は除外）。 */
export function regionToParts(region: RegionPath): string[] {
	return [region.country, region.region, region.subregion, region.commune].filter((x): x is string => typeof x === "string" && x !== "")
}

/** 入力（型不定）を RegionPath に正規化する。各層は空・非文字列なら null。 */
export function normalizeRegion(raw: unknown): RegionPath {
	const obj = asRecord(raw)
	return {
		country: cleanOptionalString(obj["country"]),
		region: cleanOptionalString(obj["region"]),
		subregion: cleanOptionalString(obj["subregion"]),
		commune: cleanOptionalString(obj["commune"]),
	}
}
