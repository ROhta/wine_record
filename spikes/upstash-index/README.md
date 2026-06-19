# [SPIKE] T014: Upstash Vector 埋め込み経路の検証

> 捨てコード前提のスパイク。本番コードではありません（`spikes/` は lint/build/test 対象外）。

## 殺したい未知数

hosted 埋め込みモデル `openai/text-embedding-3-small` のインデックスを Upstash で作成し、
`src/storage/vectorStore.ts` と同じ **namespace 付き・data ベース（サーバー側埋め込み）**の
upsert / query / fetch が（できれば無料枠で）成立するか。

> 当初は無料の hosted `BAAI/bge-m3` 前提だったが、コンソールで提供終了（全リージョンで
> `Custom` か `openai/text-embedding-3-small` の二択）。`openai/...` に変更した。詳細は
> `specs/001-record-wine/research.md` R1。

成立しなければ「テキストを渡してサーバー側で埋め込む」前提が崩れ、
Custom インデックス + クライアント側埋め込みへの設計変更が必要になります。

## あなたの準備（アカウント側）

1. [Upstash Console](https://console.upstash.com/) で無料アカウントを作成。
2. **Vector** → **Create Index** で新規インデックスを作成。
   - **Type**: `Dense`
   - **Embedding Model**: `openai/text-embedding-3-small` を選択（← 最重要。多言語=日本語対応・1536 次元）
   - **要確認**: 選択時に **OpenAI API キー** か **支払い手段** を求められるかをチェック。
     求められたら、無料 Upstash プランのまま使えるか／OpenAI 側に課金が乗るかをここで把握する。
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

- `info()` の `dimension > 0`（text-embedding-3-small なら 1536）= 埋め込みモデル付きインデックス
- 4 つの namespace（overall / aroma / appearance / taste）への **data ベース upsert** が成功
- `fetch` で id 指定取得でき、**metadata が往復**する
- `query`（日本語テキスト）で**ヒットが返る**（順位は出力を目視確認）

スクリプトは投入したテストベクトル（`spike-t014-` プレフィックス）を**終了時に削除**します。

> 注: このスパイクが PASS でも証明できるのは**機能経路**（hosted openai 埋め込み＋namespace＋
> data ベース I/O が動く）だけ。無料枠の容量/QPS 上限や OpenAI 課金額の妥当性は別途確認する。

## 失敗パターンと示唆

| 症状 | 示唆 |
|---|---|
| `dimension=0` / data upsert で「requires dense vectors」系エラー | 埋め込みモデル無し（Custom）のインデックス。作り直して `openai/text-embedding-3-small` を選ぶ |
| インデックス作成時に課金/キー必須で詰まる | A 案（openai hosted）の前提が崩れる。research.md R1 の代替案（Custom + ローカル埋め込み）を再検討 |
| 無料枠の上限（容量/QPS）でエラー | 無料枠制約を `research.md` / `plan.md` に記録し、設計を見直す |
| query が常に 0 件 | 結果整合性待ちが不足、または namespace 不一致。`waitForIndexing` の上限を延ばす |

## このスパイクで分かった結果の記録先

重大な制約が出たら **`specs/001-record-wine/research.md` / `plan.md` を更新**してから先へ
（tasks.md フェーズ3 の方針）。問題なければ Issue #22（T014）/ #4 にコメントしてクローズ。
