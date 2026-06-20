# Vercel プロバイダ。
# 認証は環境変数 VERCEL_API_TOKEN（HCP ワークスペースに sensitive な環境変数として登録）。
# トークンはリポジトリにも tfvars にも置かない。
provider "vercel" {
  team = var.vercel_team
}
