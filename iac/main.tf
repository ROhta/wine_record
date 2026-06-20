# wine-record の Vercel プロジェクト。
#
# 既存プロジェクト（手動作成済み）を terraform import して宣言的に管理する（手順は iac/README.md）。
#
# 方針:
# - Deployment Protection（Vercel Authentication / SSO）は **維持**する（standard_protection_new）。
#   Vercel エッジ層で「チーム rohta のメンバー認証」を強制し、未認証のリクエストはアプリに届かない。
#   ※この結果、claude.ai のリモート MCP コネクタはプレーン HTTPS では /mcp に到達できない。
#     claude.ai から使う場合は別途、Protection Bypass トークンかアプリ層認証が必要（README 参照）。
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

  # Deployment Protection を維持（現状の standard_protection_new を明示）。
  # 省略すると null（保護解除）へ動く恐れがあるため、現状値を明示して no-op にする。
  vercel_authentication = {
    deployment_type = "standard_protection_new"
  }
}
