# wine_record

AI エージェント（Claude モバイル / web）を通じて、ラベル写真から飲んだワインを記録するリモート MCP サーバー。

ラベル画像を接続先 LLM の vision で読み取り、ユーザーが内容を確認・修正して承認すると、
[Upstash Vector](https://upstash.com/) に構造化保存する。外観・香り・味わいは日本ソムリエ協会（JSA）の
定義済み語彙から選んで付与する。

## 現状

| ストーリー | 内容 | 状態 |
|---|---|---|
| US1 | ラベル写真 → 基本情報（名前/生産者/産地/年/輸入業者）を確認して保存 | ✅ 稼働 |
| US2 | 外観・香り・味わいを JSA 語彙から選択して付与 | ✅ 稼働（テキストベース） |
| US3 | ラベル画像の永続保存 | ⏸ defer |

> **widget について**: 確認・タップ選択・画像アップロードは当初 MCP Apps ウィジェットで実装予定だったが、
> claude.ai のリモート HTTP（モバイルが使える唯一の接続形態）では現状ウィジェットが描画できない
> （[研究記録 R5](specs/001-record-wine/research.md)）。そのため確認はテキストフロー、US2 の表現選択も
> テキストベース（語彙外はサーバー検証で拒否）で実現している。US3 の画像アップロードと
> タップ選択 UI は widget が安定対応され次第 再導入する。

## ツール（MCP）

| ツール | 役割 | 副作用 |
|---|---|---|
| `preview_record` | 下書きを正規化・検証し「保存される内容」をテキストで返す（保存前確認） | なし |
| `record_wine` | 確認済みの記録を Upstash Vector へ保存（明示承認後にのみ呼ぶ） | upsert |
| `get_jsa_taxonomy` | `color`（white/red）別・カテゴリ別の JSA 表現語彙を返す | なし |
| `search_wines` | 記録済みワインを観点別（外観/香り/味わい）に意味検索し、産地・ヴィンテージ・色で構造的に絞り込む（読み取り専用・004） | なし |

契約の詳細は [`specs/001-record-wine/contracts/mcp-tools.md`](specs/001-record-wine/contracts/mcp-tools.md)、[`specs/004-wine-aspect-search/contracts/search-wines-tool.md`](specs/004-wine-aspect-search/contracts/search-wines-tool.md)。

## セットアップ

前提: Node.js 24 / npm。

```bash
npm ci
cp .env.example .env   # UPSTASH_VECTOR_REST_URL / _TOKEN を設定（画像ストレージは任意・US3 用）
npm run dev            # tsx watch で起動（既定 :3000）
```

`.env` は **Upstash の 2 変数だけ**設定すれば US1+US2 は動く（画像ストレージ変数は US3 用で任意）。
埋め込みインデックスは `BAAI/bge-m3`（dense・1024次元）で作成しておくこと（[research.md R1](specs/001-record-wine/research.md)）。

### Claude から使う（リモートコネクタ・OAuth 認証付き）

本番は **Vercel にホスト**（`https://wine-record-rohta.vercel.app/mcp`）し、**Auth0 による OAuth 認証**付きで
claude.ai の「カスタムコネクタ」から接続する（US 002）。`/mcp` は Bearer トークン検証で保護され、
未認証は `401 + WWW-Authenticate` を返す（公開だが authless ではない）。

- 認証を有効化するサーバー側 env: `AUTH0_ISSUER_BASE_URL` / `AUTH0_AUDIENCE`（両方設定で ON、両方未設定で OFF）。
- claude.ai のコネクタ追加 → **Advanced settings** に Auth0 アプリの client_id/secret を入力 → ログイン/同意 → 接続。
- Auth0 側のセットアップ手順・ハマりどころは [`specs/002-mcp-oauth-auth/quickstart.md`](specs/002-mcp-oauth-auth/quickstart.md)。

ローカル開発では `AUTH0_*` 未設定（認証 OFF）で動かし、`:3000` を
[cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 等で公開して試すこともできる。
インフラ（Vercel プロジェクト設定）は [`iac/`](iac/) で Terraform 管理。

## スクリプト

```bash
npm run build        # tsc -p tsconfig.build.json
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run lint         # eslint
npm run format       # prettier --write
```

## セキュリティ

- シークレット（Upstash トークン等）は環境変数管理。値はログ・エラーに出さない（フィールド名のみ）。
- HTTP 層は [Helmet](https://helmetjs.github.io/) でセキュアヘッダを既定適用。
- `record_wine` の `imageUrl` は許可した自ストレージの https（ホスト完全一致）のみ受理する fail-closed。
- 入力検証は `validateRecordInput` に集約（`name`/`color` 必須・`*Terms` は当該 color の語彙内のみ）。

## ドキュメント

- 仕様 / 計画 / 調査 / タスク: [`specs/001-record-wine/`](specs/001-record-wine/)（記録機能）、[`specs/002-mcp-oauth-auth/`](specs/002-mcp-oauth-auth/)（MCP コネクタ OAuth 認証 / Auth0）
- インフラ（Vercel / Terraform・HCP）: [`iac/`](iac/)
- プロジェクト原則: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
- 全体設計: [`docs/superpowers/specs/2026-06-17-wine-record-design.md`](docs/superpowers/specs/2026-06-17-wine-record-design.md)
