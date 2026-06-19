# [SPIKE] T012: 画像アップロード経路（Vercel Blob）の検証

> 捨てコード前提のスパイク。`spikes/` は lint/build/test 対象外。

## 殺したい未知数

Vercel Blob で「**アップロード → 公開 URL で再取得**」が無料枠（Hobby）で成立するか
（`get_upload_url`(T035) / `imageStore`(T034) の前提）。

> R2 は無料枠でも**カード登録必須**だったため、design の代替候補だった **Vercel Blob** に切替
> （research.md R3）。Vercel Hobby は 1GB/月・**非商用のみ**・カード不要の見込み。

## ⚠️ 重要: widget ギャップ（先に理解してください）

MCP Apps ウィジェットは claude.ai リモート HTTP で描画されず（research.md R5 / T022a）、
MCP ツール入力も JSON のみで画像バイトを運べません。したがって **「チャット添付画像 → ストレージ」を
widget 無しで運ぶ綺麗な経路は現状ありません**。

→ 本スパイクは **ストレージ機構（アップロード→公開取得）だけ**を検証します。PASS でも、US3 の
「ユーザーがラベル画像をアップロードする UX」は widget が使えるようになるまで未解決のままです
（機構を ready にしておく価値はある）。

## あなたの準備（Vercel Blob）

1. [Vercel](https://vercel.com/) に GitHub 等でサインイン（**Hobby はカード不要の見込み**）。
2. ダッシュボード → **Storage** → **Create Database** → **Blob** を作成（例 `wine-labels`）。
3. 作成した Blob ストアの設定で **`BLOB_READ_WRITE_TOKEN`** をコピー
   （プロジェクト連携不要。トークン文字列があればよい）。
4. `.env`（リポジトリ直下・`.gitignore` 済み）に追記:
   ```
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx
   ```

## 実行

```bash
node --env-file=.env --import tsx spikes/image-upload/run.ts
```

## 合格基準（PASS）

- `put`（access: public）でアップロードでき、公開 URL が返る
- その公開 URL で再取得でき、バイトサイズが一致する

投入したテスト Blob（`spike-t012/` プレフィックス）は終了時に削除します。

## 失敗パターンと示唆

| 症状 | 示唆 |
|---|---|
| 401 / Forbidden | トークン誤り or 権限不足。Read-Write トークンを使う |
| put でエラー | `@vercel/blob` の `access: 'public'` 必須。token を明示渡し |
| 公開 URL が 404 | アップロード失敗 or URL 取り違え。`put` の戻り `url` を使う |

## 記録先

機構が PASS でも UX ギャップ（widget 不在）は research.md R5 の保留事項。
結果は Issue #20（T012）/ #4 にコメント。ストレージ選定（R2→Vercel Blob）は research.md R3 を更新。
