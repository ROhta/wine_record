import {describe, it, expect} from "vitest"
import {buildProtectedResourceMetadata, resourceMetadataUrl} from "../../src/auth/protectedResourceMetadata.js"

const auth = {
	issuerBaseUrl: "https://tenant.us.auth0.com",
	audience: "https://wine-record-rohta.vercel.app/mcp",
}

describe("buildProtectedResourceMetadata (RFC 9728)", () => {
	it("resource=audience, authorization_servers=[issuer] を含む JSON を返す", () => {
		const meta = buildProtectedResourceMetadata(auth)
		expect(meta.resource).toBe("https://wine-record-rohta.vercel.app/mcp")
		expect(meta.authorization_servers).toEqual(["https://tenant.us.auth0.com"])
		expect(meta.resource_name).toBe("wine-record")
		expect(meta.scopes_supported).toEqual([])
	})
})

describe("resourceMetadataUrl", () => {
	it("audience の origin から well-known URL を導出する（パスは捨てる）", () => {
		expect(resourceMetadataUrl(auth.audience)).toBe("https://wine-record-rohta.vercel.app/.well-known/oauth-protected-resource")
	})
})
