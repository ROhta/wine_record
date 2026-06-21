# 契約: Protected Resource Metadata（RFC 9728）

`/.well-known/oauth-protected-resource`（および `/.well-known/oauth-protected-resource/mcp`）が返す JSON。

## レスポンス形

```json
{
  "resource": "https://wine-record-rohta.vercel.app/mcp",
  "authorization_servers": ["https://<tenant>.<region>.auth0.com/"],
  "scopes_supported": [],
  "resource_name": "wine-record"
}
```

| フィールド | 必須 | 規則 |
| --- | --- | --- |
| `resource` | ✅ | 正規 MCP URL（= Auth0 API Identifier = トークンの `aud`）。`AuthConfig.audience` から導出。 |
| `authorization_servers` | ✅ | 1 要素以上。Auth0 issuer（`AuthConfig.issuerBaseUrl`）。claude.ai はここから Auth0 の AS メタデータ/DCR/JWKS を辿る。 |
| `scopes_supported` | 任意 | 定義したスコープ（本機能では空でも可）。 |
| `resource_name` | 任意 | 人間可読名。 |

## 規則

- 値は実行時の `AuthConfig` から生成する（コードに literal の Auth0 ドメイン/audience を埋め込まない）。
- `resource` は末尾スラッシュ無しの正規形を優先（RFC 8707/9728 の相互運用ガイダンス）。
- 認証 OFF 時（AuthConfig 未設定）はこのエンドポイントを 404 か空で扱う（本番は必ず ON）。実装方針は plan/tasks で確定。
- 単体テスト（`tests/unit/protectedResourceMetadata.test.ts`）で「与えた config から正しい JSON 形が生成される／authorization_servers に issuer を含む／resource が audience と一致」を検証。

## 参照

- RFC 9728 Protected Resource Metadata
- MCP 認証仕様 2025-06-18「Authorization Server Discovery」
