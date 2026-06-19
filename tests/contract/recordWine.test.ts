import {describe, it, expect} from "vitest"
import {makeServerDeps} from "../fixtures/deps.js"
import {connectClient} from "../fixtures/mcp.js"

/** content 配列から最初の text を取り出す。 */
function firstText(content: unknown): string {
	if (!Array.isArray(content)) return ""
	const first = content[0] as {type?: string; text?: string} | undefined
	return first?.type === "text" ? (first.text ?? "") : ""
}

const validArgs = {
	name: "Chablis",
	color: "white",
	vintage: "2020",
	appearanceTerms: ["澄んだ"],
	aromaTerms: ["閉じている"],
	tasteTerms: ["軽い"],
}

describe("record_wine 契約（MCP プロトコル経由）", () => {
	it("tools/list に record_wine が入力スキーマ付きで現れる", async () => {
		const {deps} = makeServerDeps()
		const client = await connectClient(deps)
		const {tools} = await client.listTools()
		const tool = tools.find(t => t.name === "record_wine")
		expect(tool).toBeDefined()
		expect(tool?.inputSchema).toBeDefined()
		await client.close()
	})

	it("妥当な入力 → wineId/recordedAt を structuredContent で返し overall に upsert する", async () => {
		const {deps, upserts} = makeServerDeps()
		const client = await connectClient(deps)
		const res = await client.callTool({name: "record_wine", arguments: validArgs})
		expect(res.isError).toBeFalsy()
		expect(res.structuredContent).toMatchObject({
			wineId: "wine-123",
			recordedAt: "2026-06-18T00:00:00.000Z",
		})
		expect(upserts).toHaveLength(4) // overall + 観点別 appearance/aroma/taste
		expect(upserts[0]?.namespace).toBe("overall")
		expect(upserts[0]?.item.id).toBe("wine-123")
		await client.close()
	})

	it("不正な入力（name 欠落）→ isError かつ構造化された name エラーを返し、永続化しない（SC-005）", async () => {
		const {deps, upserts} = makeServerDeps()
		const client = await connectClient(deps)
		const res = await client.callTool({name: "record_wine", arguments: {color: "white"}})
		expect(res.isError).toBe(true)
		expect(firstText(res.content)).toContain("name")
		expect(upserts).toHaveLength(0)
		await client.close()
	})
})
