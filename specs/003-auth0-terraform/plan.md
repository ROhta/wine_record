# 実装計画: Auth0 設定の Terraform 管理（IaC 化）

**ブランチ**: `003-auth0-terraform` | **日付**: 2026-06-24 | **仕様**: [spec.md](./spec.md)

**入力**: `/specs/003-auth0-terraform/spec.md` の機能仕様

## 概要

002 で手動・リポジトリ管理外だった Auth0 構成（claude.ai の MCP コネクタ OAuth 認証に必要な
API／リソースサーバーと first-party Application）を、既存の `iac/`（Terraform・HCP backend・
workspace `wine_records`）に **auth0/auth0 provider** で取り込み、`terraform plan` が本番に対して
**差分なし**になる状態にする。稼働中の claude.ai 接続を壊さない（`client_id`・`audience` 不変）ことが
最重要制約。テナント全体設定（Default Audience・Resource Parameter Compatibility Profile）は
共有テナントのため**コード管理外（手動・文書化）**とする。

技術的アプローチ（調査で確定。詳細は [research.md](./research.md)）:

- wine-record 固有の設定は **provider で全て管理可能**（`auth0_resource_server` の
  `subject_type_authorization`／`allow_offline_access`／`signing_alg`、`auth0_client` の
  `is_first_party`／`callbacks`／`grant_types`／`app_type`）。
- 既存リソースは **`terraform import`** で取り込み、HCL を本番実体に合わせて**反復的に**収束させる
  （差分ゼロになるまで `apply` しない）。
- `client_secret` は provider の `auth0_client` リソースで**書き込み不可**（読み取りは data source 経由）。
  resource 管理では secret を触らないため、apply による secret ローテーション経路が無い。`output` せず、
  state は機密を含みうる前提で HCP 暗号化保護＋ローカル非コミットとする。
- 接続維持の機構は「**force-new／不変属性（特に `is_first_party`）を本番実体に pin**」。
- Terraform 実行用の Auth0 Management API 資格情報（M2M）は**手動ブートストラップ・管理外**。
  Terraform に自分の足場（自身の資格情報）を管理させない（apply で自己ロックアウトを防ぐ）。

## 技術コンテキスト

**言語/バージョン**: Terraform HCL（`required_version >= 1.9`・既存 `iac/` に合わせる）

**主要な依存**: `auth0/auth0` provider（`~> 1.0`・`client_secret` 書き込み不可化＝v1 系。`subject_type_authorization`
対応版を lock で固定）、既存の `vercel/vercel ~> 5.3`、HCP Terraform Cloud backend

**ストレージ**: Terraform state（HCP・リモート・暗号化）。ローカル state はコミットしない

**テスト**: `terraform validate` ＋ `terraform plan` 差分ゼロ（＝本番実体に対する検証オラクル・原則 VI）
＋ 実機スモーク（claude.ai 接続が `client_id`／`audience` 不変で従来どおり動作）。アプリのロジック単位は
追加しないため単体テストフレームワークは不使用

**対象プラットフォーム**: HCP Terraform Cloud（org `rohta`／workspace `wine_records`）／
Auth0 テナント `bingo-next.jp.auth0.com`（他用途と共有）

**プロジェクト種別**: infrastructure-as-code（`src/` のアプリコードは不変。env 値も不変）

**性能目標**: 該当なし（設定管理）

**制約**: import 後に `plan` 差分ゼロ（SC-001）／稼働中の Application・API を destroy→recreate しない
（SC-002・`client_id`・`audience` 不変）／リポジトリに機密 literal を置かない（SC-005）／
共有テナントのためテナント全体設定はコード管理しない（FR-003）

**規模/範囲**: Auth0 リソース 2 個（`auth0_resource_server` 1 ＋ `auth0_client` 1）＋ provider／backend
配線 ＋ `iac/README.md` の手順追記。小規模

## 憲章チェック

*GATE: Phase 0 の調査前に通過しなければならない。Phase 1 の設計後に再チェックする。*

| 原則 | 評価 | 根拠 |
|---|---|---|
| I. MCP 契約の明確さ | 該当なし | MCP ツール・契約・`src/` は不変。本機能はインフラ設定のみ |
| II. テスト駆動 | 該当なし（vacuously satisfied） | ロジック単位を追加しない宣言的設定。テストオラクルは原則 VI の `terraform plan` 差分ゼロで、本番実体に対する検証＝モックベースの単体テストより強い。テスト対象を作るためのラッパー作成はしない（原則 V） |
| III. 厳格な型安全 | 該当なし | TypeScript 非変更。Terraform 変数型で担保 |
| IV. 意味的/構造的の分離 | 該当なし | 検索機能に無関係 |
| V. 縦切り・YAGNI | ✅ 準拠 | import→差分ゼロの薄い縦切り。投機的抽象なし。スコープを API+Application に限定、テナント設定は管理外、M2M は管理外 |
| VI. インフラのコード化（IaC） | ✅ 本機能が体現 | wine-record 固有 Auth0 設定を `iac/` の Terraform 単一真実源に。準拠は `terraform plan` 差分ゼロで機械検証。手動変更（テナント設定・M2M）は管理外として文書化 |
| セキュリティと機密情報 | ✅ 準拠 | `client_secret` は resource で書き込み不可（data source のみ）＝apply が触らない（ローテーションしない）。state は機密を含みうる前提で **HCP 暗号化リモート state** により保護し、`client_secret` を出力しない・ローカル state を非コミット。M2M 資格情報は HCP sensitive env（リポジトリに置かない）。M2M 資格情報と connector の client_secret は**別物**として混同しない |

**設計後の再評価**: Phase 1 完了後も上記は不変（新たな違反なし）。詳細は本ファイル末尾の再評価メモ参照。

## プロジェクト構成

### ドキュメント (この機能)

```text
specs/003-auth0-terraform/
├── plan.md              # このファイル
├── research.md          # Phase 0 の出力（provider 能力・import・接続維持・機密・M2M・スコープ）
├── data-model.md        # Phase 1 の出力（Auth0 エンティティと管理属性・管理外設定）
├── quickstart.md        # Phase 1 の出力（import→収束→検証の手順。差分ゼロまで apply しない規律）
├── contracts/
│   └── auth0-target-state.md   # Phase 1 の出力（収束オラクル＝本番の目標属性値）
└── tasks.md             # Phase 2（/speckit-tasks で作成）
```

### ソースコード (リポジトリルート)

```text
iac/
├── versions.tf      # 変更: required_providers に auth0/auth0 を追加（HCP backend は既存）
├── providers.tf     # 変更: auth0 provider ブロックを追加（既存 vercel は不変）
├── variables.tf     # 変更（最小）: 必要なら auth0_domain 等。資格情報は env 注入で変数化しない
├── main.tf          # 不変（vercel_project）
├── auth0.tf         # 新規: auth0_resource_server（API）＋ auth0_client（コネクタ用 first-party）
├── outputs.tf       # 不変または最小追加（client_secret 等の機密は出力しない）
└── README.md        # 変更: Auth0 の import 手順・M2M ブートストラップ・管理外設定（テナント設定）を追記
```

**構造の決定**: 既存 `iac/` の単一 Terraform 構成（HCP workspace `wine_records`）に Auth0 を**追加**する
（別ディレクトリ・別ワークスペースに分けない）。本規模では単一ワークスペースが妥当。
**トレードオフ**: 1 ワークスペース＝1 回の `terraform apply` が Vercel・Auth0 両 provider を評価するため、
Auth0 の収束作業時も plan に Vercel の差分が出ないことを必ず確認する（plan 全体を読む運用とする）。

## 複雑さの追跡

> 憲章チェックに違反なし。記入不要。
