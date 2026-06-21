import {describe, it, expect} from "vitest"
import {buildWwwAuthenticate} from "../../src/auth/wwwAuthenticate.js"

describe("buildWwwAuthenticate (RFC 9728 §5.1)", () => {
	it('Bearer resource_metadata="<URL>" 形式を返す', () => {
		const url = "https://wine-record-rohta.vercel.app/.well-known/oauth-protected-resource"
		expect(buildWwwAuthenticate(url)).toBe(`Bearer resource_metadata="${url}"`)
	})
})
