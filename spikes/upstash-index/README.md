# [SPIKE] T014: Upstash Vector 無料枠の検証

> 捨てコード前提のスパイク。本番コードではありません（`spikes/` は lint/build/test 対象外）。

## 殺したい未知数

ホスト型 `BAAI/bge-m3` 埋め込みインデックスを **Upstash 無料枠**で作成し、
`src/storage/vectorStore.ts` と同じ **namespace 付き・data ベース（サーバー側埋め込み）**の
upsert / query / fetch が成立するか。

成立しなければ「テキストを渡してサーバー側で埋め込む」前提が崩れ、
クライアント側埋め込み（依存追加・次元固定・コスト増）への設計変更が必要になります。

## あなたの準備（アカウント側）

1. [Upstash Console](https://console.upstash.com/) で無料アカウントを作成。
2. **Vector** → **Create Index** で新規インデックスを作成。
   - **Embedding Model**: `BAAI/bge-m3` を選択（← これが最重要。多言語=日本語対応・1024 次元）
   - **Region**: 任意（個人用途なら近いリージョン）
   - **Plan**: Free
3. 作成後の詳細画面から **REST URL** と **REST TOKEN** を控える。
4. リポジトリ直下に `.env` を作成（`.gitignore` 済み。`.env.example` をコピー）し、以下を設定:
   ```
   UPSTASH_VECTOR_REST_URL=https://xxxx.upstash.io
   UPSTASH_VECTOR_REST_TOKEN=xxxxxxxx
   ```

## 実行

Node.js 24 の `--env-file` で `.env` を読み込みつつ tsx で実行:

```bash
node --env-file=.env --import tsx spikes/upstash-index/run.ts
```

または環境変数をインラインで:

```bash
UPSTASH_VECTOR_REST_URL=... UPSTASH_VECTOR_REST_TOKEN=... npx tsx spikes/upstash-index/run.ts
```

## 合格基準（PASS の条件）

スクリプトが以下を全て満たせば PASS（最後に `結論: PASS` を表示）:

- `info()` の `dimension > 0`（bge-m3 なら 1024）= 埋め込みモデル付きインデックス
- 4 つの namespace（overall / aroma / appearance / taste）への **data ベース upsert** が成功
- `fetch` で id 指定取得でき、**metadata が往復**する
- `query`（日本語テキスト）で**ヒットが返る**（順位は出力を目視確認）

スクリプトは投入したテストベクトル（`spike-t014-` プレフィックス）を**終了時に削除**します。

## 失敗パターンと示唆

| 症状 | 示唆 |
|---|---|
| `dimension=0` / data upsert で「requires dense vectors」系エラー | 埋め込みモデル無しのインデックス。作り直して `BAAI/bge-m3` を選ぶ |
| 無料枠の上限（容量/QPS）でエラー | 無料枠制約を `research.md` / `plan.md` に記録し、設計を見直す |
| query が常に 0 件 | 結果整合性待ちが不足、または namespace 不一致。`waitForIndexing` の上限を延ばす |

## このスパイクで分かった結果の記録先

重大な制約が出たら **`specs/001-record-wine/research.md` / `plan.md` を更新**してから先へ
（tasks.md フェーズ3 の方針）。問題なければ Issue #22（T014）/ #4 にコメントしてクローズ。
