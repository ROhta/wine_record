# config-driven import（Terraform 1.5+）。`terraform import` CLI を打たずに、
# `terraform plan` / `terraform apply` が既存の Auth0 リソースを state に取り込む。
#
# 各 import ブロックは for_each で gate し、対応する変数が**空でないときだけ有効**にする。
# これにより、import 不要の run（日常運用・ドリフト検知・無関係な auth0.tf 編集）では
# 変数を設定しなくてよい（default="" のため毎回要求されない）。import ブロックを残置しても
# idempotent（取り込み済みなら no-op）で、state を失っても変数を再設定すれば自動再取り込みできる（SC-006）。
#
# 使い方（運用者・本番）:
# 1. var.auth0_resource_server_id / var.auth0_connector_client_id を設定する（**import 時のみ**。非機密＝識別子）
#    （HCP workspace の Terraform 変数、または gitignore 済み *.tfvars）。
#    - resource server id: `auth0 api get resource-servers` の該当 API の `id`。
#    - client_id: claude.ai の Advanced settings / Auth0 ダッシュボードの Client ID。
# 2. `terraform plan` で「import される 2 リソース」＋設定差分を確認する。
#    差分（特に recreate `-/+`）が出たら auth0.tf を本番に合わせ、**差分ゼロまで apply しない**。
#    （recreate は auth0.tf の lifecycle.prevent_destroy=true がエラーで止める＝安全側）。
# 3. plan が「import のみ・changes なし」になったら `terraform apply` で取り込みを実行する。
# 4. 取り込み後は変数を空に戻してよい（import ブロックが無効化され、日常運用がノーフリクションになる）。

import {
  for_each = var.auth0_resource_server_id != "" ? toset([var.auth0_resource_server_id]) : toset([])
  to       = auth0_resource_server.wine_record_api
  id       = each.value
}

import {
  for_each = var.auth0_connector_client_id != "" ? toset([var.auth0_connector_client_id]) : toset([])
  to       = auth0_client.connector
  id       = each.value
}
