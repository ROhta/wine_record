# wine-record の Vercel プロジェクト。
#
# 既存プロジェクト（手動作成済み）を terraform import して宣言的に管理する（手順は iac/README.md）。
#
# 方針:
# - Deployment Protection（Vercel エッジ層 SSO）は **無効化**する（none）。
#   保護の責務はアプリ層 OAuth（Auth0・US 002）に移行済み: /mcp は Bearer トークン検証で保護され、
#   未認証は 401 + WWW-Authenticate を返す。エッジ SSO を残すと claude.ai がプレーン HTTPS で
#   /mcp に到達できず（SSO ログインを通過できない）二重ゲートになるため外す。
#   ※ これにより /mcp は「OAuth で保護された公開エンドポイント」になる（authless ではない）。
# - git 接続により、main への push で本番デプロイ、その他ブランチで preview デプロイを行う。
# - UPSTASH_* / AUTH0_* 環境変数は Vercel 側（統合・ダッシュボード）がオーナーのため、ここでは管理しない。
resource "vercel_project" "wine_record" {
  name         = "wine-record"
  framework    = "node"
  node_version = "24.x"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  }

  # Deployment Protection を無効化（アプリ層 OAuth へ移行済み）。
  vercel_authentication = {
    deployment_type = "none"
  }
}
