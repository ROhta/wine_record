import {describe, it, expect, vi} from "vitest"
import {createRecordWine} from "../../src/tools/recordWine.js"
import type {Namespace, VectorStore} from "../../src/storage/vectorStore.js"
import {makeFakeStore} from "../fixtures/vectorStore.js"
import {makeRecordWineDeps} from "../fixtures/deps.js"

describe("US2 表現選択の記録反映（観点別 namespace）", () => {
	it("選択した表現が各観点 namespace に id=wineId / metadata={wineId} で upsert される", async () => {
		const {store, upserts} = makeFakeStore()
		const recordWine = createRecordWine(makeRecordWineDeps(store))
		const r = await recordWine({
			name: "Chablis",
			color: "white",
			appearanceTerms: ["澄んだ"],
			aromaTerms: ["閉じている"],
			tasteTerms: ["軽い"],
		})
		expect(r.ok).toBe(true)

		const byNs = (ns: Namespace): typeof upserts => upserts.filter(u => u.namespace === ns)
		for (const ns of ["appearance", "aroma", "taste"] as const) {
			const items = byNs(ns)
			expect(items).toHaveLength(1)
			expect(items[0]?.item.id).toBe("wine-123")
			expect(items[0]?.item.metadata).toEqual({wineId: "wine-123"})
			expect(items[0]?.item.data.length).toBeGreaterThan(0)
		}
		// overall（正本）も書かれる
		expect(byNs("overall")).toHaveLength(1)
	})

	it("未選択カテゴリの namespace には書かない（空はスキップ）", async () => {
		const {store, upserts} = makeFakeStore()
		const recordWine = createRecordWine(makeRecordWineDeps(store))
		const r = await recordWine({name: "Chablis", color: "white", aromaTerms: ["閉じている"]})
		expect(r.ok).toBe(true)

		const namespaces = upserts.map(u => u.namespace)
		expect(namespaces).toContain("overall")
		expect(namespaces).toContain("aroma")
		expect(namespaces).not.toContain("appearance")
		expect(namespaces).not.toContain("taste")
	})

	it("観点別 upsert が失敗しても overall が成功すれば記録は成立する（ベストエフォート・原則IV）", async () => {
		const written: Namespace[] = []
		const store: VectorStore = {
			upsert: namespace => {
				if (namespace !== "overall") return Promise.reject(new Error("aspect namespace down"))
				written.push(namespace)
				return Promise.resolve()
			},
			fetch: () => Promise.resolve([]),
			query: () => Promise.resolve([]),
		}
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
		try {
			const recordWine = createRecordWine(makeRecordWineDeps(store))
			const r = await recordWine({name: "Chablis", color: "white", aromaTerms: ["閉じている"]})
			expect(r.ok).toBe(true) // overall が書けたので記録は成立
			expect(written).toEqual(["overall"])
			expect(warn).toHaveBeenCalled() // 失敗は警告する（silent failure にしない）
		} finally {
			warn.mockRestore()
		}
	})
})
