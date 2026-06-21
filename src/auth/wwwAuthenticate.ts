/**
 * 401 応答に付与する `WWW-Authenticate` ヘッダ値を生成する（RFC 9728 §5.1）。
 * クライアントは `resource_metadata` から Protected Resource Metadata を取得し、
 * 認可サーバーを発見する。
 */
export function buildWwwAuthenticate(resourceMetadataUrl: string): string {
	return `Bearer resource_metadata="${resourceMetadataUrl}"`
}
