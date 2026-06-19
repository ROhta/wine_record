# クイックスタート / 検証ガイド: ワインの記録

記録フローが端から端まで動くことを検証する手順（実装の詳細は tasks.md と実装フェーズへ）。

## 前提

- Node.js 24 / TypeScript（`@tsconfig/strictest`）
- 環境変数（`.env`、リポジトリには含めない）:
  - `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`
  - オブジェクトストレージ資格情報（R2 もしくは Vercel Blob）
- Upstash Vector インデックスは埋め込みモデル `BAAI/bge-m3`（dense・1024次元・Free）で作成済み（research.md R1）
- `data/jsa-taxonomy.json` が用意済み（JSA 表現の構造化データ）

## セットアップ

```bash
npm install
cp .env.example .env   # 値を埋める
npm test               # TDD: 先に失敗するテスト → 実装 → グリーン
npm run dev            # リモート MCP サーバー（Streamable HTTP）を起動
```

## 接続

- Claude モバイルアプリにカスタムコネクタとして MCP サーバー URL を登録（まず Claude を主対象）。
- Codex は後追いで同様に登録し、差分を検証する（R5 のリスク）。

## 検証シナリオ（spec の受け入れシナリオに対応）

1. **US1 基本記録**: ラベル写真を提示 → 確認ウィジェットに名前/生産者/産地/年/輸入業者が
   事前入力される → 誤読を修正して承認 → `record_wine` が `wineId` を返す →
   保存済みデータを取得して値が一致する。
2. **US1 承認ゲート**: 承認せず離脱 → 永続化されていないことを確認（SC-005）。
3. **US2 表現タップ選択**: `get_jsa_taxonomy` の語彙が外観/香り/味わいで提示される →
   複数タップ選択 → 記録に反映される → 自由入力手段が無いことを確認（FR-005）。
4. **US3 画像永続化**: `get_upload_url` で署名 URL 取得 → 画像を直接アップロード →
   `imageUrl` 付きで保存 → 後から記録詳細で画像を取得できる。
5. **異常系**: 判読不能ラベル（部分抽出）/ NV ワイン / 画像アップロード失敗時に
   基本記録は成立しつつ画像欠落が通知される、を確認。

## 参照

- データ構造: [data-model.md](./data-model.md)
- ツール契約: [contracts/mcp-tools.md](./contracts/mcp-tools.md)
- 技術決定: [research.md](./research.md)
