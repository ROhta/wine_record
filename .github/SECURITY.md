# セキュリティポリシー

wine_record は、ラベル写真からワインを記録するリモート MCP サーバーです（Node/TypeScript・Express + Streamable HTTP・Vercel ホスト・Auth0 OAuth・Upstash Vector）。本書は、このリポジトリで実施しているセキュリティ対策の**索引**です。各対策の詳細（正本）は README・`iac/README.md`・`specs/` 側にあり、本書はそこへリンクします。同じ説明を二重に持って内容が食い違うのを避けるためです。

## 脆弱性の報告

- このリポジトリは **GitHub Private Vulnerability Reporting** を有効にしています。脆弱性は **Security タブ →「Report a vulnerability」** から非公開で報告してください。
- 本リポジトリは public です。**脆弱性の詳細を公開 Issue・PR・ディスカッションに書かないでください。**
- 個人プロジェクトのため、対応はベストエフォートです。再現手順・影響範囲・該当箇所を添えていただけると助かります。

## 対象範囲

- 本番は単一の公開エンドポイント（Vercel 上の `/mcp`）です。これは authless ではなく、OAuth で保護されています。リリースタグによるバージョン管理はしておらず、常に**最新の `main`** がサポート対象です。
- スコープ: 認証・認可、入力検証、シークレットの取り扱い、依存サプライチェーン、CI、インフラ（IaC）。

---

## 実施しているセキュリティ対策

### 1. 認証・認可（アプリ層 OAuth）

- `/mcp` は **Auth0 の OAuth 2.0** で保護しています。Bearer アクセストークン（JWT）を `express-oauth2-jwt-bearer` で検証し、未認証・無効なトークンは処理へ進ませず `401`（`WWW-Authenticate` ヘッダ付き）で遮断します（fail-closed）。
- **RFC 9728**（Protected Resource Metadata）と **RFC 8707**（`resource` パラメータ）に対応し、claude.ai のリモートコネクタが HTTPS のみで接続できます。
- 認証ゲートが有効になるのは、`AUTH0_ISSUER_BASE_URL` と `AUTH0_AUDIENCE` の**両方を設定したとき**だけです（ローカル開発では無効）。
- Auth0 のテナント設定は Terraform で管理しています（後述の 8）。`prevent_destroy` により `client_id` と `audience` を不変に保ち、稼働中の接続を壊しません。
- 正本: [README「Claude から使う」](../README.md#claude-から使うリモートコネクタoauth-認証付き)、[`iac/README.md`（Auth0）](../iac/README.md)、[`specs/002-mcp-oauth-auth/`](../specs/002-mcp-oauth-auth/)。

### 2. 入力検証・最小副作用

- 入力検証は **`validateRecordInput` に集約**しています（`name`・`color` は必須、`*Terms` は当該 color の JSA 語彙にある値のみ、検証は `zod` スキーマ）。語彙にない値はサーバー側で拒否します。
- `record_wine` の `imageUrl` は、許可した自前ストレージの https（ホスト完全一致）のみを受理します（fail-closed）。
- データを書き込む（upsert する）のは、明示的な承認を経て呼ぶ `record_wine` だけです。`preview_record`・`get_jsa_taxonomy`・`search_wines` は副作用のない読み取り専用です。
- 正本: [README「セキュリティ」](../README.md#セキュリティ)。

### 3. HTTP 層

- [Helmet](https://helmetjs.github.io/) でセキュアヘッダを既定で付与します（`app.use(helmet())`）。
- 通信は HTTPS（Vercel）で、サーバーはステートレス（Streamable HTTP）です。

### 4. シークレット・資格情報の管理

- シークレット（Upstash トークンなど）は環境変数で管理します。値はログやエラーに出力せず、出すのはフィールド名のみです。
- `.env` は gitignore の対象です（コミットするのはテンプレートの `.env.example` のみ）。`*.tfvars` も gitignore します。
- Terraform 実行用の資格情報（`VERCEL_API_TOKEN`・`AUTH0_DOMAIN`・`AUTH0_CLIENT_ID`・`AUTH0_CLIENT_SECRET`）は **HCP workspace の sensitive 環境変数**として管理します。**値をリポジトリ・tfvars・チャットに貼らないでください。**
- Upstash の接続情報は **Vercel の Upstash 統合が所有**します（トークンの自動ローテーションを壊さないよう、Terraform では管理しません）。
- connector の `client_secret` と、Terraform 実行用 M2M の `client_secret` は別物です（混同しないこと）。Terraform は connector の secret を宣言も `output` もしません。
- リポジトリに機密値の literal を置きません（`specs/003` の受け入れ基準 SC-005: `git grep` で 0 件）。
- 正本: [`iac/README.md`（Auth0・「2 つの secret を混同しないこと」）](../iac/README.md)。

### 5. シークレット漏洩の防止（GitHub）

- **Secret scanning** と **Push protection** を有効にしています（秘密を含む push をコミット時にブロックします）。
- **Dependabot alerts** と **Dependabot security updates** を有効にしています（既知の脆弱性に対して自動で修正 PR が作られます）。

### 6. 依存サプライチェーン

- **Dependabot version updates**（[`.github/dependabot.yml`](dependabot.yml)）で npm・GitHub Actions・Terraform の 3 エコシステムを更新します。グループ化（1 エコシステム = 1 PR）・`cooldown`（新リリースを一定期間待つ）・`labels: dependencies` を設定しています。
- **GitHub Actions は commit SHA で固定**します（リポジトリポリシー `sha_pinning_required`）。Dependabot は SHA とバージョンコメントを合わせて更新するため、pin の形式は保たれます。
- `npm ci` により、lockfile ベースで再現性のあるインストールを行います。
- **厳格な型付け**（`@tsconfig/strictest` + `typescript-eslint`）により、型レベルの誤りを CI で検出します。
- 正本: [`.github/workflows/ci.yml`](workflows/ci.yml)、[`.github/dependabot.yml`](dependabot.yml)。

### 7. CI・変更管理

- **CI**（[`.github/workflows/ci.yml`](workflows/ci.yml)）は `permissions: contents: read`（最小権限）で動作し、`concurrency` で古いジョブをキャンセルしつつ、品質ゲート（`typecheck`・`lint`・`format:check`・`test`・`build`）を push と PR で実行します。
- **pre-commit フック**（husky + lint-staged）が、コミット時に `eslint --fix` と `prettier` を適用します。
- 変更は PR 経由でレビュー（GitHub Copilot code review）を通して取り込む運用です（※下記「現状の制約」も参照）。

### 8. インフラ（IaC）

- Vercel のプロジェクト設定と Auth0 のテナント設定を **Terraform で宣言的に管理**します（`iac/`）。State は **HCP Terraform（リモート・暗号化）** に置き、ローカルの state（`*.tfstate`）は gitignore します。
- 重要なリソースには `lifecycle { prevent_destroy = true }` を設定し、誤った destroy / recreate を機械的に防ぎます。
- **ドリフト検知**として、`terraform plan` を常に「0 changes」に保つことで、コンソールでの黙示的な手動変更を検知します（憲章 原則 VI）。
- Vercel エッジ層の Deployment Protection は**意図的に無効**（`none`）にし、保護の責務をアプリ層の OAuth に一本化しています（二重ゲートを避けるため）。
- 正本: [`iac/README.md`](../iac/README.md)、[`specs/003-auth0-terraform/`](../specs/003-auth0-terraform/)。

---

## 現状の制約・今後の強化候補

正直に記すため、**まだ強制（enforce）できていない／整備中**の項目を明記します。

- **`main` ブランチ保護は未設定**です。PR とレビューは運用上の慣行であり、サーバー側で強制されてはいません（必須レビューや必須ステータスチェックは今後の候補）。
- **SAST は未整備**です。リポジトリ内に Semgrep などの設定ファイルや CI への配線はありません（Semgrep Guardian 連携はプラットフォーム側で別途動く可能性はありますが、リポジトリにコミットされた静的解析の構成は持ちません）。
- Secret scanning の **validity checks / non-provider patterns は無効**です（必要に応じて有効化を検討します）。
- US3（ラベル画像の永続保存）は defer 中です。再導入する際は、画像ストレージのアクセス制御を別途設計します。

---

最終更新の日時は git 履歴を参照してください。本書の内容に誤りや齟齬を見つけた場合も、上記「脆弱性の報告」または通常の Issue / PR でお知らせください。
