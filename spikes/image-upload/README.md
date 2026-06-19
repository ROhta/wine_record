# [SPIKE] T012: 画像アップロード経路（Vercel Blob / private）の検証

> 捨てコード前提のスパイク。`spikes/` は lint/build/test 対象外。

## 殺したい未知数

private Vercel Blob で「**アップロード → 公開URL不可 → 認証付き取得（`get`）**」が無料枠で成立するか
（`get_upload_url`(T035) / `imageStore`(T034) の前提）。

> R2 は無料枠でも**カード登録必須**だったため、design の代替候補 **Vercel Blob** に切替（research.md R3）。
> さらにラベル画像を公開に晒さない方針で **private ストア**を採用。

## private 配信モデル（重要・設計に影響）

private blob は**公開 URL で取得できない**。読み取りは `@vercel/blob` の
`get(pathname, { access: 'private' })`（トークン認証でストリーム取得）か、
`Authorization: Bearer <BLOB_READ_WRITE_TOKEN>` 付き fetch のみ。
→ 実アプリでは **`imageUrl` は公開 URL ではなく「自サーバーの認証付きルートが `get()` で配信」**する形になる。

## ⚠️ widget ギャップ

「チャット添付画像 → ストレージ」を widget 無しで運ぶ経路は claude.ai リモート HTTP では現状なし
（research.md R5）。本スパイクは **ストレージ機構のみ**を検証する（UX は widget 対応待ち）。

## 準備（Vercel Blob private ストア）

1. [Vercel](https://vercel.com/) にサインイン（Hobby・カード不要を確認済み）。
2. Storage → Create Database → **Blob**、access を **Private** で作成。
   - CLI なら `vercel blob create-store <name> --access private`。
3. その Blob ストアの **`BLOB_READ_WRITE_TOKEN`** を `.env` に設定:
   ```
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx
   ```

## 実行

```bash
node --env-file=.env --import tsx spikes/image-upload/run.ts
```

## 合格基準（PASS）

- `put(access:'private')` でアップロードできる
- 認証なし fetch は 401/403（公開 URL では取得できない＝private 確認）
- `get(access:'private')` で 200・バイト一致で取得できる

投入したテスト Blob（`spike-t012/` プレフィックス）は終了時に削除します。

## 結果（2026-06-19, PASS）

put / 公開不可(403) / 認証付き get(200・bytes一致) いずれも成立。ストレージ機構は ready。
imageUrl は自サーバー配信になる前提を research.md R3 に記録。Issue #20 / #4。
