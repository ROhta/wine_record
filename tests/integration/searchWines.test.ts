import {describe, it, expect} from "vitest"
import {createSearchWines} from "../../src/search/searchWines.js"
import {makeSearchStore} from "../fixtures/vectorStore.js"
import type {Metadata, VectorStore} from "../../src/storage/vectorStore.js"

/** overall メタデータ（001 buildOverallUpsert のキーに準拠）の最小ヘルパ。 */
function rec(over: Partial<Metadata>): Metadata {
	return {name: null, color: null, producer: null, country: null, region: null, subregion: null, commune: null, vintage: null, importer: null, store: null, imageUrl: null, recordedAt: null, ...over}
}

describe("searchWines（観点独立検索の結合）", () => {
	it("US1: 単一観点で意味順に返し、表示情報＋スコアを付ける。観点を持たないワインは出ない（US1#3）", async () => {
		const store = makeSearchStore({
			queryHits: {
				taste: [
					{id: "w1", score: 0.9},
					{id: "w2", score: 0.5},
				],
			}, // w3 は taste に出ない
			records: {
				w1: rec({name: "A", color: "red", country: "スペイン", vintage: 2019}),
				w2: rec({name: "B", color: "red", country: "フランス", vintage: 2020}),
				w3: rec({name: "C", color: "white"}),
			},
		})
		const search = createSearchWines({store})
		const r = await search({taste: "なめらかなタンニン"})
		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.items.map(i => i.wineId)).toEqual(["w1", "w2"]) // w3 は不在
			expect(r.items[0]?.name).toBe("A")
			expect(r.items[0]?.score).toBeCloseTo(0.9, 6)
			expect(r.items[0]?.aspectScores?.taste).toBeCloseTo(0.9, 6)
		}
	})

	it("limit で件数を絞る", async () => {
		const store = makeSearchStore({
			queryHits: {
				taste: [
					{id: "w1", score: 0.9},
					{id: "w2", score: 0.5},
				],
			},
			records: {w1: rec({name: "A"}), w2: rec({name: "B"})},
		})
		const search = createSearchWines({store})
		const r = await search({taste: "x", limit: 1})
		expect(r.ok && r.items.length).toBe(1)
	})

	it("検証エラー（観点も構造も空）→ errors を返す", async () => {
		const search = createSearchWines({store: makeSearchStore({})})
		const r = await search({})
		expect(r.ok).toBe(false)
	})

	it("空コーパス → 空結果（エラーにしない・エッジ）", async () => {
		const search = createSearchWines({store: makeSearchStore({})})
		const r = await search({taste: "x"})
		expect(r.ok).toBe(true)
		if (r.ok) expect(r.items).toEqual([])
	})
})

describe("searchWines（US2: 複数観点）", () => {
	it("SC-002 統合: 両観点を満たすワインが片方のみより上位・内訳スコア（FR-006）を返す", async () => {
		const store = makeSearchStore({
			queryHits: {
				appearance: [{id: "both", score: 0.8}],
				taste: [
					{id: "both", score: 0.8},
					{id: "tasteOnly", score: 0.9},
				],
			},
			records: {both: rec({name: "Both"}), tasteOnly: rec({name: "TasteOnly"})},
		})
		const r = await createSearchWines({store})({appearance: "澄んだ", taste: "なめらか"})
		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.items.map(i => i.wineId)).toEqual(["both", "tasteOnly"])
			expect(r.items[0]?.aspectScores?.appearance).toBeCloseTo(0.8, 6)
			expect(r.items[0]?.aspectScores?.taste).toBeCloseTo(0.8, 6)
		}
	})

	it("FR-001 観点独立: 外観句は appearance、味わい句は taste の namespace にのみ渡る（取り違えない）", async () => {
		const calls: {namespace: string; data: string}[] = []
		const base = makeSearchStore({
			queryHits: {appearance: [{id: "w1", score: 0.5}], taste: [{id: "w1", score: 0.5}]},
			records: {w1: rec({name: "A"})},
		})
		const store: VectorStore = {
			...base,
			query: (ns, opts) => {
				calls.push({namespace: ns, data: opts.data})
				return base.query(ns, opts)
			},
		}
		await createSearchWines({store})({appearance: "澄んだ輝き", taste: "なめらかタンニン"})
		expect(calls.find(c => c.namespace === "appearance")?.data).toBe("澄んだ輝き")
		expect(calls.find(c => c.namespace === "taste")?.data).toBe("なめらかタンニン")
		expect(calls.some(c => c.namespace === "aroma")).toBe(false) // 指定していない観点は引かない
	})

	it("FR-003 重み: 味わい重視で高 taste のワインが上位に動く", async () => {
		const store = makeSearchStore({
			queryHits: {
				appearance: [
					{id: "appHi", score: 0.9},
					{id: "tasteHi", score: 0.3},
				],
				taste: [
					{id: "appHi", score: 0.3},
					{id: "tasteHi", score: 0.9},
				],
			},
			records: {appHi: rec({name: "AppHi"}), tasteHi: rec({name: "TasteHi"})},
		})
		const r = await createSearchWines({store})({appearance: "x", taste: "y", weights: {taste: 2}})
		expect(r.ok && r.items.map(i => i.wineId)).toEqual(["tasteHi", "appHi"])
	})
})

describe("searchWines（US3: 構造的絞り込み）", () => {
	it("SC-003: 構造条件（色・産地）で exact フィルタ・条件外は0件", async () => {
		const store = makeSearchStore({
			queryHits: {
				taste: [
					{id: "es", score: 0.9},
					{id: "fr", score: 0.8},
				],
			},
			records: {
				es: rec({name: "ES", color: "red", country: "スペイン"}),
				fr: rec({name: "FR", color: "red", country: "フランス"}),
			},
		})
		const r = await createSearchWines({store})({taste: "x", color: "red", region: {country: "スペイン"}})
		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.items.map(i => i.wineId)).toEqual(["es"]) // フランスは混入しない
		}
	})

	it("FR-012 構造のみ: 観点表現なし→合致一覧を wineId 昇順・スコアなしで返す", async () => {
		const store = makeSearchStore({
			records: {
				w2: rec({name: "B", color: "red"}),
				w1: rec({name: "A", color: "red"}),
				w3: rec({name: "C", color: "white"}),
			},
		})
		const r = await createSearchWines({store})({color: "red"})
		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.items.map(i => i.wineId)).toEqual(["w1", "w2"]) // wineId 昇順・白は除外
			expect(r.items[0]?.score).toBeUndefined() // 意味順位なし
		}
	})

	it("構造のみで合致ゼロ → 空結果（エラーにしない）", async () => {
		const store = makeSearchStore({records: {w1: rec({color: "white"})}})
		const r = await createSearchWines({store})({color: "red"})
		expect(r.ok).toBe(true)
		if (r.ok) expect(r.items).toEqual([])
	})
})
