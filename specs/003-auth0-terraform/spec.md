# 機能仕様: Auth0 設定の Terraform 管理（IaC 化）

**フィーチャーブランチ**: `003-auth0-terraform`

**作成日**: 2026-06-23

**ステータス**: Draft

**入力**: ユーザーの説明: "Auth0 の MCP コネクタ OAuth 認証に必要なテナント設定（API/リソースサーバー、Application/クライアント、テナント設定、許可ポリシー）を Terraform で宣言的に管理する。現状 002 で手動・リポジトリ管理外だった Auth0 構成を iac/ 配下の Terraform に取り込み、terraform plan で差分なし（既存の本番テナント状態と一致）を達成する。client secret 等の機密は state/変数経由で安全に扱い、リポジトリに literal を置かない。既存の Vercel 用 iac/（HCP backend・workspace wine_records）と整合させる。"

## ユーザーシナリオとテスト *(必須)*

この機能の「ユーザー」は、本プロジェクトのインフラを保守する開発者／運用者である。価値は、
002 で手動設定（コンソール操作）だったため失われていた **再現性・監査性・ドリフト検知** を取り戻すことにある。

### ユーザーストーリー 1 - 既存 Auth0 構成を差分ゼロでコードに取り込む (優先度: P1)

運用者として、稼働中の本番 Auth0 テナントの設定（API／リソースサーバー、コネクタ用 Application、
許可ポリシー）をコードで表現し、`terraform plan` が**現状に対して差分なし（no changes）**になる状態にしたい。
これにより、動いている claude.ai 接続を一切壊さずに「コードを単一の真実源」に昇格できる。

**この優先度の理由**: 本機能の中核価値。002 で手動・管理外だった構成をコード化する出発点であり、
ここが成立しなければ以降の変更管理・ドリフト検知も成り立たない。かつ「本番を壊さない」制約が最も重い。

**独立したテスト**: 取り込み後に `terraform plan` を実行して 0 changes を確認し、同時に claude.ai →
wine-record の OAuth 接続が（再ログイン・再同意なしで）従来どおり動作することを確認すれば、単独で価値が検証できる。

**受け入れシナリオ**:

1. **前提** 本番テナントに 002 で手動構築した API・Application・ポリシーが存在し、claude.ai 接続が稼働中, **操作** 現状をコードに取り込み `terraform plan` を実行, **結果** 「0 changes（差分なし）」が報告される
2. **前提** 取り込み完了後, **操作** claude.ai から wine-record コネクタの既存ツールを呼ぶ, **結果** 再認証を求められず従来どおり成功する（client_id・audience が変わっていない）
3. **前提** 取り込み対象に provider が管理できない設定が含まれる, **操作** 取り込みを試みる, **結果** 管理対象外の設定が「管理外」として明示的に文書化され、残りはコード化されて plan 差分なしになる

---

### ユーザーストーリー 2 - 設定変更をコードレビュー経由で安全に行う (優先度: P2)

運用者として、Auth0 設定の変更（例: コールバック URL の追加、ポリシー調整）を**コード編集 → plan → apply**で行い、
変更内容を PR で事前レビューできるようにしたい。コンソールでの「サイレントなクリック変更」をなくす。

**この優先度の理由**: 取り込み（US1）が済んだ後の継続的価値。変更が監査可能・差し戻し可能になり、
002 のような「何をどう変えたら直ったか不明」な状態を防ぐ。

**独立したテスト**: 管理下の設定を1つコードで変更 → `terraform plan` がその変更だけを差分として示す →
`apply` 後に本番テナントへ反映される、を確認すれば単独で検証できる。

**受け入れシナリオ**:

1. **前提** 構成がコード管理下にある, **操作** Application のコールバック URL を1つコードに追加して plan, **結果** その1件の追加のみが差分として表示される
2. **前提** 変更を apply 済み, **操作** Auth0 コンソールで該当設定を確認, **結果** コードどおりに反映されている
3. **前提** 変更 PR を作成, **操作** レビュアーが diff を見る, **結果** どの設定がどう変わるかが plan 出力／HCL diff から判別できる

---

### ユーザーストーリー 3 - 設定ドリフトを検知して還流する (優先度: P3)

運用者として、テナントに対する**コード外（コンソール手動）の変更**を `terraform plan` で検知し、
意図しないドリフトに気づいてコードへ還流（reconcile）できるようにしたい（原則 VI の機械的検証）。

**この優先度の理由**: ガバナンスの継続性。コード化の価値は「逸脱を検知できる」ことで完成する。
緊急対応で一時的に手動変更したケースを、恒久状態として放置しないための仕組み。

**独立したテスト**: コンソールで管理下の設定を1つ手動変更 → `terraform plan` がその差分（ドリフト）を表示 →
コードに反映するか revert するかを選べる、を確認すれば単独で検証できる。

**受け入れシナリオ**:

1. **前提** 構成がコード管理下で plan 差分なし, **操作** コンソールで管理下の設定を手動変更してから plan, **結果** その手動変更がドリフトとして差分表示される
2. **前提** ドリフトを検知, **操作** コードを現状に合わせて更新（または apply で revert）, **結果** 再度 plan が差分なしに戻る

---

### エッジケース

- **provider 非対応設定**: Auth0 Terraform provider が管理できない設定（002 で決定打だった `subject_type_authorization.user.policy`、`resource_parameter_profile` 等が provider バージョンで未対応の場合）はどう扱うか? → コード化できない設定は「管理外」として理由とともに文書化し、「単一の真実源」の主張を誇張しない（FR-007）。
- **稼働中アプリの破壊的変更**: 取り込み／apply が既存 Application や API を destroy→recreate すると `client_id`／`client_secret`／`audience` が変わり、稼働中の claude.ai 接続が壊れる。これを起こしてはならない（FR-006）。
- **テナント全体設定の波及**: `Default Audience`・`Resource Parameter Compatibility Profile` はテナント全体に効く。テナント `bingo-next.jp.auth0.com` は他用途と共有のため、これらはコード管理対象から外し「管理外（手動）」として文書化する（FR-003）。コード化するのは wine-record 固有の API・Application に限定する。
- **state 内の機密**: Auth0 Application の `client_secret` は state に平文で入りうる。state の保管とコミット除外を誤ると漏洩する（FR-005）。
- **Terraform 実行資格情報**: Terraform が Auth0 Management API を叩くための M2M 資格情報が失効・未設定だと plan/apply が失敗する（前提に記載）。

## 要件 *(必須)*

### 機能要件

- **FR-001**: Auth0 の API（リソースサーバー）の構成—Identifier（= audience）、署名アルゴリズム、`allow_offline_access`、ユーザー許可ポリシー（`subject_type_authorization.user.policy`）—をコードで表現し、本番に対して `terraform plan` が差分なしになること (MUST)
- **FR-002**: コネクタ用 Auth0 Application（first-party Regular Web App）の構成—コールバック URL（`https://claude.ai/api/mcp/auth_callback`）、グラント種別（authorization_code・refresh_token）、アプリ種別、`is_first_party`—をコードで表現すること (MUST)
- **FR-003**: テナント全体に効く設定（`Resource Parameter Compatibility Profile`、`Default Audience`）は、**本機能の Terraform 管理対象に含めない**（テナント `bingo-next.jp.auth0.com` は他プロジェクトと共有のため、コード管理すると他用途へ波及するリスクがある）。これらは「管理外（手動設定）」として、現在の値・設定理由・変更時の注意を `iac/` のドキュメントに明記すること (MUST)
- **FR-004**: Auth0 の構成は `iac/` 配下に置き、既存の Vercel 構成と同じ HCP リモートバックエンド／ワークスペース運用と整合すること（state・実行・認証情報の扱いを一貫させる） (MUST)
- **FR-005**: 機密（Auth0 Application の `client_secret`、Terraform 実行用の Management API 資格情報）はリポジトリに literal を置かず、変数経由で注入し、state はリモート暗号化バックエンドで保持してローカル state をコミットしないこと (MUST)
- **FR-006**: 取り込み・apply は、稼働中の claude.ai 接続が依存する既存 Application／API を destroy→recreate してはならない。`client_id`・`audience` は不変を保つこと（既存リソースの import で取り込む） (MUST)
- **FR-007**: Auth0 Terraform provider が管理できない設定は、「どの設定を・なぜ管理外とするか」を `iac/` のドキュメントに明記すること（コード化範囲を正直に示す） (MUST)
- **FR-008**: 初回セットアップ（既存リソースの import 手順、Terraform 実行用 Management API 資格情報の用意、plan/apply の実行方法）が `iac/` のドキュメントに記載され、別の運用者が再現できること (MUST)

### 主要エンティティ *(機能がデータを扱う場合に記載)*

- **Auth0 API（リソースサーバー）**: wine-record の保護対象。Identifier が MCP の `audience`。署名・offline_access・ユーザー許可ポリシーを持つ。`AUTH0_AUDIENCE` env と一致する必要がある。
- **Auth0 Application（コネクタ用クライアント）**: claude.ai が OAuth に使う first-party クライアント。`client_id`/`client_secret`・コールバック URL・グラント種別を持つ。稼働中接続が依存するため不変性が重要。
- **テナント設定**: テナント全体に効く設定（Default Audience、Resource Parameter Compatibility Profile）。blast radius が機能スコープを左右する。
- **Terraform state / ワークスペース**: 構成の現状を保持。機密を含みうるため HCP（リモート・暗号化）で管理。既存 Vercel 構成と共存。

## 成功基準 *(必須)*

### 測定可能な成果

- **SC-001**: 取り込み後、本番テナントに対する `terraform plan` が **0 changes（差分なし）** を報告する（コードが現実と一致）。
- **SC-002**: 取り込み〜apply の全工程を通じて、claude.ai → wine-record の OAuth 接続が**再ログイン・再同意なしに従来どおり動作**する（`client_id`・`audience` 不変）。
- **SC-003**: コード管理下の設定を1つ変更したとき、`terraform plan` が**その変更のみ**を差分として示し、意図しない他の差分を含まない。
- **SC-004**: コード外（手動）でテナント設定を1つ変更すると、次の `terraform plan` がその**ドリフトを差分として検知**する。
- **SC-005**: リポジトリ内に機密値（`client_secret`・Management API トークン等）の literal が**存在しない**（全文検索で 0 件）。
- **SC-006**: 別の運用者が、コード＋ドキュメント化された初回手順のみで（文書化された bootstrap を除きコンソール操作なしに）構成を再現でき、動作する接続に到達できる。

## 前提

- Auth0 Terraform provider（`auth0/auth0`）と HCP（Terraform Cloud）バックエンドが利用可能で、既存 Vercel 構成と同じワークスペース運用に載せられる。
- Terraform から Auth0 を操作するための Management API 資格情報（専用 M2M アプリの client_id/secret/domain）は、bootstrap として用意し、HCP ワークスペース変数等で安全に注入する（リポジトリに置かない）。bootstrap 用 M2M アプリ自体をコード管理対象に含めるかは plan フェーズで判断する。
- 稼働中の claude.ai コネクタが使っている `client_secret` は原則ローテーションしない（接続維持のため）。Application リソースは管理下に置きつつ、稼働中シークレットを破壊しない扱いとする。
- 本機能のスコープは Auth0 のみ。Vercel 構成（既存）は変更しない。アプリ（`src/`）コードの変更も伴わない（env の値も変わらない）。
- テナント `bingo-next.jp.auth0.com` は他プロジェクトと共有。よってテナント全体設定（Default Audience・Resource Parameter Compatibility Profile）はコード管理せず、wine-record 固有の API・Application のみを Terraform スコープとする（FR-003）。
- 002 の `research.md` D9・`quickstart.md` ステップ1 に記録された「効いた構成」が、コード化すべき正の状態（target state）である。
