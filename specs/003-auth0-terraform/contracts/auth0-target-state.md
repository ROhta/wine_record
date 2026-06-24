# コントラクト: Auth0 目標状態（収束オラクル）

このドキュメントは本機能の**テストオラクル**である。`terraform import` 後、HCL をここに記す目標属性値へ
収束させ、`terraform plan` が**差分ゼロ**になることをもって合格とする（SC-001）。値の出所は 002 の
`research.md` D9 / `quickstart.md` ステップ1（実機で claude.ai 接続が成立した構成）。

> **収束の規律**: 値は本番の実体に合わせる。`plan` が緑になるまで `terraform apply` しない（research.md D2）。
> 実際の本番値が下表と食い違う場合は、**本番（import 結果）を正**として HCL を合わせ、差異を本ファイルに反映する。

## C1. `auth0_resource_server.wine_record_api`（API・リソースサーバー）

| 属性 | 目標値 |
|---|---|
| `identifier` | `https://wine-record-rohta.vercel.app/mcp`（= `AUTH0_AUDIENCE`・末尾スラッシュ無し） |
| `signing_alg` | `RS256` |
| `allow_offline_access` | `true` |
| `subject_type_authorization.user.policy` | `allow_all` |
| `subject_type_authorization.client.policy` | `require_client_grant` |
| `name` | 本番の現名（import で確認して合わせる） |

**検証**: `auth0_resource_server` の `plan` 差分ゼロ。特に `subject_type_authorization.user.policy=allow_all`
がコードに現れていること（002 の決定打。これが `require_client_grant` に戻ると `/authorize` が全クライアント拒否）。

## C2. `auth0_client.connector`（コネクタ用 Application）

| 属性 | 目標値 |
|---|---|
| `client_id` | （computed・不変）claude.ai に登録済みの値から変化しないこと |
| `is_first_party` | `true`（不変属性・recreate を出さない） |
| `app_type` | `regular_web` |
| `callbacks` | `["https://claude.ai/api/mcp/auth_callback"]` |
| `grant_types` | `["authorization_code", "refresh_token"]` |
| `oidc_conformant` | `true` |
| `token_endpoint_auth_method` | **本イテレーションでは管理外**（provider v1.x で `auth0_client` から削除→`auth0_client_credentials` で管理。secret 管理面を避け follow-up へ。宣言しないので差分対象外。本番は `client_secret_post` のまま） |
| `client_secret` | 管理しない（`output` 禁止・ローテーションしない。state は機密を含みうる前提で HCP 暗号化保護） |

**検証**: `auth0_client` の `plan` 差分ゼロ、かつ `-/+ destroy and then create replacement`（recreate）が
**出ないこと**。recreate が出たら force-new 属性（`is_first_party` 等）を本番値に合わせて消すまで apply しない。

## C3. 管理外（このコントラクトの対象外・本番のまま）

以下は本機能で**コード管理しない**。`terraform plan` に現れない（リソース化しない）ことが正しい状態。

| 設定 | 期待 |
|---|---|
| Default Audience（テナント） | 本番のまま（= API Identifier）。コード化しない |
| Resource Parameter Compatibility Profile（テナント） | 本番のまま（`compatibility` ON）。コード化しない |
| Terraform 実行用 M2M アプリ | 本番のまま（管理外）。`auth0_client` リソースとして取り込まない |

## 合格条件（このコントラクトの「グリーン」）

1. C1・C2 の管理対象リソースで `terraform plan` が **0 changes**（差分なし）。
2. `plan` に **recreate（`-/+`）が無い**（`client_id`・`identifier` が変わらない）。
3. C3 の管理外設定が `plan` に現れない。
4. （実機）apply 後または収束完了後、claude.ai → wine-record 接続が**再ログイン・再同意なしに動作**し、
   `client_id`・`audience` が変わっていない（SC-002）。
