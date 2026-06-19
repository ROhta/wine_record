import {describe, it, expect} from "vitest"
import {createRecordWine} from "../../src/tools/recordWine.js"
import {makeFakeStore} from "../fixtures/vectorStore.js"
import {makeRecordWineDeps} from "../fixtures/deps.js"

const validInput = {
	name: "Chablis",
	color: "white",
	vintage: "2020",
	appearanceTerms: ["澄んだ"],
	aromaTerms: ["閉じている"],
	tasteTerms: ["軽い"],
}

describe("record_wine フロー", () => {
	it("妥当な入力 → wineId/recordedAt を返し overall に upsert する", async () => {
		const {store, upserts} = makeFakeStore()
		const recordWine = createRecordWine(makeRecordWineDeps(store))
		const r = await recordWine(validInput)
		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.wineId).toBe("wine-123")
			expect(r.recordedAt).toBe("2026-06-18T00:00:00.000Z")
		}
		expect(upserts).toHaveLength(4) // overall + 観点別 appearance/aroma/taste
		expect(upserts[0]?.namespace).toBe("overall")
		expect(upserts[0]?.item.id).toBe("wine-123")
		expect(upserts.map(u => u.namespace)).toEqual(["overall", "appearance", "aroma", "taste"])
	})

	it("不正な入力（name 欠落）→ 永続化しない（SC-005）", async () => {
		const {store, upserts} = makeFakeStore()
		const recordWine = createRecordWine(makeRecordWineDeps(store))
		const r = await recordWine({color: "white"})
		expect(r.ok).toBe(false)
		if (!r.ok) expect(r.errors.some(e => e.field === "name")).toBe(true)
		expect(upserts).toHaveLength(0)
	})
})
