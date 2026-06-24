# クイックスタート / 検証ガイド: Auth0 設定の Terraform 管理

本機能が「既存 Auth0 構成を壊さずコード化し、`terraform plan` 差分ゼロにする」ことを証明する手順。
実装の詳細（HCL の中身）は tasks.md と実装フェーズに属する。ここは検証・運用ガイド。

## 前提

- 既存 `iac/`（Terraform ≥1.9・HCP backend org `rohta`／workspace `wine_records`・Vercel 管理済み）。
- Auth0 テナント `bingo-next.jp.auth0.com`（他用途と共有）。本番に 002 で構築した API・first-party
  Application・テナント設定が存在し、claude.ai 接続が**稼働中**。
- 控えておく本番の識別子: API の **resource server ID**、connector の **client_id**、API **Identifier**（audience）。
  （`auth0 api get resource-servers` / `auth0 api get clients` 等で取得）

## ステップ 1: M2M ブートストラップ（手動・管理外）

Terraform が Auth0 Management API を操作するための M2M アプリを**手動で 1 つ**用意する（コード管理しない）:

- Auth0 → Applications → Machine to Machine、Management API を認可。スコープは最小限
  （`read:clients` `update:clients` `read:resource_servers` `update:resource_servers`）。
- 発行された **domain / client_id / client_secret** を HCP workspace `wine_records` の **sensitive 環境変数**
  として登録: `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET`（provider が標準で読む）。
- ⚠️ この M2M 資格情報は **claude.ai が使う connector の `client_secret` とは別物**。混同しない。
- ⚠️ この M2M アプリを Terraform で管理しない（apply 中の自己ロックアウトを防ぐ）。`iac/README.md` に
  権限・保管先・再発行手順を文書化する。

## ステップ 2: provider／backend 配線

`iac/versions.tf` の `required_providers` に `auth0/auth0`（`~> 1.0`・`subject_type_authorization` 対応版を
lock で固定）を追加し、`iac/providers.tf` に `provider "auth0" {}`（資格情報は env 経由）を追加する。

```sh
cd iac && terraform init   # auth0 provider を取得し lock を更新
```

## ステップ 3: 既存リソースの import（config-driven import・`terraform import` 不要）

新規作成ではなく **import** で取り込む（`create` は client_id/audience を変え接続を壊す）。
`iac/imports.tf` の **import ブロック**が `plan`/`apply` で取り込むため、CLI の `terraform import` は打たない。

取り込み対象 ID を変数で与える（**import 時のみ**。非機密。HCP workspace の Terraform 変数 or gitignore 済み
`*.tfvars`）。両変数は既定が空で import ブロックは `for_each` で gate されるため、**import 不要の run では設定不要**:

```hcl
# 例: iac/import.auto.tfvars（*.tfvars は commit されない）
auth0_resource_server_id  = "<既存 API の内部 ID>"   # auth0 api get resource-servers の id
auth0_connector_client_id = "<connector の client_id>" # claude.ai Advanced settings / Auth0 ダッシュボード
```

以降はステップ 4 の `terraform plan`（収束）→ `apply`（取り込み実行）で取り込まれる。取り込み後は変数を空に戻すと
import ブロックが無効化され、日常運用がノーフリクションになる。

## ステップ 4: 差分ゼロへ収束（★最重要の安全規律）

import 直後の `plan` はほぼ確実に差分が出る（provider 既定 vs 本番設定）。これを**HCL を本番方向にのみ編集**して消す。
収束オラクルは [contracts/auth0-target-state.md](./contracts/auth0-target-state.md)。

```sh
terraform plan    # 差分と、特に recreate（-/+）の有無を確認
```

- **`plan` が緑（0 changes）になるまで `terraform apply` を実行しない。** 収束途中の apply / create が
  稼働中の API・client を書き換え／再作成して接続を壊す最大要因（research.md D2）。
- `auth0_client` に **recreate（`-/+ ... forces replacement`）** が出たら、原因属性（特に `is_first_party`）を
  本番値（`true`）に pin して消す。`client_id` を変えてはならない。
- Vercel 側の差分が出ていないことも plan 全体で確認する（単一ワークスペースのため・research.md D7）。
- 本番の実体が contracts と食い違う場合は、**本番（import 結果）を正**として HCL を合わせ、差異を
  contracts に反映する。

```sh
# plan が 0 changes になったら、初めて state とコードの整合を確定（実体は変えない）
terraform apply   # 差分ゼロなら no-op。ここで初めて「コードが正」を宣言できる
```

## ステップ 5: 受け入れ検証

- **SC-001**: `terraform plan` が **0 changes**。
- **SC-002**: claude.ai → wine-record コネクタを開き、既存ツール（例 `get_jsa_taxonomy`）を呼ぶ。
  **再ログイン・再同意なしに従来どおり成功**し、`client_id`・`audience` が不変であること。
- **SC-003**: 管理下の設定を1つコードで変更（例 `callbacks` に 1 URL 追加）→ `plan` がその1件のみを差分表示
  → 確認後 `apply` → 反映。検証後は元に戻す。
- **SC-004（ドリフト検知）**: Auth0 コンソールで管理下の設定を1つ手動変更 → `terraform plan` がドリフトを
  差分表示 → `apply` で revert（または HCL に反映）。
- **SC-005**: `git grep` 等でリポジトリに機密 literal（client_secret・M2M token）が**無い**ことを確認。
- **SC-006**: 別運用者が `iac/README.md` の手順（M2M ブートストラップ＋ import）だけで構成を再現できる。

## トラブルシュート

| 症状 | 対処 |
|---|---|
| `plan` に `auth0_client` の recreate（`-/+`） | force-new 属性（`is_first_party` 等）を本番値に pin。apply しない |
| import 後 `subject_type_authorization` に差分 | HCL に `user { policy = "allow_all" }` を明示（002 の決定打） |
| provider が `subject_type_authorization` を知らない | lock の provider バージョンが古い。対応版へ更新して `terraform init -upgrade` |
| apply が Vercel 側も変更しようとする | 単一ワークスペースのため。Vercel 差分の原因を解消してから（Auth0 と無関係に） |
| 認証エラー（Management API） | `AUTH0_DOMAIN`/`CLIENT_ID`/`CLIENT_SECRET`（HCP env）と M2M スコープを確認 |

## 完了の定義

- contracts/auth0-target-state.md の合格条件（C1/C2 差分ゼロ・recreate なし・C3 管理外）を満たす。
- claude.ai 接続が `client_id`・`audience` 不変で稼働継続（SC-002）。
- リポジトリに機密 literal なし。`iac/README.md` に import・M2M ブートストラップ・管理外設定が文書化済み。
