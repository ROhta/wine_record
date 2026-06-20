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
