---
description: wine_record の環境構築・開発コマンド
applyTo: "**/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts,.env.example,*.tf,*.tfvars}"
---

# 環境構築・開発

詳細は [`docs/guide/getting-started.md`](../../docs/guide/getting-started.md)。要点のみ:

## 前提

- ツールは [mise](https://mise.jdx.dev/) で管理する（`mise.toml` が SSoT: **node / pnpm / terraform / apm**）。パッケージマネージャは **pnpm**（npm ではない）。
- mise はシェルで有効化（`mise activate`）するか、各コマンドを `mise exec -- <cmd>` で実行する。
- 必要アカウント: [Upstash](https://upstash.com/)（Vector）、本番ホスティング [Vercel](https://vercel.com/)、Terraform バックエンド [HCP Terraform](https://cloud.hashicorp.com/)。

## ローカル起動

```bash
mise trust && mise install   # node / pnpm / terraform / apm を導入
pnpm install
cp .env.example .env   # UPSTASH_VECTOR_REST_URL / _TOKEN を設定（画像ストレージ変数は US3 用・任意）
pnpm dev               # tsx watch（既定 :3000）
```

- 埋め込みインデックスは `BAAI/bge-m3`（dense・1024 次元）で作成しておく。
- `AUTH0_*` 未設定なら認証 OFF で起動する。claude.ai から OAuth 付きで使う手順は [`docs/guide/connect-claude.md`](../../docs/guide/connect-claude.md)。

## 品質ゲート（コミット前・CI と同一）

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm test
pnpm run build
```

`pre-commit` フック（husky + lint-staged）がコミット時に `eslint --fix` + `prettier` を自動適用する。

## インフラ（Terraform）

- Vercel / Auth0 を `iac/` で Terraform 管理（State は HCP・リモート暗号化）。手順は [`iac/README.md`](../../iac/README.md)。
- 変更は「コード編集 → `terraform plan` で差分確認 → PR → `terraform apply`」。`plan` を 0 changes に保つ。
