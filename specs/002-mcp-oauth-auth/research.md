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

## D2. claude.ai が要求する接続要件

- **Decision**: 認証種別は `oauth_dcr`（OAuth + Dynamic Client Registration）。コールバックは `https://claude.ai/api/mcp/auth_callback`。PKCE S256 必須。
- **Rationale**: Anthropic 公式の認証種別に `oauth_dcr`/`oauth_cimd`/`oauth_anthropic_creds`/`custom_connection`/`none` の5つ。カスタム URL コネクタで現実的なのは DCR（または CIMD）。claude.ai は毎接続で PKCE `code_challenge`(S256) を送る。WWW-Authenticate に `resource_metadata` が無い場合は `/.well-known/oauth-protected-resource[/<path>]` を probe する fallback あり。
- **Alternatives considered**:
  - `oauth_cimd`（Client ID Metadata Document）→ 将来検討。Auth0 公式は本番では CIMD 推奨だが、まず DCR で単一ユーザー検証を通す（縦切り優先）。
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

## D5. Auth0 側の設定（claude.ai が DCR で繋がるための要点）

- **Decision**: 次を Auth0 テナントに設定（手順は quickstart.md）。
  1. **DCR 有効化**: Settings → Advanced → Dynamic Client Registration（OIDC Dynamic Application Registration）を ON。
  2. **API 作成**: Applications → APIs → Create API、**Identifier = 正規 MCP URL**（例 `https://wine-record-rohta.vercel.app/mcp`）。これが `audience`。署名は RS256。
  3. **Default Audience 設定**: Settings → General → Default Audience を上記 Identifier に。
  4. **Default Permissions for Third-Party Applications**: 該当 API でスコープを定義（DCR クライアントは third-party 扱い）。
  5. **接続の昇格**: 必要なら接続を `is_domain_connection=true`（DCR アプリでログイン手段を有効化）。
- **Rationale（最重要の落とし穴）**: claude.ai（MCP クライアント）は認可リクエストに **`resource` は送るが `audience` を送らない**。Auth0 は `audience` 無しだと**不透明(opaque)トークン**を発行し、リソースサーバーで JWT として検証できない。**Default Audience を設定**すると標準 JWT が発行され検証可能になる。
- **Alternatives considered**: API ごとに audience を明示要求 → claude.ai が送らないため不成立。Default Audience がほぼ必須。

## D6. Auth0 が公開するエンドポイント

- **Decision**: 自サーバーの Protected Resource Metadata の `authorization_servers` に Auth0 issuer (`https://<tenant>.<region>.auth0.com/`) を載せ、以降は claude.ai が Auth0 の `/.well-known/oauth-authorization-server`・`registration_endpoint`(DCR)・`jwks.json`・PKCE S256 を利用する。
- **Rationale**: Auth0 が RFC 8414 メタデータ・RFC 7591 DCR・JWKS・PKCE を標準提供。リソースサーバーは「Auth0 を指す」だけでよい。
- **Alternatives considered**: 自サーバーで AS メタデータをプロキシ配信 → 不要（claude.ai は authorization_servers から直接 Auth0 を引く）。

## D7. ホスティング基盤（Vercel Deployment Protection）

- **Decision**: `iac/` の `vercel_authentication.deployment_type` を `none` に更新（エッジ SSO 解除）。保護はアプリ層 OAuth + Auth0 に一本化。
- **Rationale**: エッジ SSO と claude.ai は両立不可（D1）。アプリ層認証が入るので、エッジ層保護は外して良い（むしろ外さないと到達不能）。Terraform 管理下なのでコードで変更。
- **Alternatives considered**: Protection Bypass トークン併用 → claude.ai が任意ヘッダを安定送出できるか不確実。アプリ層 OAuth があれば不要。

## D8. テスト戦略（憲章 II・env 非依存）

- **Decision**: トークン検証を**インターフェース**として `server.ts` に注入（実体は Auth0 の `auth()`、テストはフェイク検証器）。これにより実 Auth0・実トークン無しで「有効/無効/期限切れ/audience 不一致/トークン無し」を結合テストできる。メタデータ生成・WWW-Authenticate は純関数で単体テスト。
- **Rationale**: 既存 `server.ts` の「依存注入＋遅延構築＋env 非依存テスト」パターンを踏襲。実 Auth0 への到達は quickstart.md の手動実機検証で担保（CI では行わない）。
- **Alternatives considered**: 実 Auth0 を CI で叩く → 不安定・秘匿情報依存。注入で代替。

## 未解決（NEEDS CLARIFICATION）

なし（spec の前提で確定済み。Auth0 テナント/リージョンの具体値は実装時に `.env` で与える運用情報であり、設計上の未解決ではない）。
