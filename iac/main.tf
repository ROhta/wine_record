# wine-record の Vercel プロジェクト。
#
# 既存プロジェクト（手動作成済み）を terraform import して宣言的に管理する（手順は iac/README.md）。
#
# 方針:
# - Deployment Protection（Vercel Authentication / SSO）を無効化（none）する。
#   claude.ai のリモート MCP コネクタは /mcp にプレーン HTTPS で到達する必要があり、
#   SSO 保護があると到達できないため authless にする（憲章 Security のトレードオフは README 参照）。
# - git 接続により、main への push で本番デプロイ、その他ブランチで preview デプロイを行う。
# - UPSTASH_* 環境変数は Vercel の Upstash 統合がオーナーのため、ここでは管理しない
#   （統合によるトークン自動ローテーションを壊さないため。in-line environment も使わない）。
resource "vercel_project" "wine_record" {
  name         = "wine-record"
  framework    = "node"
  node_version = "24.x"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  }

  # Deployment Protection を解除（authless）。これが無いと claude.ai が /mcp に到達できない。
  vercel_authentication = {
    deployment_type = "none"
  }
}
