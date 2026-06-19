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

契約の詳細は [`specs/001-record-wine/contracts/mcp-tools.md`](specs/001-record-wine/contracts/mcp-tools.md)。

## セットアップ

前提: Node.js 24 / npm。

```bash
npm ci
cp .env.example .env   # UPSTASH_VECTOR_REST_URL / _TOKEN を設定（画像ストレージは任意・US3 用）
npm run dev            # tsx watch で起動（既定 :3000）
```

`.env` は **Upstash の 2 変数だけ**設定すれば US1+US2 は動く（画像ストレージ変数は US3 用で任意）。
埋め込みインデックスは `BAAI/bge-m3`（dense・1024次元）で作成しておくこと（[research.md R1](specs/001-record-wine/research.md)）。

### Claude から使う（リモートコネクタ）

ローカルの `:3000` を [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 等で公開し、
その `https://.../mcp` を claude.ai の「カスタムコネクタ」に登録する。モバイル/web から
「`record_wine` ツールを使って」と伝えてラベル写真を渡す。

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

- 仕様 / 計画 / 調査 / タスク: [`specs/001-record-wine/`](specs/001-record-wine/)
- プロジェクト原則: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
- 全体設計: [`docs/superpowers/specs/2026-06-17-wine-record-design.md`](docs/superpowers/specs/2026-06-17-wine-record-design.md)
