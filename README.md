# wine_record

ラベル写真から飲んだワインを記録するリモート MCP サーバー（Node/TypeScript・Express + Streamable HTTP・Vercel ホスト・Auth0 OAuth・Upstash Vector）。

## ドキュメント

### 使い方

- [セットアップ・開発](docs/guide/getting-started.md) — 起動・スクリプト・実装状況（US1/US2/US3）
- [Claude から使う（OAuth コネクタ）](docs/guide/connect-claude.md)
- [MCP ツール一覧](docs/guide/mcp-tools.md)

### 設計・仕様

- [全体設計](docs/design/overview.md)
- [機能仕様（Spec Kit）](specs/) — 001 record-wine / 002 MCP OAuth 認証 / 003 Auth0 Terraform / 004 観点独立のワイン類似検索
- [プロジェクト原則（憲章）](.specify/memory/constitution.md)

### インフラ・運用

- [Vercel / Auth0 の Terraform 管理（HCP）](iac/README.md)

### セキュリティ

- [セキュリティポリシー](.github/SECURITY.md)
