import {auth, type AuthResult} from "express-oauth2-jwt-bearer"
import type {Request, RequestHandler, Response} from "express"

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
	 * 実際の Express リクエストを検証する。`Authorization` ヘッダの Bearer トークンを検証し、
	 * 失敗時も例外を投げず `{ok:false}` を返す（秘匿情報を漏らさないため理由は分類のみ）。
	 * 実 req を渡すことで、auth0 ミドルウェアが必要とする req のプロパティ
	 * （`is`/`app`/`protocol`/`query`/`body` 等）が揃い、合成 req の不足による誤判定を避ける。
	 */
	verify(req: Request): Promise<TokenVerifyResult>
}

/** JWT payload からスコープを取り出す（OAuth `scope` 文字列 / Auth0 `permissions` 配列）。 */
function extractScopes(payload: AuthResult["payload"] | undefined): string[] {
	const scope = payload?.["scope"]
	if (typeof scope === "string") return scope.split(" ").filter(Boolean)
	const permissions = payload?.["permissions"]
	if (Array.isArray(permissions)) return permissions.filter((p): p is string => typeof p === "string")
	return []
}

/**
 * Express 認証ミドルウェア（成功時に `req.auth` を設定して `next()`、失敗時に `next(err)` を呼ぶ）を
 * `TokenVerifier` に変換する。ルートハンドラから渡される実 req で駆動する。
 *
 * このマッピング（next() → ok / next(err) → fail / payload → subject・scopes）は、
 * フェイクミドルウェアを注入して単体テストする（成功パスを含めて CI で検証可能にする）。
 */
export function createVerifierFromMiddleware(middleware: RequestHandler): TokenVerifier {
	return {
		verify(req) {
			return new Promise<TokenVerifyResult>(resolve => {
				// auth0 ミドルウェアは検証経路で res に書き込まない（成否いずれも next を呼ぶ）。
				const res = {} as unknown as Response
				const done = (err?: unknown): void => {
					if (err !== undefined && err !== null) {
						resolve({ok: false, reason: req.headers.authorization === undefined ? "missing" : "invalid"})
						return
					}
					const payload = (req as Request & {auth?: AuthResult}).auth?.payload
					resolve({ok: true, subject: typeof payload?.sub === "string" ? payload.sub : "", scopes: extractScopes(payload)})
				}
				const ret: unknown = middleware(req, res, done)
				if (ret instanceof Promise) ret.catch(() => resolve({ok: false, reason: "invalid"}))
			})
		},
	}
}

/**
 * Auth0 を認可サーバーとする実体の検証器。`express-oauth2-jwt-bearer` の `auth()` を
 * そのまま用い、RS256/JWKS・issuer・audience・exp を検証する（実トークン検証は CI ではなく
 * 実機 quickstart で担保）。
 */
export function createAuth0Verifier(config: {issuerBaseUrl: string; audience: string}): TokenVerifier {
	return createVerifierFromMiddleware(auth({issuerBaseURL: config.issuerBaseUrl, audience: config.audience}))
}
