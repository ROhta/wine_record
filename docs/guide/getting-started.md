# セットアップ・開発

AI エージェント（Claude モバイル / web）を通じて、ラベル写真から飲んだワインを記録するリモート MCP サーバー。ラベル画像を接続先 LLM の vision で読み取り、ユーザーが内容を確認・修正して承認すると、[Upstash Vector](https://upstash.com/) に構造化保存する。外観・香り・味わいは日本ソムリエ協会（JSA）の定義済み語彙から選んで付与する。

## 現状

| ストーリー | 内容 | 状態 |
| --- | --- | --- |
| US1 | ラベル写真 → 基本情報（名前/生産者/産地/年/輸入業者）を確認して保存 | ✅ 稼働 |
| US2 | 外観・香り・味わいを JSA 語彙から選択して付与 | ✅ 稼働（テキストベース） |
| US3 | ラベル画像の永続保存 | ⏸ defer |

> **widget について**: 確認・タップ選択・画像アップロードは当初 MCP Apps ウィジェットで実装予定だったが、claude.ai のリモート HTTP（モバイルが使える唯一の接続形態）では現状ウィジェットが描画できない（[研究記録 R5](../../specs/001-record-wine/research.md)）。そのため確認はテキストフロー、US2 の表現選択もテキストベース（語彙外はサーバー検証で拒否）で実現している。US3 の画像アップロードとタップ選択 UI は widget が安定対応され次第 再導入する。

## セットアップ

前提: [mise](https://mise.jdx.dev/)。node / pnpm / terraform / apm のバージョンは `mise.toml`（SSoT）で管理する。

```bash
mise trust && mise install   # mise.toml の node / pnpm / terraform / apm を導入
pnpm install                 # 依存をインストール
cp .env.example .env         # UPSTASH_VECTOR_REST_URL / _TOKEN を設定（画像ストレージは任意・US3 用）
pnpm dev                     # tsx watch で起動（既定 :3000）
```

- mise はシェルで有効化（`mise activate` を rc に追加）するか、各コマンドを `mise exec -- <cmd>` で実行する。
- Linux/WSL では pnpm（Node SEA バイナリ）が `libatomic.so.1` を要求することがある（`sudo apt-get install -y libatomic1`）。CI の ubuntu-latest は標準装備で不要。
- `.env` は **Upstash の 2 変数だけ**設定すれば US1+US2 は動く（画像ストレージ変数は US3 用で任意）。埋め込みインデックスは `BAAI/bge-m3`（dense・1024 次元）で作成しておくこと（[research.md R1](../../specs/001-record-wine/research.md)）。

## スクリプト

```bash
pnpm build        # tsc -p tsconfig.build.json
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run
pnpm lint         # eslint
pnpm format       # prettier --write
```
