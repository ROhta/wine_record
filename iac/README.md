# iac/ — Vercel を Terraform で管理（HCP backend）

wine-record の Vercel プロジェクト設定を宣言的に管理する。State は HCP Terraform（リモート）。

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
