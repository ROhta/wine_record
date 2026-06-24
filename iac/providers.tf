# Vercel プロバイダ。
# 認証は環境変数 VERCEL_API_TOKEN（HCP ワークスペースに sensitive な環境変数として登録）。
# トークンはリポジトリにも tfvars にも置かない。
provider "vercel" {
  team = var.vercel_team
}

# Auth0 プロバイダ（US 003・MCP コネクタ OAuth のテナント設定を管理）。
# 認証は環境変数 AUTH0_DOMAIN / AUTH0_CLIENT_ID / AUTH0_CLIENT_SECRET（provider が標準で読む）。
# これは Terraform 実行用の Management API M2M アプリの資格情報で、HCP ワークスペースに
# sensitive 環境変数として登録する。**claude.ai が使う connector の client_secret とは別物**。
# リポジトリにも tfvars にも置かない（憲章 セキュリティ節）。
provider "auth0" {}
