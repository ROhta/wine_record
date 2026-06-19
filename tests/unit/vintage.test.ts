import {describe, it, expect} from "vitest"
import {normalizeVintage} from "../../src/domain/vintage.js"

describe("normalizeVintage", () => {
	it("number はそのまま収穫年として扱う", () => {
		expect(normalizeVintage(2020)).toBe(2020)
	})

	it('"NV" はノン・ヴィンテージとして "NV" を返す', () => {
		expect(normalizeVintage("NV")).toBe("NV")
	})

	it("null / undefined / 空文字 は「不明」= null", () => {
		expect(normalizeVintage(null)).toBeNull()
		expect(normalizeVintage(undefined)).toBeNull()
		expect(normalizeVintage("")).toBeNull()
	})

	it("数字文字列・全角数字を number に変換する", () => {
		expect(normalizeVintage("2020")).toBe(2020)
		expect(normalizeVintage("２０２０")).toBe(2020)
		expect(normalizeVintage(" 2018 ")).toBe(2018)
	})

	it('"NV" は前後空白・大小文字の揺れを許容する', () => {
		expect(normalizeVintage(" nv ")).toBe("NV")
		expect(normalizeVintage("Nv")).toBe("NV")
	})

	it("範囲外の年は throw（厳格）", () => {
		expect(() => normalizeVintage(1500)).toThrowError(/ヴィンテージ年/)
		expect(() => normalizeVintage("3000")).toThrowError(/ヴィンテージ年/)
		expect(() => normalizeVintage(2020.5)).toThrowError(/ヴィンテージ年/)
	})

	it("解釈不能値・不正型は throw（厳格）", () => {
		expect(() => normalizeVintage("abc")).toThrowError(/解釈できません/)
		expect(() => normalizeVintage(true)).toThrowError(/型が不正/)
	})
})
