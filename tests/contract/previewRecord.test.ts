import {describe, it, expect} from "vitest"
import {makeServerDeps} from "../fixtures/deps.js"
import {connectClient} from "../fixtures/mcp.js"

describe("preview_record 契約", () => {
	it("preview_record がツール一覧に登録されている", async () => {
		const {deps} = makeServerDeps()
		const client = await connectClient(deps)
		const list = await client.listTools()
		expect(list.tools.map(t => t.name)).toContain("preview_record")
	})

	it("正規化した「保存される内容」を structuredContent.preview で返し、保存しない", async () => {
		const {deps, upserts} = makeServerDeps()
		const client = await connectClient(deps)
		const res = await client.callTool({
			name: "preview_record",
			arguments: {
				name: "シャブリ",
				color: "white",
				vintage: 2020,
				region: {country: "フランス"},
			},
		})
		expect(res.isError).toBeFalsy()
		const sc = res.structuredContent as {
			preview: {
				name: string
				color: string
				vintage: number | string | null
				region: {country: string | null}
			}
		}
		expect(sc.preview.name).toBe("シャブリ")
		expect(sc.preview.color).toBe("white")
		expect(sc.preview.vintage).toBe(2020)
		expect(sc.preview.region.country).toBe("フランス")
		expect(upserts).toHaveLength(0) // 読み取り専用＝副作用なし
	})

	it("name/color 欠落はフィールド別エラーを返し、保存しない", async () => {
		const {deps, upserts} = makeServerDeps()
		const client = await connectClient(deps)
		const res = await client.callTool({name: "preview_record", arguments: {vintage: "NV"}})
		expect(res.isError).toBe(true)
		const sc = res.structuredContent as {errors: {field: string}[]}
		const fields = sc.errors.map(e => e.field)
		expect(fields).toContain("name")
		expect(fields).toContain("color")
		expect(upserts).toHaveLength(0)
	})
})
