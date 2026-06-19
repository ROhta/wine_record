import {describe, it, expect} from "vitest"
import {createRecordWine} from "../../src/tools/recordWine.js"
import {createPreviewRecord} from "../../src/tools/previewRecord.js"
import {createGetJsaTaxonomy} from "../../src/tools/getJsaTaxonomy.js"
import type {McpServerDeps} from "../../src/server.js"
import type {ExpressionTaxonomy} from "../../src/domain/taxonomy.js"
import {connectClient} from "../fixtures/mcp.js"
import {noStore} from "../fixtures/vectorStore.js"
import {allowedImageBaseUrl} from "../fixtures/deps.js"

// 表示テスト用のリッチなタクソノミー（複数 terms・selectCount=2 を含む。標準フィクスチャとは別物）。
const tax: ExpressionTaxonomy = {
	version: "2020.01.11",
	white: {
		appearance: [{name: "清澄度", selectCount: 1, terms: ["澄んだ", "濁った"]}],
		aroma: [{name: "第一印象", selectCount: 2, terms: ["閉じている", "華やか"]}],
		taste: [{name: "アタック", selectCount: 1, terms: ["軽い"]}],
	},
	red: {
		appearance: [{name: "清澄度", selectCount: 1, terms: ["澄んだ"]}],
		aroma: [{name: "第一印象", selectCount: 1, terms: ["閉じている"]}],
		taste: [{name: "タンニン分", selectCount: 1, terms: ["緻密"]}],
	},
}

function makeDeps(): McpServerDeps {
	const common = {taxonomy: tax, allowedImageBaseUrl}
	return {
		recordWine: createRecordWine({...common, store: noStore, generateId: () => "w", now: () => "t"}),
		previewRecord: createPreviewRecord(common),
		getJsaTaxonomy: createGetJsaTaxonomy({taxonomy: tax}),
	}
}

describe("get_jsa_taxonomy 契約（MCP プロトコル経由）", () => {
	it("tools/list に get_jsa_taxonomy が入力スキーマ付きで現れる", async () => {
		const client = await connectClient(makeDeps())
		const {tools} = await client.listTools()
		const tool = tools.find(t => t.name === "get_jsa_taxonomy")
		expect(tool).toBeDefined()
		expect(tool?.inputSchema).toBeDefined()
		await client.close()
	})

	it("color=white で白の3カテゴリをサブカテゴリ（name/selectCount/terms）付きで返す", async () => {
		const client = await connectClient(makeDeps())
		const res = await client.callTool({name: "get_jsa_taxonomy", arguments: {color: "white"}})
		expect(res.isError).toBeFalsy()
		const sc = res.structuredContent as {
			color: string
			version: string
			appearance: {name: string; selectCount: number; terms: string[]}[]
			aroma: unknown[]
			taste: unknown[]
		}
		expect(sc.color).toBe("white")
		expect(sc.version).toBe("2020.01.11")
		expect(sc.appearance[0]?.name).toBe("清澄度")
		expect(sc.appearance[0]?.selectCount).toBe(1)
		expect(sc.appearance[0]?.terms).toContain("澄んだ")
		expect(sc.aroma).toBeDefined()
		expect(sc.taste).toBeDefined()
		await client.close()
	})

	it("category 指定で該当カテゴリのみ返す", async () => {
		const client = await connectClient(makeDeps())
		const res = await client.callTool({
			name: "get_jsa_taxonomy",
			arguments: {color: "red", category: "taste"},
		})
		expect(res.isError).toBeFalsy()
		const sc = res.structuredContent as Record<string, unknown>
		expect(sc["taste"]).toBeDefined()
		expect(sc["appearance"]).toBeUndefined()
		expect(sc["aroma"]).toBeUndefined()
		await client.close()
	})

	it("color 不正は isError かつフィールド別エラー（color）を返す", async () => {
		const client = await connectClient(makeDeps())
		const res = await client.callTool({name: "get_jsa_taxonomy", arguments: {color: "rose"}})
		expect(res.isError).toBe(true)
		const sc = res.structuredContent as {errors: {field: string}[]}
		expect(sc.errors.map(e => e.field)).toContain("color")
		await client.close()
	})

	it("category 不正は isError かつフィールド別エラー（category）を返す", async () => {
		const client = await connectClient(makeDeps())
		const res = await client.callTool({
			name: "get_jsa_taxonomy",
			arguments: {color: "white", category: "bouquet"},
		})
		expect(res.isError).toBe(true)
		const sc = res.structuredContent as {errors: {field: string}[]}
		expect(sc.errors.map(e => e.field)).toContain("category")
		await client.close()
	})
})
