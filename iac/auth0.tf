# wine-record の Auth0 設定（MCP コネクタ OAuth・US 003）。
#
# 002 で手動構築した「効いた構成」をコード化する。値の正本は
# specs/003-auth0-terraform/contracts/auth0-target-state.md（収束オラクル）。
#
# 取り込み方針（既存リソースを壊さない）:
# - 新規 create ではなく **terraform import** で取り込む（手順は iac/README.md / quickstart.md）。
#   create すると client_id / audience が変わり、稼働中の claude.ai 接続が壊れる。
# - import 後の plan はほぼ差分が出る。**HCL を本番実体に合わせる方向にのみ編集**し、
#   差分ゼロになるまで apply しない。下記の値が本番と食い違う場合は、本番（import 結果）を正として
#   ここを合わせ、contracts に反映する。
# - 稼働中接続が依存する client_id / audience は不変。force-new 属性（特に is_first_party）を
#   本番値に pin し、lifecycle.prevent_destroy で recreate を機械的に防ぐ（SC-002 / FR-006）。
#
# 管理外（ここで宣言しない・iac/README.md に文書化）:
# - テナント全体設定（Default Audience・Resource Parameter Compatibility Profile）= 共有テナントのため。
# - Terraform 実行用 M2M アプリ = 自己ロックアウト回避のため。
# - connector の client_secret = provider の新版で auth0_client リソースから書き込み不可
#   （読み取りは auth0_client データソース）。ここでは宣言・output しない。

# API（リソースサーバー）。Identifier = MCP の audience（AUTH0_AUDIENCE と一致）。
resource "auth0_resource_server" "wine_record_api" {
  # name は本番の現名に合わせる（import 後に plan で確認・調整）。
  name        = "wine-record MCP"
  identifier  = "https://wine-record-rohta.vercel.app/mcp"
  signing_alg = "RS256"

  allow_offline_access = true

  # 002 の決定打。allow_all でないと authorization_code でも client-grant 必須になり全クライアント拒否。
  subject_type_authorization {
    user {
      policy = "allow_all"
    }
    client {
      policy = "require_client_grant"
    }
  }

  # identifier は audience として固定。誤った recreate を防ぐ。
  lifecycle {
    prevent_destroy = true
  }
}

# コネクタ用 Application（claude.ai が OAuth に使う first-party クライアント）。
# client_id は computed・不変。client_secret は宣言しない（resource で書き込み不可・output しない）。
resource "auth0_client" "connector" {
  # name は本番の現名に合わせる（import 後に plan で確認・調整）。
  name = "wine-record claude connector"

  # is_first_party は不変属性（002 で PATCH 不可を実証）。true を pin して recreate を出さない。
  is_first_party  = true
  app_type        = "regular_web"
  oidc_conformant = true

  callbacks = ["https://claude.ai/api/mcp/auth_callback"]

  grant_types = [
    "authorization_code",
    "refresh_token",
  ]

  # クライアント認証方式（client_secret_post）と client_secret は本イテレーションでは管理しない。
  # provider v1.x では token_endpoint_auth_method が auth0_client から削除され、別リソース
  # auth0_client_credentials（secret も統べる）が必要。connector の secret 管理面に踏み込むと
  # SC-002 リスクが上がるため、import 実証後の follow-up に回す。宣言しなければ差分も出ない
  # （本番は 002 で設定した client_secret_post のまま）。

  # client_id を変える recreate を機械的に防ぐ（稼働中接続の維持・SC-002）。
  lifecycle {
    prevent_destroy = true
  }
}
