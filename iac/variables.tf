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
# **import 時のみ**設定する。既定は空文字＝import ブロックは無効（imports.tf の for_each で gate）。
# これにより日常運用・ドリフト検知など import 不要の run では値設定が不要（毎回要求されない）。
# 値は HCP workspace の Terraform 変数、または gitignore 済み *.tfvars で与える。

variable "auth0_resource_server_id" {
  description = "取り込む既存 Auth0 API（リソースサーバー）の内部 ID。`auth0 api get resource-servers` の `id`、またはダッシュボードの API 設定で確認。import 時のみ設定（空なら import 無効）"
  type        = string
  default     = ""
}

variable "auth0_connector_client_id" {
  description = "取り込む既存 connector Application の client_id（claude.ai の Advanced settings / Auth0 ダッシュボードの Client ID）。import 時のみ設定（空なら import 無効）。機密ではない（client_secret とは別）"
  type        = string
  default     = ""
}
