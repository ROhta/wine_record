import {describe, it, expect} from "vitest"
import {Client} from "@modelcontextprotocol/sdk/client/index.js"
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js"
import {createMcpServer, type McpServerDeps} from "../../src/server.js"
import {createRecordWine} from "../../src/tools/recordWine.js"
import {createPreviewRecord} from "../../src/tools/previewRecord.js"
import {createGetJsaTaxonomy} from "../../src/tools/getJsaTaxonomy.js"
import type {VectorStore} from "../../src/storage/vectorStore.js"
import type {ExpressionTaxonomy} from "../../src/domain/taxonomy.js"

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

const noStore: VectorStore = {
	upsert: () => Promise.resolve(),
	fetch: () => Promise.resolve([]),
	query: () => Promise.resolve([]),
}

function makeDeps(): McpServerDeps {
	const common = {taxonomy: tax, allowedImageBaseUrl: "https://img.example.com"}
	return {
		recordWine: createRecordWine({
			...common,
			store: noStore,
			generateId: () => "w",
			now: () => "t",
		}),
		previewRecord: createPreviewRecord(common),
		getJsaTaxonomy: createGetJsaTaxonomy({taxonomy: tax}),
	}
}

async function connectClient(deps: McpServerDeps): Promise<Client> {
	const server = createMcpServer(deps)
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
	const client = new Client({name: "contract-test", version: "0.0.0"})
	await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
	return client
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
