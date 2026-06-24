# データモデル: Auth0 設定の Terraform 管理

「エンティティ」は Terraform で管理する Auth0 リソースと、その管理属性。値の正本（target state）は
002 の `research.md` D9 / `quickstart.md` ステップ1 に記録された「効いた構成」。具体的な目標値は
[contracts/auth0-target-state.md](./contracts/auth0-target-state.md)（収束オラクル）に集約する。

## エンティティ 1: Auth0 API（`auth0_resource_server`）

wine-record の保護対象リソース。Identifier が MCP の `audience`（`AUTH0_AUDIENCE` env と一致必須）。

| 属性 | 役割 | 管理 | 備考 |
|---|---|---|---|
| `identifier` | = audience = 正規 MCP URL | コード管理 | **変更不可の前提**（env・トークン aud と一致）。recreate を招かない |
| `signing_alg` | トークン署名 | コード管理 | `RS256` |
| `allow_offline_access` | refresh token 許可 | コード管理 | `true`（claude.ai は `offline_access` 要求） |
| `subject_type_authorization.user.policy` | ユーザーフロー認可ポリシー | コード管理 | **`allow_all`（002 の決定打）** |
| `subject_type_authorization.client.policy` | M2M 認可ポリシー | コード管理 | `require_client_grant`（既定維持） |
| `name` | 表示名 | コード管理 | 本番の現名に合わせる |

- **不変条件**: `identifier` は `src` の `AUTH0_AUDIENCE`、および発行トークンの `aud` と一致し続ける。
- **import**: `terraform import auth0_resource_server.wine_record_api "<API_ID>"`。

## エンティティ 2: Auth0 Application（`auth0_client`）

claude.ai が OAuth に使う first-party クライアント。稼働中接続が `client_id` に依存するため不変性が要。

| 属性 | 役割 | 管理 | 備考 |
|---|---|---|---|
| `client_id` | クライアント識別子 | 読み取り専用（computed） | **不変必須**（claude.ai 設定済み）。recreate で変わると接続断 |
| `is_first_party` | first-party 判定 | コード管理 | **`true`（不変属性・recreate 誘発に注意）** |
| `app_type` | アプリ種別 | コード管理 | `regular_web` |
| `callbacks` | 許可コールバック | コード管理 | `["https://claude.ai/api/mcp/auth_callback"]` |
| `grant_types` | 許可グラント | コード管理 | `["authorization_code","refresh_token"]` |
| `oidc_conformant` | OIDC 準拠 | コード管理 | `true` |
| `token_endpoint_auth_method` | クライアント認証方式 | **本イテレーション管理外** | provider v1.x で `auth0_client` から削除（`auth0_client_credentials` で管理）。secret 管理面を避け follow-up。本番は `client_secret_post` のまま |
| `client_secret` | クライアント秘密 | **管理外**（resource で書き込み不可・data source のみ） | apply が触らない（ローテーションしない）。`output` せず、state は機密を含みうる前提で HCP 暗号化保護 |

- **不変条件**: `client_id` 不変（SC-002）。`is_first_party=true` を pin して recreate を防ぐ。
- **import**: `terraform import auth0_client.connector "<CLIENT_ID>"`。

## 管理外（コード化しない）— `iac/README.md` に文書化

| 設定 | 種別 | 管理外の理由 | 文書化する内容 |
|---|---|---|---|
| Default Audience | テナント全体（`auth0_tenant`） | 共有テナントへ波及（FR-003） | 現在値（= API Identifier）・設定理由・変更注意 |
| Resource Parameter Compatibility Profile | テナント全体（`auth0_tenant`） | 同上 | `compatibility` ON・理由（claude.ai が `resource` 送出） |
| Terraform 実行用 M2M アプリ | クライアント（Management API） | 自己ロックアウト回避（D5） | 権限・資格情報の保管先（HCP env）・再発行手順。connector の secret とは別物 |

## 関係

- `auth0_client`（connector）→ `auth0_resource_server`（API）: claude.ai は API の `identifier` を
  `resource`/`audience` として要求し、API がそのトークンを検証する。両者の `identifier`・`client_id` は
  稼働中接続の前提として不変。
- `AUTH0_*` env（Vercel・アプリ側）↔ `identifier`: 本機能では env を変更しない。Terraform 管理対象と
  env 値が一致し続けることが整合条件。
