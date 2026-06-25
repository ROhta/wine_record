import {EXPRESSION_CATEGORIES, type ExpressionCategory, type WineColor} from "../domain/taxonomy.js"
import type {RegionPath} from "../domain/region.js"
import type {Vintage} from "../domain/wineRecord.js"
import type {FieldError} from "../domain/recordInput.js"
import type {Metadata, VectorStore} from "../storage/vectorStore.js"
import {validateSearchQuery, hasAspectPhrases, hasStructuralFilter, type SearchQuery} from "./searchQuery.js"
import {combineScores, type AspectScoreInput} from "./combineScores.js"

/** 検索結果 1 件。表示情報は `overall` メタデータ（001）から復元する。 */
export interface SearchResultItem {
	wineId: string
	name: string | null
	producer: string | null
	region: RegionPath
	vintage: Vintage
	color: WineColor | null
	imageUrl: string | null
	/** 観点クエリ時のみ（構造のみ検索では付かない・FR-012）。 */
	score?: number
	/** 観点別内訳（観点クエリ時のみ・FR-006）。 */
	aspectScores?: Partial<Record<ExpressionCategory, number>>
}

export type SearchResult = {ok: true; items: SearchResultItem[]} | {ok: false; errors: FieldError[]}

export interface SearchWinesDeps {
	store: VectorStore
	/** 観点クエリの候補プール上限（topK）。既定 1000（Upstash 上限・research D6）。 */
	candidateTopK?: number
}

const DEFAULT_TOPK = 1000

function str(v: unknown): string | null {
	return typeof v === "string" && v !== "" ? v : null
}

function colorFromMeta(m: Metadata): WineColor | null {
	const c = m["color"]
	return c === "white" || c === "red" ? (c as WineColor) : null
}

function vintageFromMeta(m: Metadata): Vintage {
	const v = m["vintage"]
	if (typeof v === "number") return v
	if (v === "NV") return "NV"
	return null
}

function regionFromMeta(m: Metadata): RegionPath {
	return {country: str(m["country"]), region: str(m["region"]), subregion: str(m["subregion"]), commune: str(m["commune"])}
}

function toItem(wineId: string, m: Metadata): SearchResultItem {
	return {wineId, name: str(m["name"]), producer: str(m["producer"]), region: regionFromMeta(m), vintage: vintageFromMeta(m), color: colorFromMeta(m), imageUrl: str(m["imageUrl"])}
}

/** 構造条件の exact 一致（FR-004・原則 IV）。指定された層・色・年だけを厳密一致で判定する。 */
function matchesStructural(m: Metadata, q: SearchQuery): boolean {
	if (q.color !== null && colorFromMeta(m) !== q.color) return false
	const r = regionFromMeta(m)
	if (q.region.country !== null && r.country !== q.region.country) return false
	if (q.region.region !== null && r.region !== q.region.region) return false
	if (q.region.subregion !== null && r.subregion !== q.region.subregion) return false
	if (q.region.commune !== null && r.commune !== q.region.commune) return false
	if (q.vintage !== null && vintageFromMeta(m) !== q.vintage) return false
	return true
}

const byWineId = (a: {wineId: string}, b: {wineId: string}): number => (a.wineId < b.wineId ? -1 : a.wineId > b.wineId ? 1 : 0)

/**
 * 観点独立のワイン類似検索（読み取り専用・FR-010）。
 * - 観点表現あり: 観点ごとに独立に意味検索（FR-001）→ overall ハイドレート → 構造 exact フィルタ →
 *   合成（combineScores）→ 決定的順位 → limit 件。
 * - 観点表現なし（構造のみ・FR-012）: overall を scan → 構造 exact フィルタ → wineId 昇順 → limit 件（順位なし）。
 */
export function createSearchWines(deps: SearchWinesDeps) {
	const topK = deps.candidateTopK ?? DEFAULT_TOPK
	return async function searchWines(input: unknown): Promise<SearchResult> {
		const validated = validateSearchQuery(input)
		if (!validated.ok) return {ok: false, errors: validated.errors}
		const q = validated.value

		// 構造のみ（FR-012）: overall を走査し exact フィルタ → wineId 昇順（意味順位なし）。
		if (!hasAspectPhrases(q)) {
			const all = await deps.store.scan("overall")
			const items = all
				.filter((r): r is {id: string; metadata: Metadata} => r.metadata !== null && matchesStructural(r.metadata, q))
				.map(r => toItem(r.id, r.metadata))
				.sort(byWineId)
			return {ok: true, items: items.slice(0, q.limit)}
		}

		// 観点クエリ: 観点ごとに独立に意味検索（観点をまたいで混ぜない・FR-001）。
		const queriedAspects = EXPRESSION_CATEGORIES.filter(c => q[c] !== null)
		const scoresByWine = new Map<string, Partial<Record<ExpressionCategory, number>>>()
		for (const a of queriedAspects) {
			const hits = await deps.store.query(a, {data: q[a] as string, topK})
			for (const h of hits) {
				const entry = scoresByWine.get(h.id) ?? {}
				entry[a] = h.score
				scoresByWine.set(h.id, entry)
			}
		}
		const candidateIds = [...scoresByWine.keys()]
		if (candidateIds.length === 0) return {ok: true, items: []}

		// overall からハイドレート（表示情報＋構造フィルタの源）。
		const fetched = await deps.store.fetch("overall", candidateIds)
		const metaById = new Map(fetched.filter((f): f is {id: string; metadata: Metadata} => f.metadata !== null).map(f => [f.id, f.metadata] as const))

		const candidates: AspectScoreInput[] = []
		for (const id of candidateIds) {
			const m = metaById.get(id)
			if (m === undefined) continue // overall に無い候補は表示できないため除外
			if (hasStructuralFilter(q) && !matchesStructural(m, q)) continue // 構造 exact（原則 IV）
			candidates.push({wineId: id, scores: scoresByWine.get(id) ?? {}})
		}

		const items = combineScores(candidates, queriedAspects, q.weights)
			.slice(0, q.limit)
			.map(c => ({...toItem(c.wineId, metaById.get(c.wineId) as Metadata), score: c.score, aspectScores: c.aspectScores}))
		return {ok: true, items}
	}
}
