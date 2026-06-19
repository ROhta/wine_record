import {describe, it, expect} from "vitest"
import {validateRecordInput} from "../../src/domain/recordInput.js"
import type {ExpressionTaxonomy} from "../../src/domain/taxonomy.js"

const tax: ExpressionTaxonomy = {
	version: "test",
	white: {
		appearance: [{name: "清澄度", selectCount: 1, terms: ["澄んだ", "濁った"]}],
		aroma: [{name: "第一印象", selectCount: 1, terms: ["閉じている"]}],
		taste: [{name: "アタック", selectCount: 1, terms: ["軽い"]}],
	},
	red: {
		appearance: [{name: "清澄度", selectCount: 1, terms: ["澄んだ"]}],
		aroma: [{name: "第一印象", selectCount: 1, terms: ["閉じている"]}],
		taste: [{name: "タンニン分", selectCount: 1, terms: ["緻密"]}],
	},
}
const BASE = "https://img.example.com"

const validInput = {
	name: " Chablis ",
	color: "white",
	vintage: "2020",
	region: {country: "France", region: "Bourgogne"},
	appearanceTerms: ["澄んだ"],
	aromaTerms: ["閉じている"],
	tasteTerms: ["軽い"],
	imageUrl: "https://img.example.com/labels/abc.jpg",
}

describe("validateRecordInput", () => {
	it("妥当な入力を正規化して受理する", () => {
		const r = validateRecordInput(validInput, tax, BASE)
		expect(r.ok).toBe(true)
		if (r.ok) {
			expect(r.value.name).toBe("Chablis")
			expect(r.value.color).toBe("white")
			expect(r.value.vintage).toBe(2020)
			expect(r.value.region.country).toBe("France")
			expect(r.value.imageUrl).toBe("https://img.example.com/labels/abc.jpg")
		}
	})

	it("name 欠落・color 不正・imageUrl 不正を全件収集する（color 不正時は語彙照合スキップ）", () => {
		const r = validateRecordInput({color: "rose", aromaTerms: ["未知の香り"], imageUrl: "http://evil.example.com/x.jpg"}, tax, BASE)
		expect(r.ok).toBe(false)
		if (!r.ok) {
			const fields = r.errors.map(e => e.field)
			expect(fields).toContain("name")
			expect(fields).toContain("color")
			expect(fields).toContain("imageUrl")
			expect(fields).not.toContain("aromaTerms")
		}
	})

	it("color 妥当なら JSA 語彙外の用語を弾く", () => {
		const r = validateRecordInput({...validInput, aromaTerms: ["存在しない香り"]}, tax, BASE)
		expect(r.ok).toBe(false)
		if (!r.ok) expect(r.errors.some(e => e.field === "aromaTerms")).toBe(true)
	})

	it('vintage "NV" を受理する', () => {
		const r = validateRecordInput({...validInput, vintage: "NV"}, tax, BASE)
		expect(r.ok).toBe(true)
		if (r.ok) expect(r.value.vintage).toBe("NV")
	})

	it("imageUrl はホスト完全一致を要求し、サフィックス偽装ドメインを弾く", () => {
		const evil = validateRecordInput({...validInput, imageUrl: "https://img.example.com.evil.com/x.jpg"}, tax, BASE)
		expect(evil.ok).toBe(false)
		if (!evil.ok) expect(evil.errors.some(e => e.field === "imageUrl")).toBe(true)

		const okr = validateRecordInput({...validInput, imageUrl: "https://img.example.com/labels/abc.jpg"}, tax, BASE)
		expect(okr.ok).toBe(true)
	})
})
