/**
 * OAuth 2.0 Protected Resource Metadata（RFC 9728）。
 * クライアント（claude.ai）が「このリソースを使うにはどの認可サーバーで認証すべきか」を
 * 発見するための公開メタデータ。秘匿情報は含まない。
 */
export interface ProtectedResourceMetadata {
	/** 保護対象リソースの正規 URI（= Auth0 API Identifier = トークンの aud）。 */
	resource: string
	/** 認可サーバー（Auth0 issuer）。1 要素以上。 */
	authorization_servers: string[]
	/** 対応スコープ（本機能では空で可）。 */
	scopes_supported: string[]
	/** 人間可読のリソース名。 */
	resource_name: string
}

/** `Config.auth` から RFC 9728 メタデータを生成する純関数。 */
export function buildProtectedResourceMetadata(auth: {issuerBaseUrl: string; audience: string}): ProtectedResourceMetadata {
	return {
		resource: auth.audience,
		authorization_servers: [auth.issuerBaseUrl],
		scopes_supported: [],
		resource_name: "wine-record",
	}
}

/**
 * メタデータ公開エンドポイントの URL を audience の origin から導出する。
 * 例: `https://host/mcp` → `https://host/.well-known/oauth-protected-resource`。
 * WWW-Authenticate の `resource_metadata` と well-known の配信先に使う。
 */
export function resourceMetadataUrl(audience: string): string {
	return new URL("/.well-known/oauth-protected-resource", new URL(audience).origin).toString()
}
