# Phase 0 調査: MCP コネクタの OAuth 認証（Auth0）

仕様・計画の前提を確定するための技術調査。一次情報は MCP 認証仕様（2025-06-18）、
Anthropic コネクタ認証ドキュメント、各 RFC、Auth0 公式ドキュメント、Auth0 プラグイン
（express-oauth2-jwt-bearer スキル）。

## D1. MCP 認証の全体モデル

- **Decision**: 自サーバーは OAuth 2.1 **リソースサーバー**。認可サーバー（トークン発行）は外部 IdP に委譲。
- **Rationale**: MCP 認証仕様が「MCP server = OAuth 2.1 resource server」と規定。MCP SDK の FAQ も「認可サーバーは専用 IdP か OAuth ライブラリを使え（自作の AS ヘルパーは非推奨）」。
- **Alternatives considered**:
  - 自前 OAuth 2.1 認可サーバー実装 → 却下（DCR/メタデータ/PKCE/鍵管理を正しく作るのは重く危険。憲章 V・YAGNI）。
  - Vercel エッジ SSO 維持 → 却下（claude.ai はプレーン HTTPS で /mcp に到達する必要があり、Vercel SSO を通過できない＝原理的に不可）。
  - 静的 Bearer トークン手貼り → 却下（claude.ai は `static_bearer` 未対応と公式明記）。

## D2. claude.ai が要求する接続要件（無料プランは手動クライアント）

- **Decision**: 認証種別は `custom_connection`（claude.ai の「Advanced settings」で事前登録済みの OAuth `client_id`/`client_secret` を手動入力）。コールバックは `https://claude.ai/api/mcp/auth_callback`。PKCE S256 必須。**DCR は使わない**。
- **Rationale**: Anthropic 公式の認証種別は `oauth_dcr`/`oauth_cimd`/`oauth_anthropic_creds`/`custom_connection`/`none` の5つ。**Auth0 の DCR（`/oidc/register`）は無料/Developer プランでは非公開**で、Professional 以上 or サポート有効化が必要（調査で判明）。一方 claude.ai のカスタムコネクタは Advanced settings で手動 client_id/secret を受け付けるため、Auth0 に Application を1つ事前登録すれば DCR 不要で接続できる。サーバー実装（メタデータ・トークン検証）は DCR の有無に関わらず不変。claude.ai は毎接続で PKCE `code_challenge`(S256) を送る。WWW-Authenticate に `resource_metadata` が無い場合は `/.well-known/oauth-protected-resource[/<path>]` を probe する fallback あり。
- **Alternatives considered**:
  - `oauth_dcr`（自動登録）→ Auth0 無料プランで不可（有料 or サポート依頼）。本機能は無料前提のため不採用。将来 有料化すれば DCR に移行可能（サーバー実装は不変）。
  - `oauth_cimd`（Client ID Metadata Document）→ 将来検討。
  - `oauth_anthropic_creds` → ディレクトリ掲載コネクタ向けで、カスタム URL には不適。

## D3. リソースサーバー側の必須実装（仕様 MUST）

- **Decision**:
  1. `/.well-known/oauth-protected-resource`（RFC 9728）を配信。`resource`=正規 MCP URL、`authorization_servers`=[Auth0 issuer]。MCP パス付き fallback (`/.well-known/oauth-protected-resource/mcp`) も配信。
  2. 未認証/無効トークン時は **401** に `WWW-Authenticate: Bearer resource_metadata="<URL>"` を付与。
  3. Bearer トークンを検証し、**audience が自分宛**であることを必須確認（他サービス向けトークンを拒否）。403=スコープ不足、400=不正リクエスト。
  4. トークンは `Authorization: Bearer` のみ（クエリ文字列禁止）。
- **Rationale**: 仕様の「Authorization Server Discovery」「Access Token Usage」「Access Token Privilege Restriction（audience 検証必須・token passthrough 禁止）」に対応。
- **Alternatives considered**: express-oauth2-jwt-bearer の素の 401（WWW-Authenticate に resource_metadata を含まない）だけに頼る → claude.ai の probe fallback で動く可能性はあるが、仕様準拠と堅牢性のため resource_metadata 付与を自前で足す。

## D4. トークン検証の実装手段（Auth0 プラグイン）

- **Decision**: Auth0 の **`express-oauth2-jwt-bearer`** の `auth()` を採用。RS256 JWT を JWKS で検証し、`issuerBaseURL`(Auth0 ドメイン)・`audience`(API Identifier) を検証。`req.auth.payload` を内部型へ変換。
- **Rationale**: auth0 プラグイン推奨の標準 SDK。JWKS 取得・キャッシュ・iss/aud/exp 検証を内包。Express 5 対応。RFC 6750 準拠の Bearer 抽出。
- **Alternatives considered**:
  - `@modelcontextprotocol/express`（requireBearerAuth + mcpAuthMetadataRouter）→ MCP ネイティブだが追加パッケージかつトークン検証器は別途実装が必要。auth0 プラグイン採用方針に合わせ express-oauth2-jwt-bearer を主、メタデータ/WWW-Authenticate は自前の薄実装に。
  - `jose` で手書き検証 → 車輪の再発明。SDK に委ねる。

## D5. Auth0 側の設定（無料プラン・手動クライアント）

- **Decision**: 次を Auth0 テナントに設定（手順は quickstart.md）。**DCR は有効化しない**。
  1. **API 作成**: Applications → APIs → Create API、**Identifier = 正規 MCP URL**（例 `https://wine-record-rohta.vercel.app/mcp`）。これが `audience`。署名は RS256。
  2. **Default Audience 設定**: Settings → General → Default Audience を上記 Identifier に。
  3. **Application 作成（手動クライアント）**: Applications → Applications → Create Application →「Regular Web Application」。Allowed Callback URLs に `https://claude.ai/api/mcp/auth_callback`。発行された `client_id`/`client_secret` を claude.ai の Advanced settings に入力する。
- **Rationale（最重要の落とし穴）**: claude.ai（MCP クライアント）は認可リクエストに **`resource` は送るが `audience` を送らない**。Auth0 は `audience` 無しだと**不透明(opaque)トークン**を発行し、リソースサーバーで JWT として検証できない。**Default Audience を設定**すると標準 JWT が発行され検証可能になる。Application を手動登録するのは DCR が無料プランで使えないため（D2）。
- **Alternatives considered**: API ごとに audience を明示要求 → claude.ai が送らないため不成立。Default Audience がほぼ必須。DCR による Application 自動生成 → 無料プラン非対応。

## D6. Auth0 が公開するエンドポイント

- **Decision**: 自サーバーの Protected Resource Metadata の `authorization_servers` に Auth0 issuer (`https://<tenant>.<region>.auth0.com/`) を載せ、以降は claude.ai が Auth0 の `/.well-known/oauth-authorization-server`・`jwks.json`・PKCE S256 を利用する。クライアント登録は DCR（`registration_endpoint`）でなく手動 client_id/secret（D2）で代替。
- **Rationale**: Auth0 が RFC 8414 メタデータ・JWKS・PKCE を標準提供。リソースサーバーは「Auth0 を指す」だけでよい。
- **Alternatives considered**: 自サーバーで AS メタデータをプロキシ配信 → 不要（claude.ai は authorization_servers から直接 Auth0 を引く）。

## D7. ホスティング基盤（Vercel Deployment Protection）

- **Decision**: `iac/` の `vercel_authentication.deployment_type` を `none` に更新（エッジ SSO 解除）。保護はアプリ層 OAuth + Auth0 に一本化。
- **Rationale**: エッジ SSO と claude.ai は両立不可（D1）。アプリ層認証が入るので、エッジ層保護は外して良い（むしろ外さないと到達不能）。Terraform 管理下なのでコードで変更。
- **Alternatives considered**: Protection Bypass トークン併用 → claude.ai が任意ヘッダを安定送出できるか不確実。アプリ層 OAuth があれば不要。

## D8. テスト戦略（憲章 II・env 非依存）

- **Decision**: トークン検証を**インターフェース**として `server.ts` に注入（実体は Auth0 の `auth()`、テストはフェイク検証器）。これにより実 Auth0・実トークン無しで「有効/無効/期限切れ/audience 不一致/トークン無し」を結合テストできる。メタデータ生成・WWW-Authenticate は純関数で単体テスト。
- **Rationale**: 既存 `server.ts` の「依存注入＋遅延構築＋env 非依存テスト」パターンを踏襲。実 Auth0 への到達は quickstart.md の手動実機検証で担保（CI では行わない）。
- **Alternatives considered**: 実 Auth0 を CI で叩く → 不安定・秘匿情報依存。注入で代替。

## D9. Auth0 側で実際に必要だった認可設定（2026-06-23 実機接続で確定）

- **Decision**: claude.ai 接続を成立させるには、Auth0 側で次が**すべて**必要だった（手順は quickstart.md ステップ1）:
  1. **API `subject_type_authorization.user.policy = allow_all`**（決定打）。既定の `require_client_grant` だと authorization_code でも client-grant 必須になり `/authorize` が全クライアントを拒否（`invalid_request: ... not authorized to access resource server`）。
  2. **Resource Parameter Compatibility Profile = ON**（テナント）。claude.ai は `resource`(RFC 8707) を送るため。
  3. **first-party Regular Web Application**（`is_first_party:true`）。API 自動生成の M2M Test App（`non_interactive`）や third-party 不可。
  4. `allow_offline_access = ON`（claude.ai は `scope=offline_access` 要求）。callback 登録・Authorization Code グラント。
- **Rationale**: いずれも claude.ai の OAuth 挙動（`resource` 送出・`offline_access` 要求・手動クライアント）に Auth0 を合わせるため。client-grant（client_credentials 用）は user フローには無関係と判明（Mgmt API は grant 無しで `/authorize` 通過）。
- **デバッグ手法**: claude.ai UI 越しでなく `/authorize` を curl で直接叩き、`audience`/`scope`/設定を1変数ずつ変えて切り分けた（`/u/login` への 302 = 成功）。
- **Alternatives considered**: client-grant 作成 → user フローでは効かず却下。default_audience 単独 → 不十分（D5 の想定を実機で更新）。
- 注: これらは Auth0 テナント側の運用設定で、リポジトリ（iac/）の管理外。再現は quickstart.md と [[auth0-mcp-resource-parameter-profile]] 参照。

## 未解決（NEEDS CLARIFICATION）

なし（spec の前提で確定済み。Auth0 テナント/リージョンの具体値は実装時に `.env` で与える運用情報であり、設計上の未解決ではない）。
