# config-driven import（Terraform 1.5+）。`terraform import` CLI を打たずに、
# `terraform plan` / `terraform apply` が既存の Auth0 リソースを state に取り込む。
#
# 使い方（運用者・本番）:
# 1. var.auth0_resource_server_id / var.auth0_connector_client_id を設定する
#    （HCP workspace の Terraform 変数、または gitignore 済み *.tfvars。いずれも非機密＝識別子）。
#    - resource server id: `auth0 api get resource-servers` の該当 API の `id`。
#    - client_id: claude.ai の Advanced settings / Auth0 ダッシュボードの Client ID。
# 2. `terraform plan` で「import される 2 リソース」＋設定差分を確認する。
#    差分（特に recreate `-/+`）が出たら auth0.tf を本番に合わせ、**差分ゼロまで apply しない**。
#    （recreate は auth0.tf の lifecycle.prevent_destroy=true がエラーで止める＝安全側）。
# 3. plan が「import のみ・changes なし」になったら `terraform apply` で取り込みを実行する。
#
# これらの import ブロックは取り込み後も**残してよい**（idempotent。取り込み済みなら no-op で、
# state を失っても plan/apply で自動的に再取り込みされる＝再現性 SC-006）。不要なら apply 成功後に
# 削除してもよい。

import {
  to = auth0_resource_server.wine_record_api
  id = var.auth0_resource_server_id
}

import {
  to = auth0_client.connector
  id = var.auth0_connector_client_id
}
