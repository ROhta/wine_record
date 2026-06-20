import {describe, it, expect} from "vitest"
import type {AddressInfo} from "node:net"
import type {Server} from "node:http"
import {Client} from "@modelcontextprotocol/sdk/client/index.js"
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import {createApp, type AuthGate} from "../../src/server.js"
import type {TokenVerifier} from "../../src/auth/tokenVerifier.js"
import {makeServerDeps} from "../fixtures/deps.js"

const ISSUER = "https://tenant.us.auth0.com"
const AUDIENCE = "https://wine-record-rohta.vercel.app/mcp"
const VALID = "Bearer valid-token"

/** env / ネットワーク非依存のフェイク検証器。"valid-token" のみ受理。 */
const fakeVerifier: TokenVerifier = {
	verify(header) {
		if (!header) return Promise.resolve({ok: false, reason: "missing"})
		if (header === VALID) return Promise.resolve({ok: true, subject: "user1", scopes: []})
		return Promise.resolve({ok: false, reason: "invalid"})
	},
}

function startApp(): {server: Server; base: string; upserts: ReturnType<typeof makeServerDeps>["upserts"]} {
	const {deps, upserts} = makeServerDeps()
	const auth: AuthGate = {verifier: fakeVerifier, issuerBaseUrl: ISSUER, audience: AUDIENCE}
	const server = createApp(deps, auth).listen(0)
	const {port} = server.address() as AddressInfo
	return {server, base: `http://127.0.0.1:${port}`, upserts}
}

function close(server: Server): Promise<void> {
	return new Promise(resolve => server.close(() => resolve()))
}

async function connect(base: string, authorization?: string): Promise<Client> {
	const client = new Client({name: "authgate-test", version: "0.0.0"})
	const opts = authorization ? {requestInit: {headers: {Authorization: authorization}}} : {}
	await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), opts))
	return client
}

describe("認証ゲート（US1/US2/US3）", () => {
	it("US1/US3: 未認証の POST /mcp は 401 + WWW-Authenticate(resource_metadata) を返す", async () => {
		const {server, base} = startApp()
		try {
			const res = await fetch(`${base}/mcp`, {method: "POST", headers: {"content-type": "application/json"}, body: "{}"})
			expect(res.status).toBe(401)
			expect(res.headers.get("www-authenticate")).toContain('resource_metadata="https://wine-record-rohta.vercel.app/.well-known/oauth-protected-resource"')
			expect(await res.json()).toEqual({error: "unauthorized"})
		} finally {
			await close(server)
		}
	})

	it("US1: /.well-known/oauth-protected-resource は RFC 9728 JSON を返す（パス付き fallback も）", async () => {
		const {server, base} = startApp()
		try {
			for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
				const res = await fetch(`${base}${path}`)
				expect(res.status).toBe(200)
				expect(await res.json()).toEqual({
					resource: AUDIENCE,
					authorization_servers: [ISSUER],
					scopes_supported: [],
					resource_name: "wine-record",
				})
			}
		} finally {
			await close(server)
		}
	})

	it("US1: /health は認証 ON でも 200（liveness・認証外）", async () => {
		const {server, base} = startApp()
		try {
			const res = await fetch(`${base}/health`)
			expect(res.status).toBe(200)
			expect(await res.json()).toEqual({status: "ok"})
		} finally {
			await close(server)
		}
	})

	it("US1: 有効トークンなら initialize/tools/list を通過し 3 ツールが見える", async () => {
		const {server, base} = startApp()
		try {
			const client = await connect(base, VALID)
			const tools = await client.listTools()
			expect(tools.tools.map(t => t.name).sort()).toEqual(["get_jsa_taxonomy", "preview_record", "record_wine"])
			await client.close()
		} finally {
			await close(server)
		}
	})

	it("US2: 有効トークンで record_wine がゲートを通り永続化される（1 件 upsert）", async () => {
		const {server, base, upserts} = startApp()
		try {
			const client = await connect(base, VALID)
			const result = await client.callTool({
				name: "record_wine",
				arguments: {name: "Muscat Bailey A", color: "red"},
			})
			expect(result.isError).toBeFalsy()
			expect(upserts.length).toBe(1)
			await client.close()
		} finally {
			await close(server)
		}
	})

	it("US3: 不正トークンは 401 で拒否される（処理は実行されない）", async () => {
		const {server, base, upserts} = startApp()
		try {
			const res = await fetch(`${base}/mcp`, {
				method: "POST",
				headers: {"content-type": "application/json", authorization: "Bearer bogus"},
				body: JSON.stringify({jsonrpc: "2.0", id: 1, method: "tools/list", params: {}}),
			})
			expect(res.status).toBe(401)
			expect(upserts.length).toBe(0)
		} finally {
			await close(server)
		}
	})

	it("US3: 401 応答に秘匿情報（提示トークン値）を漏らさない", async () => {
		const {server, base} = startApp()
		const secretLike = "Bearer eyJhbGciOiJIUzI1Ni.secret-token-value"
		try {
			const res = await fetch(`${base}/mcp`, {method: "POST", headers: {"content-type": "application/json", authorization: secretLike}, body: "{}"})
			expect(res.status).toBe(401)
			const bodyText = await res.text()
			// ボディは種別のみ。提示トークン値や WWW-Authenticate にトークンを含めない。
			expect(bodyText).toBe('{"error":"unauthorized"}')
			expect(bodyText).not.toContain("secret-token-value")
			expect(res.headers.get("www-authenticate") ?? "").not.toContain("secret-token-value")
		} finally {
			await close(server)
		}
	})
})
