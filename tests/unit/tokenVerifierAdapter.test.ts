import {describe, it, expect} from "vitest"
import type {Request, RequestHandler} from "express"
import {createVerifierFromMiddleware} from "../../src/auth/tokenVerifier.js"

/** ヘッダだけを持つ最小の Request スタブ（型のみキャスト）。 */
function reqWith(authorization?: string): Request {
	const headers: Record<string, string> = {}
	if (authorization !== undefined) headers["authorization"] = authorization
	return {headers} as unknown as Request
}

/** 成功ミドルウェア: req.auth に payload を設定して next()。 */
function okMiddleware(payload: Record<string, unknown>): RequestHandler {
	return (req, _res, next) => {
		// 実 auth0 は req.auth に {payload, header, token} を設定する。本検証で参照するのは payload のみ。
		Object.assign(req, {auth: {payload}})
		next()
	}
}

/** 失敗ミドルウェア: next(err)。 */
const failMiddleware: RequestHandler = (_req, _res, next) => next(new Error("invalid token"))

describe("createVerifierFromMiddleware（auth0 ミドルウェア → TokenVerifier のマッピング）", () => {
	it("成功時: subject と scopes(scope 文字列) を取り出して ok=true", async () => {
		const verifier = createVerifierFromMiddleware(okMiddleware({sub: "user-1", scope: "read:wine write:wine"}))
		const result = await verifier.verify(reqWith("Bearer good"))
		expect(result).toEqual({ok: true, subject: "user-1", scopes: ["read:wine", "write:wine"]})
	})

	it("成功時: Auth0 permissions 配列からも scopes を取り出す", async () => {
		const verifier = createVerifierFromMiddleware(okMiddleware({sub: "user-2", permissions: ["a", "b"]}))
		const result = await verifier.verify(reqWith("Bearer good"))
		expect(result).toEqual({ok: true, subject: "user-2", scopes: ["a", "b"]})
	})

	it("失敗時(トークンあり): ok=false reason=invalid", async () => {
		const verifier = createVerifierFromMiddleware(failMiddleware)
		expect(await verifier.verify(reqWith("Bearer bad"))).toEqual({ok: false, reason: "invalid"})
	})

	it("失敗時(トークンなし): ok=false reason=missing", async () => {
		const verifier = createVerifierFromMiddleware(failMiddleware)
		expect(await verifier.verify(reqWith())).toEqual({ok: false, reason: "missing"})
	})

	it("ミドルウェアが reject しても ok=false に倒す（例外を投げない）", async () => {
		const rejecting: RequestHandler = () => Promise.reject(new Error("boom"))
		expect(await createVerifierFromMiddleware(rejecting).verify(reqWith("Bearer x"))).toEqual({ok: false, reason: "invalid"})
	})
})
