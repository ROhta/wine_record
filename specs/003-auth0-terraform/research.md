# Phase 0 調査: Auth0 設定の Terraform 管理（IaC 化）

計画の前提を確定するための技術調査。一次情報は Auth0 Terraform provider 公式ドキュメント
（Context7 `/auth0/terraform-provider-auth0`・High reputation）、002 の `research.md` D9 /
`quickstart.md`（実機で効いた構成）、既存 `iac/`（Vercel 構成）。

## D1. provider が wine-record 固有設定を管理できるか（最重要・確定）

- **Decision**: `auth0/auth0` provider で wine-record 固有の Auth0 設定は**すべて管理可能**。
  - `auth0_resource_server`（API）: `identifier`、`signing_alg`、`allow_offline_access`、
    そして **002 の決定打 `subject_type_authorization`** を nested block で対応:
    ```terraform
    subject_type_authorization {
      user   { policy = "allow_all" }
      client { policy = "require_client_grant" }
    }
    ```
  - `auth0_client`（Application）: `is_first_party`、`app_type`、`callbacks`、`grant_types`、
    `oidc_conformant`、`token_endpoint_auth_method` を対応。
- **Rationale**: Context7 で provider の `resource_server` / `client` スキーマを確認し、必要属性の
  存在を一次情報で確証（憶測回避）。002 で「ダッシュボードに出ないことがある」と苦労した
  `subject_type_authorization.user.policy = allow_all` も provider 引数として明示できる。
- **Alternatives considered**:
  - data source（`auth0_resource_server` / `auth0_client`）で参照のみ → 「管理」にならず却下
    （変更・ドリフト検知ができない）。
  - 一部だけコード化 → 「単一真実源」の主張が崩れるため、wine-record 固有は全てコード化する。

## D2. 取り込み戦略（import → 反復収束。差分ゼロまで apply しない）

- **Decision**: 既存リソースを **`terraform import`** で取り込み、HCL を本番実体へ**反復的に**寄せて
  `plan` が差分ゼロになるまで収束させる。
  - `terraform import auth0_resource_server.wine_record_api "<API_ID>"`
  - `terraform import auth0_client.connector "<CLIENT_ID>"`
- **Rationale**: 新規 `create` すると `client_id`・`audience` が変わり稼働中接続が壊れる（SC-002 違反）。
  import + 収束なら本番を一切変えずにコード化できる。import 直後の `plan` はほぼ確実に差分が出る
  （provider のデフォルトと本番設定の差）。これを「HCL を本番に合わせる」方向の編集だけで消す。
- **運用安全規律（本機能の TDD アナログ）**: **収束中は HCL を本番方向にのみ編集し、`plan` が緑
  （差分ゼロ）になるまで `terraform apply` を絶対に実行しない**。収束途中の `apply`／`create` が
  稼働中の API・client を書き換え／再作成して接続を壊す最大要因。`contracts/auth0-target-state.md` を
  収束オラクル（目標属性値）として参照する。
- **Alternatives considered**: いきなり `apply` で「コードを正」とする → 本番を壊すため却下。

## D3. 接続維持の機構（force-new／不変属性の pin）

- **Decision**: 稼働中接続が依存する **`client_id`・`audience` を不変に保つ**ため、destroy→recreate を
  誘発する属性を本番実体に **pin** する。特に **`is_first_party` は不変**（002 で PATCH 不可を実証し、
  新規 first-party アプリを作り直した）。HCL に `is_first_party = true`・`app_type = "regular_web"` を
  本番どおり明示し、recreate 差分（`-/+`）を出さない。
- **Rationale**: SC-002（再ログイン・再同意なし）を満たすには client を作り直さないことが必須。
  import 後の最初の `plan` に `forces replacement` が出たら、該当属性を本番値に合わせて消す
  （消えるまで `apply` しない・D2）。
- **secret について**: provider の新しい版で **`client_secret` は `auth0_client` リソースから削除**され、
  `auth0_client` データソース経由でのみ読める。よって resource 管理は secret を**書き換えない**
  （`rotate_secret` のような明示操作をしない限りローテーションは起きない）。secret を `output` しない限り
  state にも露出しない。→ secret ローテーションは設計上の経路外。脅威は recreate のみ（上記で対処）。
- **Alternatives considered**: client を作り直して env を更新 → claude.ai 側の再接続が必要になり SC-002
  違反。却下。

## D4. 機密と state の取り扱い

- **Decision**:
  - connector の `client_secret` は **output しない**（resource からも削除済みのため state にも書かれない）。
  - Terraform 実行用の Auth0 **Management API 資格情報**（M2M の domain/client_id/client_secret）は
    HCP ワークスペースの **sensitive 環境変数**として注入（`AUTH0_DOMAIN`・`AUTH0_CLIENT_ID`・
    `AUTH0_CLIENT_SECRET`。provider が標準で読む）。リポジトリ・tfvars に literal を置かない。
  - state は HCP（リモート・暗号化）。`iac/.gitignore` でローカル state を除外（既存方針を踏襲）。
- **Rationale**: 憲章セキュリティ節（Terraform state は機密を含みうる／変数注入／ローカル state 非コミット）。
  既存 Vercel が `VERCEL_API_TOKEN` を HCP sensitive env で扱う方式と一貫。
- **混同回避**: Terraform 実行用 M2M の資格情報と、claude.ai が使う connector の `client_secret` は**別物**。
  前者は Terraform→Auth0 Management API 用、後者は claude.ai→Auth0 OAuth 用。ドキュメントで明確に分ける。

## D5. provider 認証と M2M ブートストラップ（手動・管理外）

- **Decision**: Terraform が Auth0 Management API を操作するための M2M アプリ（Management API 権限:
  最低限 read/update on clients・resource-servers）は**手動で 1 つブートストラップ**し、その資格情報を
  HCP sensitive env に登録する。この M2M アプリ自体は **Terraform 管理対象に含めない（管理外）**。
- **Rationale**: Terraform に「自分の足場（自身がアクセスに使う資格情報）」を管理させると、apply の途中で
  それを無効化して**自己ロックアウト**しうる。テナント設定と同じ「管理外」バケツに置き、`iac/README.md` に
  現在値・権限・再発行手順を文書化する。「後で import する」もしない。
- **Alternatives considered**: M2M を Terraform 管理 → ロックアウトリスクで却下。

## D6. テナント全体設定はコード管理外（共有テナント）

- **Decision**: `Default Audience`・`Resource Parameter Compatibility Profile`（いずれも `auth0_tenant`
  のテナント全体設定）は**コード管理しない**。`iac/README.md` に「管理外」として現在値・設定理由
  （claude.ai が `resource` を送る＝compatibility profile 必須／`audience` 経路の保険＝default_audience）・
  変更時の注意を記す。
- **Rationale**: テナント `bingo-next.jp.auth0.com` は他プロジェクトと共有（ユーザー確認済み）。
  `auth0_tenant` をコード管理すると他用途へ波及する（blast radius）。wine-record 固有の
  `auth0_resource_server`・`auth0_client` とは別リソースなので綺麗に分離できる。
- **Alternatives considered**: テナント設定もコード化 → 共有テナントで他プロジェクトに影響し却下。

## D7. ワークスペース構成（Vercel と同一 workspace）

- **Decision**: Auth0 を既存の HCP workspace `wine_records`（Vercel と同じ）に**追加**する。
- **Rationale**: 本規模では単一ワークスペースが運用簡潔。provider・backend 配線を再利用できる。
- **トレードオフ（明示）**: 1 ワークスペース＝1 回の `apply` が Vercel・Auth0 両 provider を評価する。
  Auth0 の収束作業中も plan に Vercel 側の差分が出ないことを毎回確認する（plan 全体を読む）。
- **Alternatives considered**: Auth0 専用ワークスペース／ディレクトリ分離 → 小規模には過剰。将来 Auth0 の
  リソースが大幅に増えたら再検討。

## 未解決（NEEDS CLARIFICATION）

なし。テナント共有スコープ（D6）は specify フェーズで確定済み（共有 → テナント設定は管理外）。
import 時に万一 `is_first_party` 等で解消不能な force-new 差分が出た場合のみ、実装フェーズで再検討する
（その場合も「本番を壊さない」を最優先に、HCL を本番値へ寄せて解消を試みる）。
