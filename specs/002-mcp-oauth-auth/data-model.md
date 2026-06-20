# Phase 1 データモデル: MCP コネクタの OAuth 認証

永続データの追加はない（認証はステートレス JWT 検証）。ここで定義するのは、
コード境界で扱う「型付きの値」と検証ルール。

## エンティティ

### AuthConfig（認証設定）

Auth0 への参照情報。シークレットは含まない（client secret はリソースサーバーには不要）。

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `issuerBaseUrl` | string (URL, https) | 認証有効時 必須 | Auth0 のテナント発行者 URL（例 `https://<tenant>.<region>.auth0.com`）。`.env` の `ISSUER_BASE_URL`/`AUTH0_ISSUER_BASE_URL`。 |
| `audience` | string (URL) | 認証有効時 必須 | Auth0 API Identifier ＝ 正規 MCP URL（例 `https://wine-record-rohta.vercel.app/mcp`）。`.env` の `AUDIENCE`/`AUTH0_AUDIENCE`。 |

検証ルール:
- 両方が設定されていれば**認証 ON**。両方未設定なら**認証 OFF**（ローカル開発/テスト用。本番では必ず設定）。
- 片方のみ設定はエラー（設定ミスを早期に検出。fail-closed 寄り）。
- `issuerBaseUrl` は https 必須。値はログ・エラーに出さない（issuer/audience 自体は秘匿ではないが、原則に従い最小開示）。

### AccessToken（アクセストークン・検証対象）

claude.ai が `Authorization: Bearer` で提示する Auth0 発行の JWT。サーバーは保存しない。

| 検証項目 | 規則 |
| --- | --- |
| 署名 | RS256・Auth0 JWKS の公開鍵で検証 |
| `iss` | `AuthConfig.issuerBaseUrl` と一致 |
| `aud` | `AuthConfig.audience` を含む（**自分宛**であること。MUST） |
| `exp` | 未期限切れ |
| 形式 | `Authorization: Bearer <jwt>` のみ（クエリ文字列は不可） |

検証成功時に内部表現へ変換:

| 内部フィールド | 由来 | 説明 |
| --- | --- | --- |
| `subject` | `payload.sub` | 認証主体の識別子（将来のマルチテナント分離の足がかり。本機能では利用は最小限） |
| `scopes` | `payload.scope`（空白区切り）/ `payload.permissions` | 付与スコープ（本機能では必須スコープを要求しない＝認証済みで可。将来 RBAC 余地） |

失敗時: 401（無効/期限切れ/audience 不一致）。応答・ログにトークン値・鍵・内部構成を**含めない**。

### ProtectedResourceMetadata（RFC 9728 公開メタデータ）

`/.well-known/oauth-protected-resource` が返す JSON。秘匿情報なし（公開前提）。

| フィールド | 値 |
| --- | --- |
| `resource` | 正規 MCP URL（= `audience`） |
| `authorization_servers` | `[issuerBaseUrl]`（Auth0） |
| `scopes_supported` | （任意）定義したスコープ |
| `resource_name` | `"wine-record"`（任意・人間可読） |

詳細な形は [contracts/protected-resource-metadata.md](./contracts/protected-resource-metadata.md)。

## 状態・ライフサイクル

ステートレス。リクエストごとに「トークン抽出 → JWKS 検証 → 内部型変換 → ツール実行 or 401」。
セッション・トークン保存・リフレッシュ管理はサーバー側に持たない（claude.ai/Auth0 が担う）。

## 既存データへの影響

なし。Upstash のスキーマ・ツールの入出力契約は不変（原則 I）。`record_wine` 等の挙動は認証通過後は従来どおり。
