import {describe, it, expect} from "vitest"
import {normalizeRegion, cleanOptionalString} from "../../src/domain/region.js"

describe("cleanOptionalString", () => {
	it("トリムし、空・非文字列は null", () => {
		expect(cleanOptionalString(" Bourgogne ")).toBe("Bourgogne")
		expect(cleanOptionalString("   ")).toBeNull()
		expect(cleanOptionalString(123)).toBeNull()
		expect(cleanOptionalString(undefined)).toBeNull()
	})
})

describe("normalizeRegion", () => {
	it("各層をトリムし、欠落・空は null", () => {
		expect(normalizeRegion({country: "France", region: " Bourgogne ", commune: ""})).toEqual({
			country: "France",
			region: "Bourgogne",
			subregion: null,
			commune: null,
		})
	})

	it("非オブジェクトは全 null", () => {
		expect(normalizeRegion(null)).toEqual({
			country: null,
			region: null,
			subregion: null,
			commune: null,
		})
	})
})
