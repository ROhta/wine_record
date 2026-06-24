# iac/ — Vercel / Auth0 を Terraform で管理（HCP backend）

wine-record の Vercel プロジェクト設定と Auth0（MCP コネクタ OAuth）のテナント設定を宣言的に管理する。
State は HCP Terraform（リモート・暗号化。単一 workspace `wine_records` で両 provider を扱う）。
Auth0 の手順は本ファイル末尾の「Auth0（US 003）」を参照。

目的: Cloudflare ホスティングから Vercel に移行し、Blob / Upstash と合わせて Vercel に一元管理する。
`record-wine` の MCP サーバー（Express + Streamable HTTP）を Vercel でホストする。

## 管理対象

| リソース | 内容 |
| --- | --- |
| `vercel_project.wine_record` | プロジェクト設定。git 接続（main=本番 / その他=preview）、`framework=node`、`node_version=24.x`、**Deployment Protection 無効化（`vercel_authentication.deployment_type = "none"`）** |

### 管理しないもの（意図的）

- **`UPSTASH_*` 環境変数**: Vercel の Upstash 統合がオーナー。統合のトークン自動ローテーションを
  壊さないため Terraform では管理しない。
- **デプロイ成果物**: git push による自動デプロイに委ねる（`terraform apply` でデプロイはしない）。

## セキュリティ（保護はアプリ層 OAuth に移行）

`vercel_authentication = none` により Vercel エッジ層の Deployment Protection（SSO）は無効。
保護の責務は **アプリ層 OAuth（Auth0・US 002）** に移行済み:

- `/mcp` は Bearer アクセストークン検証で保護され、未認証は `401 + WWW-Authenticate` を返す。
- claude.ai のリモート MCP コネクタはプレーン HTTPS で `/mcp` に到達し、Auth0 の OAuth フロー
  （手動登録した client_id/secret・PKCE）でトークンを取得して接続する。

→ `/mcp` は「**OAuth で保護された公開エンドポイント**」であり、authless ではない。
詳細は `specs/002-mcp-oauth-auth/`（research.md D2/D5/D7・quickstart.md）。

## 前提（初回のみ・手動）

1. **HCP Terraform の organization / workspace を作成**
   - organization 名は `iac/versions.tf` の `cloud.organization` と一致させること（既定 `rohta`）。
   - workspace 名 `wine_records`、Execution Mode は `Remote` 推奨。
2. **Vercel API トークンを HCP workspace に登録**
   - HCP workspace の Variables に **環境変数（Environment variable）**として
     `VERCEL_API_TOKEN`（**sensitive**）を設定。値は Vercel ダッシュボードの Account Settings → Tokens で発行。
   - ※リポジトリやチャットにトークンを貼らないこと。
3. **CLI 認証**
   ```sh
   terraform login            # app.terraform.io のトークンを取得
   ```

## 初回適用（既存プロジェクトの取り込み）

プロジェクトは手動作成済みのため、**create ではなく import** する。

```sh
cd iac
terraform init

# 既存プロジェクトを import（team_id/project_id）
terraform import vercel_project.wine_record team_YR2EVOhud8379Uz429mo0SDG/prj_a1grVcVSZU8K0OGwTi2eNOb8YpkA

# 差分を確認（設定は現状一致のため、実質変更なし=import のみのはず）
terraform plan

# 問題なければ適用（state への取り込みのみ。保護設定など現状は変えない）
terraform apply
```

`terraform plan` で意図しない差分（自動検出される build_command / install_command 等）が出た場合は、
既存設定に合わせて `main.tf` に明示するか、差分を受容できるか確認してから `apply` すること。

## 日常運用

```sh
cd iac
terraform plan     # 差分確認
terraform apply    # 設定変更を反映
```

アプリのコード変更は git push による自動デプロイで反映される（Terraform は介在しない）。

---

# Auth0（US 003・MCP コネクタ OAuth のテナント設定）

002 で手動構築した Auth0 構成（claude.ai 接続に必要な API・Application）をコード化し、`terraform plan`
を本番に対して**差分ゼロ**にする。稼働中の claude.ai 接続を壊さない（`client_id`・`audience` 不変）ことが
最重要。設計の詳細は `specs/003-auth0-terraform/`（plan.md・research.md・contracts・quickstart.md）。

## 管理対象

| リソース | 内容 |
| --- | --- |
| `auth0_resource_server.wine_record_api` | API（リソースサーバー）。`identifier`(=audience)・`signing_alg`・`allow_offline_access`・`subject_type_authorization.user.policy=allow_all`（002 の決定打） |
| `auth0_client.connector` | claude.ai 用 first-party Application。`is_first_party`・`callbacks`・`grant_types`・`app_type` 等。`client_secret` は管理しない（後述） |

両リソースに `lifecycle { prevent_destroy = true }` を設定し、`client_id`/`audience` が変わる
destroy→recreate を機械的に防ぐ（接続維持・SC-002）。

## 管理しないもの（意図的・管理外）

| 設定 | 管理外の理由 |
| --- | --- |
| **テナント全体設定**（Default Audience・Resource Parameter Compatibility Profile） | テナント `bingo-next.jp.auth0.com` は**他プロジェクトと共有**。`auth0_tenant` をコード管理すると他用途に波及する。現在値: Default Audience = API Identifier、Compatibility Profile = ON（claude.ai が `resource`(RFC 8707) を送るため）。変更時は共有影響に注意 |
| **Terraform 実行用 M2M アプリ** | Terraform に自身の足場（アクセス資格情報）を管理させると apply で自己ロックアウトしうる |
| **connector の `client_secret`** | provider の新版で `auth0_client` リソースから書き込み不可（読み取りは `auth0_client` データソース）。`output` しない。state は機密を含みうる前提で HCP 暗号化により保護 |
| **connector のクライアント認証方式**（`client_secret_post`） | provider v1.x で `auth0_client` から削除され `auth0_client_credentials`（secret も統べる）が必要。connector の secret 管理面に踏み込むため**本イテレーションでは見送り**（import 実証後の follow-up）。宣言しないので差分は出ず、本番は 002 設定の `client_secret_post` のまま |

> ⚠️ **2 つの secret を混同しないこと**: ①**Terraform 実行用 M2M** の client_secret（Terraform → Auth0 Management API）と、②**connector** の client_secret（claude.ai → Auth0 OAuth）は別物。①のみ HCP env に登録し、②は触らない。

## 前提（初回のみ・手動ブートストラップ）

Terraform が Auth0 Management API を操作するための M2M アプリを**手動で 1 つ**用意する（管理外）:

1. Auth0 → Applications → **Machine to Machine**。Management API を認可し、最小スコープ
   `read:clients` / `update:clients` / `read:resource_servers` / `update:resource_servers` を付与。
2. 発行された **domain / client_id / client_secret** を HCP workspace `wine_records` の
   **sensitive 環境変数**として登録: `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET`。
   - リポジトリ・tfvars・チャットに値を貼らないこと。
3. この M2M アプリは Terraform 管理に**含めない**（自己ロックアウト回避）。

## 初回適用（既存リソースの取り込み・config-driven import）

API・Application は手動作成済みのため、**create ではなく import**（create すると client_id/audience が
変わり接続が壊れる）。取り込みは `imports.tf` の **import ブロック**で行うため、**`terraform import` CLI は不要**
（`terraform plan`/`apply` が取り込みを実行する）。

1. **取り込み対象 ID を変数で与える**（非機密＝識別子。HCP workspace の Terraform 変数、または gitignore 済み
   `*.tfvars`）:
   - `auth0_resource_server_id` = 既存 API の内部 ID（`auth0 api get resource-servers` の `id`）
   - `auth0_connector_client_id` = connector の Client ID（claude.ai の Advanced settings / Auth0 ダッシュボード）

   ```hcl
   # 例: iac/import.auto.tfvars（gitignore 済み。*.tfvars は commit しない）
   auth0_resource_server_id  = "xxxxxxxxxxxxxxxxxxxxxxxx"
   auth0_connector_client_id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

2. **plan → apply**（`terraform import` は打たない）:

   ```sh
   cd iac
   terraform init   # auth0 provider を取得し lock を更新（subject_type_authorization 対応版を確認）
   terraform plan   # 「import される 2 リソース」＋設定差分を確認（下記の収束規律へ）
   terraform apply  # plan が「import のみ・changes なし」になってから実行（取り込みを実行）
   ```

import ブロック（`imports.tf`）は取り込み後も残してよい（idempotent・state 喪失時に自動再取り込み＝SC-006）。
不要なら apply 成功後に削除可。

### 差分ゼロへの収束（★最重要の安全規律）

import 直後の `plan` はほぼ差分が出る（provider 既定 vs 本番設定）。これを **`auth0.tf` を本番方向にのみ
編集**して消す。収束オラクルは `specs/003-auth0-terraform/contracts/auth0-target-state.md`。

```sh
terraform plan   # 差分と recreate（-/+）の有無を確認
```

- **`plan` が 0 changes になるまで `terraform apply` を実行しない。** 収束途中の apply / create が稼働中の
  API・client を書き換え／再作成して接続を壊す最大要因。
- `auth0_client` に recreate（`-/+ ... forces replacement`）が出たら、原因属性（特に `is_first_party`）を
  本番値に合わせる。`prevent_destroy = true` のため、recreate を伴う apply は**エラーで止まる**（安全側）。
- 本番値が `auth0.tf` と食い違う場合は、**本番（import 結果）を正**として `auth0.tf` を合わせ、差異を
  contracts に反映する。
- 単一 workspace のため、plan に **Vercel 側の差分が出ていないこと**も毎回確認する。

```sh
terraform apply   # 差分ゼロを確認後のみ。no-op で state とコードの整合を確定（本番値は変えない）
```

## 日常運用

### 設定変更（US2・コードレビュー経由）

```sh
cd iac
# auth0.tf を編集 → plan で差分（その変更のみ）を確認 → PR レビュー → apply
terraform plan
terraform apply
```

コンソールでのサイレントな手動変更は避け、変更はコード＋ PR で行う。

### ドリフト検知と還流（US3）

定期的に `terraform plan` を実行し、コード外（コンソール手動）の変更を**ドリフトとして検知**する。
検知したら、意図した変更ならコード（`auth0.tf` / contracts）に反映し、意図しないものは `apply` で revert する
（再度 `plan` が 0 changes に戻ることを確認）。

## 完了の確認（受け入れ）

- `terraform plan` が 0 changes（SC-001）。`plan` に recreate（`-/+`）が無い。
- claude.ai → wine-record 接続が再ログイン・再同意なしで動作（`client_id`・`audience` 不変・SC-002）。
- リポジトリに機密 literal（client_secret・M2M token）が無い（`git grep` で 0 件・SC-005）。
- 本ファイルの手順だけで別運用者が再現できる（SC-006）。
