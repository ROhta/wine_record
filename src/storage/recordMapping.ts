import type {WineRecord} from "../domain/wineRecord.js"
import {regionToParts} from "../domain/region.js"
import type {Namespace, UpsertItem} from "./vectorStore.js"

/** 観点別 namespace（overall を除く）。 */
type AspectNamespace = Exclude<Namespace, "overall">

/** `overall` namespace 用の結合テキスト（名前+生産者+産地+全表現）。埋め込みモデルでベクトル化される。 */
export function buildOverallText(r: WineRecord): string {
	const parts = [r.name, r.producer, ...regionToParts(r.region), ...r.appearanceTerms, ...r.aromaTerms, ...r.tasteTerms]
	return parts.filter((x): x is string => typeof x === "string" && x.trim() !== "").join(" ")
}

/**
 * WineRecord を `overall` namespace の upsert アイテムに変換する。
 * 産地は階層を平坦化して metadata に持たせる（後続の構造的近接検索の前提）。
 */
export function buildOverallUpsert(r: WineRecord): UpsertItem {
	return {
		id: r.wineId,
		data: buildOverallText(r),
		metadata: {
			name: r.name,
			color: r.color,
			producer: r.producer,
			country: r.region.country,
			region: r.region.region,
			subregion: r.region.subregion,
			commune: r.region.commune,
			vintage: r.vintage,
			importer: r.importer,
			store: r.store,
			appearanceTerms: r.appearanceTerms,
			aromaTerms: r.aromaTerms,
			tasteTerms: r.tasteTerms,
			imageUrl: r.imageUrl,
			recordedAt: r.recordedAt,
		},
	}
}

/** 観点別 namespace の一覧。各 namespace `X` は記録の `${X}Terms` フィールドを格納する。 */
const ASPECT_NAMESPACES = ["appearance", "aroma", "taste"] as const satisfies readonly AspectNamespace[]

/**
 * 観点別 namespace（appearance/aroma/taste）の upsert アイテムを構築する。
 * 各アイテムの id は wineId、metadata は `{ wineId }` のみ（観点別は検索時に `overall` から
 * `fetch(ids)` でハイドレートする前提・原則 IV）。data は選択タームの結合テキスト。
 * 表現が空のカテゴリはスキップする（空テキストの埋め込みを避ける）。
 */
export function buildAspectUpserts(r: WineRecord): {namespace: AspectNamespace; item: UpsertItem}[] {
	const items: {namespace: AspectNamespace; item: UpsertItem}[] = []
	for (const namespace of ASPECT_NAMESPACES) {
		const terms = r[`${namespace}Terms`]
		if (terms.length === 0) continue
		items.push({
			namespace,
			item: {id: r.wineId, data: terms.join(" "), metadata: {wineId: r.wineId}},
		})
	}
	return items
}
