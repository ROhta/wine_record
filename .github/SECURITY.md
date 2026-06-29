# セキュリティポリシー

wine_record は、ラベル写真からワインを記録するリモート MCP サーバー（Node/TypeScript・Express + Streamable HTTP・Vercel ホスト・Auth0 OAuth・Upstash Vector）です。本書はこのリポジトリで実施しているセキュリティ対策の**索引**です。各対策の正本は README / `iac/README.md` / `specs/` 側に置き、ここからリンクします（記述の二重管理による乖離を避けるため）。

## 脆弱性の報告

- このリポジトリは **GitHub Private Vulnerability Reporting** を有効化しています。脆弱性は **Security タブ →「Report a vulnerability」** から非公開で報告してください。
- **公開 Issue / PR / ディスカッションに脆弱性の詳細を書かないでください**（本リポジトリは public です）。
- 個人プロジェクトのため、対応はベストエフォートです。再現手順・影響範囲・該当箇所を添えていただけると助かります。

## 対象範囲

- 本番は **単一デプロイ**（Vercel: `/<...>/mcp`、OAuth で保護された公開エンドポイント）です。リリースタグによるバージョン管理はしておらず、**最新の `main`** が常にサポート対象です。
- スコープ: 認証/認可、入力検証、シークレットの取り扱い、依存サプライチェーン、CI、インフラ（IaC）。

---

## 実施中のセキュリティ対策

### 1. 認証・認可（アプリ層 OAuth）

- `/mcp` は **Auth0 による OAuth 2.0** で保護。Bearer アクセストークン（JWT）を `express-oauth2-jwt-bearer` で検証し、**未認証/無効は依存を構築せず `401 + WWW-Authenticate` で fail-closed**。
- **RFC 9728**（Protected Resource Metadata）・**RFC 8707**（`resource` パラメータ）に対応し、claude.ai のリモートコネクタがプレーン HTTPS で接続できる。
- 認証ゲートは `AUTH0_ISSUER_BASE_URL` / `AUTH0_AUDIENCE` が**両方設定されたときのみ有効**（ローカル開発では OFF）。
- Auth0 テナント設定は Terraform 管理（下記 6）。`prevent_destroy` で `client_id`/`audience` を不変に保ち、接続を壊さない。
- 正本: [README「Claude から使う」](../README.md#claude-から使うリモートコネクタoauth-認証付き) / [`iac/README.md`（Auth0）](../iac/README.md) / [`specs/002-mcp-oauth-auth/`](../specs/002-mcp-oauth-auth/)。

### 2. 入力検証・最小副作用

- 入力検証は **`validateRecordInput` に集約**（`name`/`color` 必須、`*Terms` は当該 color の JSA 語彙内のみ、`zod` スキーマ）。語彙外はサーバー側で拒否。
- `record_wine` の `imageUrl` は**許可した自ストレージの https（ホスト完全一致）のみ受理**する fail-closed。
- 書き込み（upsert）は **明示承認後に呼ぶ `record_wine` のみ**。`preview_record` / `get_jsa_taxonomy` / `search_wines` は副作用なし（read-only）。
- 正本: [README「セキュリティ」](../README.md#セキュリティ)。

### 3. HTTP 層

- [Helmet](https://helmetjs.github.io/) でセキュアヘッダを既定適用（`app.use(helmet())`）。
- 通信は HTTPS（Vercel）。サーバーは**ステートレス**（Streamable HTTP）。

### 4. シークレット・資格情報の管理

- シークレット（Upstash トークン等）は**環境変数管理**。値はログ・エラーに出さず**フィールド名のみ**出力。
- `.env` は gitignore（テンプレートの `.env.example` のみ commit）。`*.tfvars` も gitignore。
- Terraform 実行用の資格情報（`VERCEL_API_TOKEN` / `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET`）は **HCP workspace の sensitive 環境変数**で管理。**リポジトリ・tfvars・チャットに値を貼らない**。
- Upstash の接続情報は **Vercel の Upstash 統合がオーナー**（トークンの自動ローテーションを壊さないため Terraform 管理外）。
- connector の `client_secret`、Terraform 実行用 M2M の `client_secret` は**別物**（混同しない）。Terraform は connector secret を宣言・`output` しない。
- リポジトリに機密 literal を置かない（`specs/003` の受け入れ基準 SC-005: `git grep` で 0 件）。
- 正本: [`iac/README.md`（Auth0・「2 つの secret を混同しないこと」）](../iac/README.md)。

### 5. シークレット漏洩の防止（GitHub）

- **Secret scanning 有効**＋ **Push protection 有効**（秘密を含む push をコミット時にブロック）。
- **Dependabot alerts** および **Dependabot security updates** 有効（既知の脆弱性に対する自動修正 PR）。

### 6. 依存サプライチェーン

- **Dependabot version updates**（[`.github/dependabot.yml`](dependabot.yml)）: npm / GitHub Actions / Terraform の 3 エコシステム。グループ化（1 エコシステム = 1 PR）・`cooldown`（新リリースの待機）・`labels: dependencies` で運用。
- **GitHub Actions は commit SHA で固定**（リポジトリポリシー `sha_pinning_required`）。Dependabot は SHA とバージョンコメントを併せて更新し pin 形式を維持。
- `npm ci`（lockfile ベースの再現性あるインストール）。
- **厳格な型付け**: `@tsconfig/strictest` + `typescript-eslint`（型レベルの不正を CI で検出）。
- 正本: [`.github/workflows/ci.yml`](workflows/ci.yml) / [`.github/dependabot.yml`](dependabot.yml)。

### 7. CI・変更管理

- **CI**（[`.github/workflows/ci.yml`](workflows/ci.yml)）: `permissions: contents: read`（**最小権限**）、`concurrency` で旧ジョブをキャンセル、品質ゲート `typecheck` / `lint` / `format:check` / `test` / `build` を push・PR で実行。
- **pre-commit フック**（husky + lint-staged）: コミット時に `eslint --fix` + `prettier` を適用。
- 変更は **PR 経由・レビュー（GitHub Copilot code review）** で取り込む運用（※下記「制約」も参照）。

### 8. インフラ（IaC）

- Vercel プロジェクト設定と Auth0 テナント設定を **Terraform で宣言的に管理**（`iac/`）。State は **HCP Terraform（リモート・暗号化）**。ローカル state（`*.tfstate`）は gitignore。
- 重要リソースに `lifecycle { prevent_destroy = true }` を設定し、誤った destroy/recreate を機械的に防止。
- **ドリフト検知**: `terraform plan` を恒常的に「0 changes」に保ち、コンソールでのサイレントな手動変更を検知（憲章 原則 VI）。
- Vercel エッジ層の Deployment Protection は**意図的に無効**（`none`）にし、保護の責務をアプリ層 OAuth に一元化（二重ゲート回避）。
- 正本: [`iac/README.md`](../iac/README.md) / [`specs/003-auth0-terraform/`](../specs/003-auth0-terraform/)。

---

## 現状の制約・今後の強化候補

正直性のため、**まだ enforce できていない/整備中**の項目を明記します。

- **`main` ブランチ保護は未設定**。PR + レビューは運用慣行であり、サーバー側で強制されてはいません（必須レビュー・必須ステータスチェックは今後の候補）。
- **SAST は未整備**。`.semgrep/guardian.yml` は現状**空のプレースホルダで CI に未配線**です（Semgrep Guardian 連携はプラットフォーム側で別途動作しうるが、本リポジトリ内の設定としては有効化されていません）。
- Secret scanning の **validity checks / non-provider patterns は無効**（必要に応じ有効化を検討）。
- US3（ラベル画像の永続保存）は defer 中。再導入時は画像ストレージのアクセス制御を別途設計します。

---

最終更新は git 履歴を参照してください。本書の内容に齟齬を見つけた場合も、上記「脆弱性の報告」または通常の Issue/PR で指摘してください。
