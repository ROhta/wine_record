import {describe, it, expect} from "vitest"
import {validateSearchQuery} from "../../src/search/searchQuery.js"

describe("validateSearchQuery（FR-009 境界検証）", () => {
	it("観点表現のみ → ok・trim・既定値（limit=10・重み均等1）", () => {
		const r = validateSearchQuery({taste: "  なめらかなタンニン  "})
		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.value.taste).toBe("なめらかなタンニン")
			expect(r.value.appearance).toBeNull()
			expect(r.value.limit).toBe(10)
			expect(r.value.weights).toEqual({appearance: 1, aroma: 1, taste: 1})
			expect(r.value.color).toBeNull()
		}
	})

	it("構造条件のみ → ok（観点表現なしでも成立・FR-012）", () => {
		const r = validateSearchQuery({color: "red", region: {country: "スペイン"}})
		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.value.color).toBe("red")
			expect(r.value.region.country).toBe("スペイン")
		}
	})

	it("観点も構造も空 → エラー（最低ひとつ必須）", () => {
		const r = validateSearchQuery({taste: "   ", region: {}})
		expect(r.ok).toBe(false)
		if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
	})

	it("weights が 0 → エラー（0 除算 NaN を排除・> 0 必須）", () => {
		const r = validateSearchQuery({taste: "x", weights: {taste: 0}})
		expect(r.ok).toBe(false)
		if (!r.ok) expect(r.errors.some(e => e.field === "weights")).toBe(true)
	})

	it("weights が負 → エラー", () => {
		const r = validateSearchQuery({taste: "x", weights: {appearance: -1}})
		expect(r.ok).toBe(false)
		if (!r.ok) expect(r.errors.some(e => e.field === "weights")).toBe(true)
	})

	it("limit < 1 → エラー", () => {
		const r = validateSearchQuery({taste: "x", limit: 0})
		expect(r.ok).toBe(false)
		if (!r.ok) expect(r.errors.some(e => e.field === "limit")).toBe(true)
	})

	it("不正な color → エラー（指定されたが white/red 以外）", () => {
		const r = validateSearchQuery({color: "blue"})
		expect(r.ok).toBe(false)
		if (!r.ok) expect(r.errors.some(e => e.field === "color")).toBe(true)
	})

	it("正の重みは反映、未指定観点は 1", () => {
		const r = validateSearchQuery({appearance: "a", taste: "t", weights: {taste: 2}})
		expect(r.ok).toBe(true)
		if (r.ok) expect(r.value.weights).toEqual({appearance: 1, aroma: 1, taste: 2})
	})
})
