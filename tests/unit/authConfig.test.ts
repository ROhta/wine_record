import {describe, it, expect} from "vitest"
import {loadConfig} from "../../src/config.js"

const baseEnv: Record<string, string> = {
	UPSTASH_VECTOR_REST_URL: "https://example.upstash.io",
	UPSTASH_VECTOR_REST_TOKEN: "tok",
}

describe("loadConfig - Auth0 設定（認証 ON/OFF/設定ミス）", () => {
	it("issuer と audience の両方ありで auth を生成する（認証 ON）", () => {
		const cfg = loadConfig({
			...baseEnv,
			AUTH0_ISSUER_BASE_URL: "https://tenant.us.auth0.com",
			AUTH0_AUDIENCE: "https://wine-record-rohta.vercel.app/mcp",
		})
		expect(cfg.auth).toEqual({
			issuerBaseUrl: "https://tenant.us.auth0.com",
			audience: "https://wine-record-rohta.vercel.app/mcp",
		})
	})

	it("両方なしで auth=null（認証 OFF・ローカル/テスト）", () => {
		expect(loadConfig(baseEnv).auth).toBeNull()
	})

	it("issuer のみ設定は throw し、欠落フィールド名 AUTH0_AUDIENCE を含む（値は漏らさない）", () => {
		const env = {...baseEnv, AUTH0_ISSUER_BASE_URL: "https://tenant.us.auth0.com"}
		try {
			loadConfig(env)
			throw new Error("should have thrown")
		} catch (e) {
			const msg = (e as Error).message
			expect(msg).toContain("AUTH0_AUDIENCE")
			expect(msg).not.toContain("https://tenant.us.auth0.com")
		}
	})

	it("audience のみ設定は throw し、欠落フィールド名 AUTH0_ISSUER_BASE_URL を含む", () => {
		const env = {...baseEnv, AUTH0_AUDIENCE: "https://wine-record-rohta.vercel.app/mcp"}
		expect(() => loadConfig(env)).toThrowError(/AUTH0_ISSUER_BASE_URL/)
	})
})
