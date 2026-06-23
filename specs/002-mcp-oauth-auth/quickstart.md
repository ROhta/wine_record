# クイックスタート / 検証ガイド: MCP コネクタの OAuth 認証（Auth0）

本機能がエンドツーエンドで動くことを証明する手順。実装の詳細は tasks.md と実装フェーズに属する。
ここでは「Auth0 設定 → 自動ゲート確認 → claude.ai 実機検証」の順で検証する。

## 前提

- Auth0 アカウント（無料枠可）。
- Vercel 本番 URL（`https://wine-record-rohta.vercel.app`、`/mcp` がエンドポイント）。
- `iac/` を Terraform 管理済み（Phase 2 完了）。HCP workspace `wine_records`（CLI 駆動）。

## ステップ 1: Auth0 テナント設定（手動・初回）

> **無料プラン**: Auth0 の DCR（`/oidc/register`）は無料/Developer プランでは使えない（Professional 以上 or サポート有効化）。
> 本手順は **DCR を使わず**、OAuth クライアントを手動で1つ事前登録し、claude.ai の Advanced settings に
> client_id/secret を入力する方式（`custom_connection`）。サーバー実装は DCR の有無に関わらず不変。
>
> 以下は 2026-06-23 に claude.ai 接続が実際に成立した構成。**(A)〜(C) の3点が claude.ai 固有のハマりどころ**で、
> 1つでも欠けると `/authorize` が `invalid_request: Client "..." is not authorized to access resource server` を返す。

1. **API 作成**（リソースサーバー）: Applications → APIs → **Create API**。
   - Name: `wine-record MCP` / **Identifier**: `https://wine-record-rohta.vercel.app/mcp`（= audience。末尾スラッシュ無し）/ Signing Algorithm: RS256
   - **`allow_offline_access` を ON**（補助。claude.ai は `scope=offline_access` を要求するため）。
   - **(A) `subject_type_authorization.user.policy` を `allow_all` に**（決定打）。API 既定が `require_client_grant` だと、authorization_code（ユーザーフロー）でも client-grant 必須になり全クライアントを拒否する。ダッシュボードに出ないことがあるため CLI 推奨:
     ```sh
     auth0 api patch "resource-servers/<API_ID>" \
       --data '{"allow_offline_access":true,"subject_type_authorization":{"user":{"policy":"allow_all"},"client":{"policy":"require_client_grant"}}}'
     ```
2. **(B) Resource Parameter Compatibility Profile を ON**: Settings（テナント）→ Advanced → Settings → 「Resource Parameter Compatibility Profile」トグル ON（CLI: `tenants/settings` の `resource_parameter_profile:"compatibility"`）。claude.ai は `audience` でなく `resource`(RFC 8707) を送るため、これで `resource` を audience として扱い標準 RS256 JWT を発行する。
3. **Default Audience**: Settings → General → **Default Audience** に Identifier を設定（補助。`resource` 経路の保険）。
4. **(C) Application 作成（first-party Regular Web App）**: Applications → Applications → **Create Application** → **Regular Web Application**。
   - **Allowed Callback URLs**: `https://claude.ai/api/mcp/auth_callback`（保存必須）/ Grant Types に Authorization Code（既定）。
   - **`is_first_party` が `true` であること**（重要）。API の Test 用に自動生成される M2M アプリ（`non_interactive`）や third-party アプリは不可。確実にするなら CLI で作成:
     ```sh
     auth0 api post clients --data '{"name":"wine-record claude connector","app_type":"regular_web","is_first_party":true,"oidc_conformant":true,"callbacks":["https://claude.ai/api/mcp/auth_callback"],"grant_types":["authorization_code","refresh_token"],"token_endpoint_auth_method":"client_secret_post"}'
     ```
   - **Client ID** / **Client Secret** を控える（ステップ 5 で claude.ai の Advanced settings に入力）。
5. 控える値: **issuer**（`https://<tenant>.<region>.auth0.com`）、**audience**（Identifier）、**client_id**/**client_secret**。ローカル検証用に API の **Test** タブの `access_token` も控える。

## ステップ 2: 環境変数の設定

ローカル `.env`（gitignore 済み）と Vercel 環境変数の両方に設定（リポジトリに literal を置かない）:

```
AUTH0_ISSUER_BASE_URL=https://<tenant>.<region>.auth0.com
AUTH0_AUDIENCE=https://wine-record-rohta.vercel.app/mcp
```

Vercel 側は Vercel ダッシュボードの環境変数に登録（UPSTASH_* と同様）。

## ステップ 3: 自動ゲートの確認（CI/ローカル・env 非依存）

実装の単体/結合テストで以下が緑になること（実 Auth0 不要・フェイク検証器で検証）:

- 未認証 `/mcp` → 401 + `WWW-Authenticate: Bearer resource_metadata=...`（[contracts/auth-http-contract.md](./contracts/auth-http-contract.md) C1）
- 有効トークン → 通過（C2）
- 無効/期限切れ/audience 不一致 → 401（C3）
- `/.well-known/oauth-protected-resource` → RFC 9728 JSON（C4・[protected-resource-metadata.md](./contracts/protected-resource-metadata.md)）
- `/health` → 200（認証不要・C5）
- 既存 52 テスト＋全ゲート（typecheck/lint/format/test/build）が緑（SC-005）

```sh
npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build
```

## ステップ 4: 基盤設定の更新（Terraform）

`iac/main.tf` の `vercel_authentication.deployment_type` を `none` に変更し、`cd iac && terraform plan && terraform apply`。
（エッジ SSO を解除し、保護をアプリ層 OAuth に移す。これが無いと逆に二重ゲートで claude.ai が 401 のまま。）

手動 curl（Auth0 設定後・本番）:

```sh
# 未認証 → 401 + WWW-Authenticate
curl -i -X POST https://wine-record-rohta.vercel.app/mcp -H 'content-type: application/json' -d '{}'
# メタデータ → 200
curl -s https://wine-record-rohta.vercel.app/.well-known/oauth-protected-resource | jq .
```

## ステップ 5: claude.ai 実機検証（手動・本機能の受け入れ）

1. claude.ai → 設定 → コネクタ → カスタムコネクタを追加。URL: `https://wine-record-rohta.vercel.app/mcp`。
   **Advanced settings** を開き、ステップ 1 の項目 3（Application 作成）で控えた **OAuth Client ID** と **Client Secret** を入力する（DCR を使わない手動クライアント）。
2. **OAuth ログイン/同意画面が表示される**こと（US1・SC-002）。ログインして同意。
3. コネクタが「接続済み」になり、`record_wine` / `preview_record` / `get_jsa_taxonomy` が一覧に出る（US1）。
4. ラベル写真 → `preview_record` → 承認 → `record_wine` で保存 → wineId が返る（US2・SC-003）。
5. Upstash 裏取り: 記録が 1 件増えている。
6. 失敗系（任意）: トークン無しの直接 curl が 401（US3・SC-001/SC-004）。

## トラブルシュート（claude.ai 接続が失敗するとき）

claude.ai の UI 越しに試すと遅いので、**`/authorize` を curl で直接叩く**と login 前にエラーが即出て、1変数ずつ切り分けられる（`/u/login` へ 302 = 認可成功。`error_description` を読む）:

```sh
curl -s -o /dev/null -D - "https://<tenant>.<region>.auth0.com/authorize?response_type=code&client_id=<CLIENT_ID>&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&resource=https%3A%2F%2Fwine-record-rohta.vercel.app%2Fmcp&scope=offline_access&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=t" | grep -i '^location:'
```

エラー別の対処（このプロジェクトで実際に踏んだ順）:

| エラー | 原因 / 対処 |
| --- | --- |
| `Couldn't register with ... sign-in service` | DCR 失敗（無料プラン）。claude.ai の Advanced settings に手動 client_id/secret を入れる |
| `Callback URL mismatch` | アプリの Allowed Callback URLs に `https://claude.ai/api/mcp/auth_callback` を追加し**保存** |
| `Grant type 'authorization_code' not allowed` | アプリの Grant Types に Authorization Code を追加 |
| `Client ... is not authorized to access resource server` | **(A)** API `subject_type_authorization.user.policy=allow_all`、**(B)** Resource Parameter Compatibility Profile ON、**(C)** アプリが first-party、を確認（本プロジェクトの決定打は (A)） |
| 接続後に `/mcp` が 401 | トークンの `aud` が API Identifier と不一致。`resource`/compatibility profile/default_audience と `AUTH0_AUDIENCE` の一致を確認 |

切り分けには Auth0 ログも有用: `auth0 api get "logs?sort=date:-1&per_page=10&q=client_id%3A<CLIENT_ID>"`。

## 完了の定義

- ステップ 3 の自動ゲートが全部緑。
- ステップ 5 で claude.ai から OAuth 同意 → record_wine 往復が成立し永続化を確認。
- 未認証アクセスが確実に 401（秘匿情報非漏洩）。
