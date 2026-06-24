variable "vercel_team" {
  description = "Vercel チーム slug"
  type        = string
  default     = "rohta"
}

variable "github_repo" {
  description = "Vercel プロジェクトに接続する GitHub リポジトリ（owner/repo 形式）"
  type        = string
  default     = "ROhta/wine_record"
}

variable "production_branch" {
  description = "本番デプロイをトリガーするブランチ"
  type        = string
  default     = "main"
}

# --- Auth0 import 用（config-driven import の id。非機密＝識別子。client_secret とは別物） ---
# 値は HCP workspace の Terraform 変数、または gitignore 済み *.tfvars で与える（既定なし＝必須）。

variable "auth0_resource_server_id" {
  description = "取り込む既存 Auth0 API（リソースサーバー）の内部 ID。`auth0 api get resource-servers` の `id`、またはダッシュボードの API 設定で確認。import ブロックで使用"
  type        = string
}

variable "auth0_connector_client_id" {
  description = "取り込む既存 connector Application の client_id（claude.ai の Advanced settings / Auth0 ダッシュボードの Client ID）。import ブロックで使用。機密ではない（client_secret とは別）"
  type        = string
}
