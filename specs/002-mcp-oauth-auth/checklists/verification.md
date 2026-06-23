# 検証結果: MCP コネクタの OAuth 認証（claude.ai 接続）

**実施日**: 2026-06-23 / **機能**: 002-mcp-oauth-auth

## 自動ゲート（CI / ローカル・env 非依存）

- [x] 未認証 `/mcp` → 401 + `WWW-Authenticate: Bearer resource_metadata=...`（authGate.test.ts）
- [x] `/.well-known/oauth-protected-resource[/mcp]` → RFC 9728 JSON
- [x] 有効トークン（フェイク検証器）→ initialize/tools/list 通過・record_wine が 1 件 upsert
- [x] 無効/不正トークン → 401・処理未実行・**秘匿情報非漏洩**
- [x] `/health` → 200（認証外）
- [x] `createVerifierFromMiddleware` のマッピング（成功/失敗/scope抽出）を実テスト
- [x] 全ゲート緑: typecheck / lint / format:check / **test（既存 52 + 新規 21 = 73）** / build

## 本番（`wine-record-rohta.vercel.app`）

- [x] env 注入確認: `/.well-known/oauth-protected-resource` → 200（authorization_servers=Auth0）
- [x] エッジ SSO 解除（Terraform `vercel_authentication=none`・PR #100）
- [x] 未認証 `POST /mcp` → 401 + WWW-Authenticate（SSO 画面でなくアプリ層 OAuth）
- [x] 実 Auth0 トークン（client_credentials）→ 200（serverInfo 返却）

## claude.ai 実機（US1/US2・SC-002/SC-003）

- [x] **接続成立**（2026-06-23）: カスタムコネクタ URL 登録 → Advanced settings に client_id/secret → OAuth ログイン/同意 → 接続済み
- [x] `/authorize` が `/u/login` へ 302（curl で実証・認可成立）
- [x] record_wine 往復＆ Upstash 1 件増の最終裏取り（2026-06-23 実機）: 「このワインを記録して」→ preview_record（ベリーA 吉 / 赤 / マルサン葡萄酒 / 日本 / 2023）→ 「OK」→ record_wine →「保存しました🍷」。Upstash `overall` が 1→2 件に増加を確認（SC-003 クリア）

## 効いた Auth0 構成（quickstart.md ステップ1・research.md D9 に記載）

- API `subject_type_authorization.user.policy = allow_all`（決定打）
- テナント Resource Parameter Compatibility Profile = ON
- first-party Regular Web Application（`is_first_party:true`）
- API `allow_offline_access = ON` / Default Audience = API Identifier

## メモ

- 全項目チェック済み。002（MCP コネクタ OAuth 認証）は実機まで含めて完了（2026-06-23）。
- Auth0 テナント側の設定はリポジトリ管理外（iac/ の対象は Vercel のみ）。再現手順は quickstart.md。
