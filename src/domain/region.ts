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

/** 入力（型不定）を RegionPath に正規化する。各層は空・非文字列なら null。 */
export function normalizeRegion(raw: unknown): RegionPath {
	const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
	return {
		country: cleanOptionalString(obj["country"]),
		region: cleanOptionalString(obj["region"]),
		subregion: cleanOptionalString(obj["subregion"]),
		commune: cleanOptionalString(obj["commune"]),
	}
}
