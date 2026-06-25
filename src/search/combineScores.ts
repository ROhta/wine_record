import type {ExpressionCategory} from "../domain/taxonomy.js"
import type {AspectWeights} from "./searchQuery.js"

/** 1 候補の観点別素スコア（その観点で候補に出なかった観点は欠落＝0 扱い）。 */
export interface AspectScoreInput {
	wineId: string
	scores: Partial<Record<ExpressionCategory, number>>
}

/** 合成結果（総合スコア＋観点別内訳）。 */
export interface CombinedResult {
	wineId: string
	score: number
	aspectScores: Partial<Record<ExpressionCategory, number>>
}

/** 決定性のためのスコア丸め精度（小数 6 桁）。float の最下位ビットの揺れを吸収する。 */
const PRECISION = 1e6

function roundScore(s: number): number {
	return Math.round(s * PRECISION) / PRECISION
}

/**
 * 観点別スコアを合成し、決定的順位で返す。
 *
 * 総合スコア = `Σ_a (w_a · s_a) / Σ_a (w_a)`（a は **queriedAspects** = クエリ指定の全観点）。
 * 候補がある観点の表現を持たない場合 `s_a = 0`、ただし**その観点の重み w_a は分母に残す**。
 * これにより「両観点を満たすワイン > 片方のみ」が保証される（SC-002）。
 *
 * 並び順は `(round(score) desc, wineId asc)` で決定的（同点も安定・FR-011/SC-006）。
 * `queriedAspects` は空でない前提（構造のみクエリでは本関数を呼ばない）。重みは検証で > 0（searchQuery）。
 */
export function combineScores(candidates: AspectScoreInput[], queriedAspects: readonly ExpressionCategory[], weights: AspectWeights): CombinedResult[] {
	const denom = queriedAspects.reduce((sum, a) => sum + weights[a], 0)
	const results: CombinedResult[] = candidates.map(c => {
		const num = queriedAspects.reduce((sum, a) => sum + weights[a] * (c.scores[a] ?? 0), 0)
		const aspectScores: Partial<Record<ExpressionCategory, number>> = {}
		for (const a of queriedAspects) {
			const s = c.scores[a]
			if (s !== undefined) aspectScores[a] = roundScore(s)
		}
		return {wineId: c.wineId, score: roundScore(num / denom), aspectScores}
	})
	return results.sort((a, b) => b.score - a.score || (a.wineId < b.wineId ? -1 : a.wineId > b.wineId ? 1 : 0))
}
