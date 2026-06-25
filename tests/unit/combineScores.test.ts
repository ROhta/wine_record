import {describe, it, expect} from "vitest"
import {combineScores} from "../../src/search/combineScores.js"
import type {AspectWeights} from "../../src/search/searchQuery.js"

const equal: AspectWeights = {appearance: 1, aroma: 1, taste: 1}

describe("combineScores（合成と決定性）", () => {
	it("SC-002: 両観点を満たすワインが片方のみより上位", () => {
		// 外観+味わいを均等重みで指定。
		const r = combineScores(
			[
				{wineId: "both", scores: {appearance: 0.8, taste: 0.8}}, // (0.8+0.8)/2 = 0.8
				{wineId: "tasteOnly", scores: {taste: 0.9}}, //            (0+0.9)/2 = 0.45（重みは分母に残す）
			],
			["appearance", "taste"],
			equal,
		)
		expect(r.map(x => x.wineId)).toEqual(["both", "tasteOnly"])
		expect(r[0]?.score).toBeCloseTo(0.8, 6)
		expect(r[1]?.score).toBeCloseTo(0.45, 6)
	})

	it("単一観点は素通し（分母=その観点の重み）", () => {
		const r = combineScores([{wineId: "a", scores: {taste: 0.7}}], ["taste"], equal)
		expect(r[0]?.score).toBeCloseTo(0.7, 6)
	})

	it("重みが順位に反映される（味わい重視で高 taste が上位）", () => {
		const w: AspectWeights = {appearance: 1, aroma: 1, taste: 2}
		const r = combineScores(
			[
				{wineId: "appHi", scores: {appearance: 0.9, taste: 0.3}}, // (0.9 + 2*0.3)/3 = 0.5
				{wineId: "tasteHi", scores: {appearance: 0.3, taste: 0.9}}, // (0.3 + 2*0.9)/3 = 0.7
			],
			["appearance", "taste"],
			w,
		)
		expect(r.map(x => x.wineId)).toEqual(["tasteHi", "appHi"])
	})

	it("FR-011 決定性: 同点は wineId 昇順で安定（入力順に依らない）", () => {
		const r = combineScores(
			[
				{wineId: "b", scores: {taste: 0.5}},
				{wineId: "a", scores: {taste: 0.5}},
				{wineId: "c", scores: {taste: 0.5}},
			],
			["taste"],
			equal,
		)
		expect(r.map(x => x.wineId)).toEqual(["a", "b", "c"])
	})

	it("観点別の内訳スコアを返す（FR-006）", () => {
		const r = combineScores([{wineId: "a", scores: {appearance: 0.6, taste: 0.4}}], ["appearance", "taste"], equal)
		expect(r[0]?.aspectScores.appearance).toBeCloseTo(0.6, 6)
		expect(r[0]?.aspectScores.taste).toBeCloseTo(0.4, 6)
	})
})
