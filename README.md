# wine_record

ラベル写真から飲んだワインを記録するリモート MCP サーバー（Node/TypeScript・Express + Streamable HTTP・Vercel ホスト・Auth0 OAuth・Upstash Vector）。

## ドキュメント

リポジトリ固有の AI エージェント向け指示は [`.apm/instructions/`](.apm/instructions) に集約している。これらは [microsoft/apm](https://github.com/microsoft/apm) によって管理され、`apm compile` で Claude Code / Codex / GitHub Copilot 向けファイル（`CLAUDE.md` / `AGENTS.md` 等）に展開される。

### instructions

| ファイル | 内容 |
| --- | --- |
| [`setup`](.apm/instructions/setup.instructions.md) | 環境構築・開発コマンド（mise / pnpm・ローカル起動・品質ゲート・Terraform） |
| [`spec-context`](.apm/instructions/spec-context.instructions.md) | Spec Kit の作業コンテキスト（最新 plan・憲章・全体設計へのポインタ。hook が自動更新） |

他リポジトリ共通の指示は共通パッケージ [`ROhta/apm-config`](https://github.com/ROhta/apm-config) から `apm install` で配信され、ローカルの `.apm/instructions/` には保持しません。これらは [microsoft/apm](https://github.com/microsoft/apm) によって管理され、`apm compile` で Claude Code / Codex / GitHub Copilot 向けファイル (`CLAUDE.md` / `AGENTS.md` / `.claude/rules/` / `.github/instructions/`) に展開されます。

### 使い方

- [セットアップ・開発](docs/guide/getting-started.md) — 起動・スクリプト・実装状況（US1/US2/US3）

### 設計・仕様

- [全体設計](docs/design/overview.md)
- [機能仕様（Spec Kit）](specs/) — 001 record-wine / 002 MCP OAuth 認証 / 003 Auth0 Terraform / 004 観点独立のワイン類似検索
- [プロジェクト原則（憲章）](.specify/memory/constitution.md)

### インフラ・運用

- [Vercel / Auth0 の Terraform 管理（HCP）](iac/README.md)

### セキュリティ

- [セキュリティポリシー](.github/SECURITY.md)

## MCP

本リポジトリ自体が、ラベル写真からワインを記録するリモート MCP サーバーである。共通 MCP パッケージは消費しない（`apm.yml` の `dependencies.mcp` は空）。提供するツールと接続方法は以下を参照。

- [MCP ツール一覧](docs/guide/mcp-tools.md)
- [Claude から使う（OAuth コネクタ）](docs/guide/connect-claude.md)
