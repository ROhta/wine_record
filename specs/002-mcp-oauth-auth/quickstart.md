# クイックスタート / 検証ガイド: MCP コネクタの OAuth 認証（Auth0）

本機能がエンドツーエンドで動くことを証明する手順。実装の詳細は tasks.md と実装フェーズに属する。
ここでは「Auth0 設定 → 自動ゲート確認 → claude.ai 実機検証」の順で検証する。

## 前提

- Auth0 アカウント（無料枠可）。
- Vercel 本番 URL（`https://wine-record-rohta.vercel.app`、`/mcp` がエンドポイント）。
- `iac/` を Terraform 管理済み（Phase 2 完了）。HCP workspace `wine_records`（CLI 駆動）。

## ステップ 1: Auth0 テナント設定（手動・初回）

1. **DCR 有効化**: Auth0 Dashboard → Settings → Advanced → **Dynamic Client Registration (OIDC Dynamic Application Registration)** を ON → Save。
2. **API 作成**: Applications → APIs → **Create API**。
   - Name: `wine-record MCP`
   - **Identifier**: `https://wine-record-rohta.vercel.app/mcp`（= audience。末尾スラッシュ無し）
   - Signing Algorithm: RS256
3. **Default Audience**: Settings → General → **Default Audience** に上記 Identifier を設定（**重要**: claude.ai は `resource` のみ送り `audience` を送らないため、未設定だと opaque token になり JWT 検証不能）。
4. **Default Permissions for Third-Party Applications**: 作成した API の Settings で、third-party（DCR）アプリに許可するスコープを定義（本機能では最小で可）。
5. **接続の昇格（必要時）**: ログイン手段（DB/Google 等）を DCR アプリで使えるよう、対象 connection を `is_domain_connection=true` に（Management API もしくは CLI）。
6. 控える値: テナントの **issuer**（`https://<tenant>.<region>.auth0.com/`）と **audience**（上記 Identifier）。

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
2. **OAuth ログイン/同意画面が表示される**こと（US1・SC-002）。ログインして同意。
3. コネクタが「接続済み」になり、`record_wine` / `preview_record` / `get_jsa_taxonomy` が一覧に出る（US1）。
4. ラベル写真 → `preview_record` → 承認 → `record_wine` で保存 → wineId が返る（US2・SC-003）。
5. Upstash 裏取り: 記録が 1 件増えている。
6. 失敗系（任意）: トークン無しの直接 curl が 401（US3・SC-001/SC-004）。

## 完了の定義

- ステップ 3 の自動ゲートが全部緑。
- ステップ 5 で claude.ai から OAuth 同意 → record_wine 往復が成立し永続化を確認。
- 未認証アクセスが確実に 401（秘匿情報非漏洩）。
