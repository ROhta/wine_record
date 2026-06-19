import type {ExpressionTaxonomy} from "../../src/domain/taxonomy.js"

/**
 * 標準のテスト用 JSA タクソノミー（白/赤の最小セット）。
 * 複数テストで逐語的に重複していた共通フィクスチャ。
 * 色横断拒否や表示の検証など、意図的に異なる語彙が要るテストは各ファイルでローカルに定義する。
 */
export const testTaxonomy: ExpressionTaxonomy = {
	version: "t",
	white: {
		appearance: [{name: "清澄度", selectCount: 1, terms: ["澄んだ"]}],
		aroma: [{name: "第一印象", selectCount: 1, terms: ["閉じている"]}],
		taste: [{name: "アタック", selectCount: 1, terms: ["軽い"]}],
	},
	red: {
		appearance: [{name: "清澄度", selectCount: 1, terms: ["澄んだ"]}],
		aroma: [{name: "第一印象", selectCount: 1, terms: ["閉じている"]}],
		taste: [{name: "タンニン分", selectCount: 1, terms: ["緻密"]}],
	},
}
