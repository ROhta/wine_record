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
