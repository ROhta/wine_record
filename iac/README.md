# iac/ — Vercel を Terraform で管理（HCP backend）

wine-record の Vercel プロジェクト設定を宣言的に管理する。State は HCP Terraform（リモート）。

目的: Cloudflare ホスティングから Vercel に移行し、Blob / Upstash と合わせて Vercel に一元管理する。
`record-wine` の MCP サーバー（Express + Streamable HTTP）を Vercel でホストする。

## 管理対象

| リソース | 内容 |
| --- | --- |
| `vercel_project.wine_record` | プロジェクト設定。git 接続（main=本番 / その他=preview）、`framework=node`、`node_version=24.x`、**Deployment Protection 維持（`vercel_authentication.deployment_type = "standard_protection_new"`）** |

### 管理しないもの（意図的）

- **`UPSTASH_*` 環境変数**: Vercel の Upstash 統合がオーナー。統合のトークン自動ローテーションを
  壊さないため Terraform では管理しない。
- **デプロイ成果物**: git push による自動デプロイに委ねる（`terraform apply` でデプロイはしない）。

## セキュリティ（Deployment Protection は維持）

`vercel_authentication = standard_protection_new` により、Vercel エッジ層で「チーム rohta の
メンバー認証」を強制する。未認証のリクエストはアプリ（`/mcp`）に届かない。

注意: この保護があるため、**claude.ai のリモート MCP コネクタはプレーン HTTPS では `/mcp` に
到達できない**（SSO ログインを通過できないため）。claude.ai から利用する場合は、別途いずれかが必要:

- **Protection Bypass トークン**（`x-vercel-protection-bypass` ヘッダ。コネクタが任意ヘッダを
  送れる場合）、または
- **アプリ層認証**（Express に Bearer 検証等を実装し、その上で Deployment Protection を緩める）。

どちらを採るかは Phase 3 で別途検討する（現状は保護を維持し、公開 authless にはしない）。

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
