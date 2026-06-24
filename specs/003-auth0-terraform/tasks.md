---
description: "タスクリスト: Auth0 設定の Terraform 管理（IaC 化）"
---

# タスク: Auth0 設定の Terraform 管理（IaC 化）

**入力**: `/specs/003-auth0-terraform/` の設計ドキュメント
**前提**: plan.md・spec.md（必須）、research.md・data-model.md・contracts/auth0-target-state.md・quickstart.md

**テスト**: TDD のテストタスクは**作らない**。本機能はアプリのロジック単位を追加しない宣言的設定で、
憲章 原則 II は vacuous（plan.md 憲章チェック参照）。**検証オラクルは `terraform plan` 差分ゼロ＋`terraform validate`**
（＋実機スモーク）であり、各ユーザーストーリーの最後の検証タスクに埋め込む。

**実行主体の区別（重要）**: 本番 Auth0／HCP に触れる操作は**運用者（資格情報保持者）のみ**実行可能。
タスク説明の **`(運用者)`** はエージェントではなく人手の実行を示す。`(運用者)` 以外は HCL/ドキュメント作成で
エージェントが実施可能。本番に対する `import`/`plan`/`apply` は SC-002（接続維持）に直結するため慎重に。

## フォーマット: `[ID] [P?] [Story] 説明`

- **[P]**: 並列実行可能（異なるファイル・依存なし）
- **[Story]**: 属するユーザーストーリー（US1/US2/US3）。Setup/基盤/仕上げにはラベルなし

---

## Phase 1: セットアップ（provider／backend 配線）

**目的**: 既存 `iac/`（HCP workspace `wine_records`・Vercel 管理済み）に Auth0 provider を追加する。本番には触れない。

- [x] T001 [P] `iac/versions.tf` の `required_providers` に `auth0/auth0`（`~> 1.0`）を追加する（既存 `vercel/vercel ~> 5.3`・HCP backend は不変）
- [x] T002 [P] `iac/providers.tf` に `provider "auth0" {}` ブロックを追加する（資格情報は env 経由＝`AUTH0_DOMAIN`/`AUTH0_CLIENT_ID`/`AUTH0_CLIENT_SECRET`。変数化・tfvars 化しない）

---

## Phase 2: 基盤（ブロッキングな前提条件）

**目的**: いずれの terraform 操作よりも前に必要。M2M 資格情報が無いと `plan`/`import` が失敗する。

**⚠️ CRITICAL**: T003 完了まで Phase 3 以降の本番操作（import/plan）は開始できない。

- [ ] T003 (運用者) Auth0 Management API 用の M2M アプリを**手動ブートストラップ**し（最小スコープ: `read:clients`/`update:clients`/`read:resource_servers`/`update:resource_servers`）、発行された domain/client_id/client_secret を HCP workspace `wine_records` の **sensitive 環境変数**（`AUTH0_DOMAIN`/`AUTH0_CLIENT_ID`/`AUTH0_CLIENT_SECRET`）に登録する。このアプリは**管理外**（Terraform 管理に含めない＝自己ロックアウト回避）
- [x] T004 `iac/README.md` に Auth0 セクションを追記する: M2M ブートストラップ手順／**管理外設定**（テナント Default Audience・Resource Parameter Compatibility Profile）の現在値・理由・変更注意／**M2M 資格情報と connector の client_secret は別物**である旨
- [x] T005 (一部エージェント実施: `init -backend=false` で provider 取得・lock 更新済み。運用者は import 前に backend 付き `terraform init` を実行) `cd iac && terraform init` で `auth0` provider を取得し `.terraform.lock.hcl` を更新する。解決された版が `subject_type_authorization` に対応することを確認する（非対応なら `terraform init -upgrade`）

**チェックポイント**: provider 取得済み・M2M 資格情報が HCP に登録済み → import に進める

---

## Phase 3: ユーザーストーリー 1 - 既存構成を差分ゼロで取り込む（優先度: P1）🎯 MVP

**ゴール**: 稼働中の Auth0 構成（API＋Application）をコード化し、`terraform plan` を本番に対して差分ゼロにする。
接続（`client_id`/`audience`）は不変に保つ。

**独立したテスト**: `terraform plan` が 0 changes、かつ claude.ai → wine-record 接続が再ログインなしで動作する。

**収束オラクル**: [contracts/auth0-target-state.md](./contracts/auth0-target-state.md)（C1/C2）。

### 実装（HCL 作成）

- [x] T006 [US1] `iac/auth0.tf` に `auth0_resource_server.wine_record_api` を contracts C1 の目標値で記述する（`identifier`・`signing_alg=RS256`・`allow_offline_access=true`・`subject_type_authorization { user { policy="allow_all" } client { policy="require_client_grant" } }`）
- [x] T007 [US1] `iac/auth0.tf` に `auth0_client.connector` を contracts C2 の目標値で記述する（`is_first_party=true`・`app_type="regular_web"`・`callbacks=["https://claude.ai/api/mcp/auth_callback"]`・`grant_types=["authorization_code","refresh_token"]`・`oidc_conformant=true`・`token_endpoint_auth_method`。`client_secret` は記述・output しない）

### 取り込みと収束（本番操作）

- [ ] T008 [US1] (運用者) 既存 API を import する: `cd iac && terraform import auth0_resource_server.wine_record_api "<API_ID>"`
- [ ] T009 [US1] (運用者) 既存 Application を import する: `cd iac && terraform import auth0_client.connector "<CLIENT_ID>"`
- [ ] T010 [US1] (運用者＋HCL 編集) `terraform plan` を実行し、差分と recreate（`-/+`）の有無を確認する。**HCL を本番方向にのみ編集して差分ゼロへ収束**させる（`auth0.tf` を contracts に合わせる）。**差分ゼロになるまで `terraform apply` を実行しない**。`auth0_client` に recreate が出たら `is_first_party` 等の force-new 属性を本番値に pin して消す。Vercel 側に差分が出ていないことも確認する
- [ ] T011 [US1] (運用者) 差分ゼロを確認後、`terraform apply`（差分なし＝no-op）で state とコードの整合を確定する。本番の設定値は変えない

### 検証

- [ ] T012 [US1] (運用者) 受け入れ検証を行い記録する: **SC-001**（`terraform plan` が 0 changes）／**SC-002**（claude.ai で `get_jsa_taxonomy` 等を呼び、再ログイン・再同意なしに成功。`client_id`・`audience` 不変）

**チェックポイント**: US1 完了 = Auth0 構成がコード管理下・差分ゼロ・接続維持。これが MVP

---

## Phase 4: ユーザーストーリー 2 - コードレビュー経由で設定変更（優先度: P2）

**ゴール**: 設定変更を「コード編集 → plan → PR レビュー → apply」で行えることを確立・実証する。

**独立したテスト**: 管理下設定を1つ変更すると `plan` がその1件のみを差分表示し、apply で本番反映される。

**依存**: US1（リソースが管理下・差分ゼロであること）。

- [x] T013 [US2] `iac/README.md` に設定変更の運用手順を記述する（コード編集 → `terraform plan` で差分確認 → PR レビュー → `terraform apply`。差分は最小限であることを確認する）
- [ ] T014 [US2] (運用者) 実証: 管理下設定を1つ変更（例 `callbacks` に検証用 URL を1件追加）→ `plan` がその1件のみを差分表示 → `apply` → 反映確認 → 変更を元に戻す。**SC-003** を記録する

**チェックポイント**: US1＋US2 が独立して動作（取り込み＋レビュー付き変更）

---

## Phase 5: ユーザーストーリー 3 - ドリフト検知と還流（優先度: P3）

**ゴール**: コード外（コンソール手動）の変更を `terraform plan` で検知し、還流できる。

**独立したテスト**: 管理下設定をコンソールで手動変更 → `terraform plan` がドリフトを差分表示。

**依存**: US1（管理下であること）。

- [x] T015 [US3] `iac/README.md` にドリフト検知・還流の運用を記述する（定期 `terraform plan` でドリフト確認 → コードへ反映 or `apply` で revert）
- [ ] T016 [US3] (運用者) 実証: 管理下設定をコンソールで1つ手動変更 → `terraform plan` がドリフトを差分表示 → `apply` で revert（または HCL に反映して差分ゼロへ）。**SC-004** を記録する

**チェックポイント**: 全ユーザーストーリーが独立して機能

---

## Phase 6: 仕上げと横断的な関心事

**目的**: ドキュメント完成・機密非漏洩・再現性の確認。

- [x] T017 [P] `iac/README.md` を最終整備する（管理対象／管理外の一覧・別運用者向け再現手順＝**SC-006**）
- [x] T018 [P] (エージェント実施済み: `git grep` で実トークン literal 0 件を確認) 機密 literal スキャン: `git grep` 等で `client_secret`／Management API トークンの literal がリポジトリに無いことを確認する（**SC-005**）
- [x] T019 (エージェント実施済み: `terraform fmt -check` clean・`init -backend=false` 後 `terraform validate` Success) `cd iac && terraform fmt && terraform validate` を実行し、整形・構文を確認する
- [ ] T020 (運用者) [quickstart.md](./quickstart.md) の検証手順を一通り実行し、完了の定義（contracts 合格条件・接続維持・機密なし）を確認する

---

## 依存関係と実行順序

### フェーズの依存関係

- **Phase 1（セットアップ）**: 依存なし。すぐ開始可（エージェント）
- **Phase 2（基盤）**: T001/T002 の後。T003（M2M）は全本番操作をブロックする
- **Phase 3（US1）**: Phase 2 完了後。本機能の MVP
- **Phase 4（US2）・Phase 5（US3）**: US1 完了（管理下・差分ゼロ）に依存。US2 と US3 は相互独立（並列可）
- **Phase 6（仕上げ）**: 対象ストーリー完了後

### ユーザーストーリーの依存関係

- **US1 (P1)**: 基盤の後に開始。他ストーリーへの依存なし（MVP）
- **US2 (P2) / US3 (P3)**: いずれも US1 の「管理下・差分ゼロ」状態を前提とする（典型的な独立ストーリーと異なり、土台として US1 に依存）。US2 と US3 は互いに独立

### 並列化の機会

- T001・T002 は [P]（別ファイル）
- T006・T007 は同一ファイル `iac/auth0.tf` のため**並列不可**（逐次）
- import → plan → 収束 → apply（T008→T009→T010→T011）は本番操作のため**逐次**
- US2（T013/T014）と US3（T015/T016）は US1 完了後に並列可
- T017・T018 は [P]

---

## 実装戦略

### まず MVP（US1 のみ）

1. Phase 1（provider 配線）→ Phase 2（M2M ブートストラップ・init）
2. Phase 3（US1）: `auth0.tf` 作成 → import → **差分ゼロまで apply しない**収束 → 整合確定 → 検証
3. **停止して検証**: SC-001（plan 0 changes）・SC-002（接続維持）。ここまでで「手動構成のコード化」という中核価値を達成
4. US2/US3 は運用フェーズで段階的に追加

### 安全規律（再掲・最重要）

- 収束中（T010）は **HCL を本番方向にのみ編集**し、`plan` が緑になるまで `apply` しない。
- `auth0_client` の **recreate（`-/+`）を絶対に出さない**（`client_id` が変わり接続断）。force-new 属性を本番値に pin。
- 本番の実体が contracts と食い違う場合は**本番（import 結果）を正**として HCL を合わせ、差異を contracts に反映する。

## メモ

- `(運用者)` タスクは本番 Auth0／HCP 資格情報を要し、エージェントでは実行不可。HCL/ドキュメント作成タスクはエージェントが実施可能。
- 各タスク／論理単位ごとにコミットする。HCL 作成（T001/T002/T006/T007）と README（T004/T013/T015/T017）は本番操作前に PR レビュー可能。
- 任意のチェックポイントで停止し、独立に検証する。
