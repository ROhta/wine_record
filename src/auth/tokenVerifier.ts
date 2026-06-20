import {auth, type AuthResult} from "express-oauth2-jwt-bearer"
import type {Request, Response} from "express"

/**
 * Bearer アクセストークン検証の抽象（注入可能なシーム）。
 *
 * MCP サーバーは OAuth 2.1 リソースサーバーとして、提示されたトークンを検証する。
 * 実体（Auth0）はトランスポート層の関心であり、テストではフェイク検証器を注入して
 * env / ネットワーク非依存でゲート挙動を検証する（憲章 II）。
 */

/** 検証成功。`subject`=トークン主体(sub)、`scopes`=付与スコープ。 */
export interface TokenVerifySuccess {
	ok: true
	subject: string
	scopes: string[]
}

/** 検証失敗。`reason` は分類用の短い文字列のみ（トークン値・鍵・内部構成を含めない）。 */
export interface TokenVerifyFailure {
	ok: false
	reason: "missing" | "invalid"
}

export type TokenVerifyResult = TokenVerifySuccess | TokenVerifyFailure

export interface TokenVerifier {
	/**
	 * `Authorization` ヘッダ全体（例 `"Bearer <jwt>"`）を検証する。
	 * 失敗時も例外を投げず `{ok:false}` を返す（秘匿情報を漏らさないため理由は分類のみ）。
	 */
	verify(authorizationHeader: string | undefined): Promise<TokenVerifyResult>
}

/**
 * Auth0 を認可サーバーとする実体の検証器。`express-oauth2-jwt-bearer` の `auth()`
 * ミドルウェアをラップし、RS256/JWKS・issuer・audience・exp を検証する。
 *
 * `auth()` は Express ミドルウェアとしてのみ提供されるため、合成 req/next で駆動して
 * 成否を取り出す（成功時は req.auth に payload を設定し next()、失敗時は next(err) を呼び
 * res には触れない）。実トークン検証は CI ではなく実機（quickstart）で担保する。
 */
export function createAuth0Verifier(config: {issuerBaseUrl: string; audience: string}): TokenVerifier {
	const middleware = auth({issuerBaseURL: config.issuerBaseUrl, audience: config.audience})
	return {
		verify(authorizationHeader) {
			return new Promise<TokenVerifyResult>(resolve => {
				const headers: Record<string, string> = {}
				if (authorizationHeader !== undefined) headers["authorization"] = authorizationHeader
				// auth() が参照するのは主に req.headers。res は成否いずれでも触らない。
				const req = {headers, method: "POST"} as unknown as Request & {auth?: AuthResult}
				const res = {} as unknown as Response
				const done = (err?: unknown): void => {
					if (err !== undefined && err !== null) {
						resolve({ok: false, reason: authorizationHeader === undefined ? "missing" : "invalid"})
						return
					}
					const payload = req.auth?.payload
					const sub = typeof payload?.sub === "string" ? payload.sub : ""
					const scope = payload?.["scope"]
					const permissions = payload?.["permissions"]
					const scopes = typeof scope === "string" ? scope.split(" ").filter(Boolean) : Array.isArray(permissions) ? permissions.filter((p): p is string => typeof p === "string") : []
					resolve({ok: true, subject: sub, scopes})
				}
				const ret: unknown = middleware(req, res, done)
				if (ret instanceof Promise) ret.catch(() => resolve({ok: false, reason: "invalid"}))
			})
		},
	}
}
