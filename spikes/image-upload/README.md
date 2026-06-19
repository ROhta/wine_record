# [SPIKE] T012: 画像アップロード経路（R2 署名付き PUT）の検証

> 捨てコード前提のスパイク。`spikes/` は lint/build/test 対象外。

## 殺したい未知数

Cloudflare R2 で「**署名付き PUT URL 発行 → 直接アップロード → 公開 URL で再取得**」が
無料枠で成立するか（`get_upload_url`(T035) / `imageStore`(T034) の前提）。

## ⚠️ 重要: widget ギャップ（先に理解してください）

元の T012 は「最小ウィジェットで写真選択 → PUT」でしたが、**MCP Apps ウィジェットは
claude.ai リモート HTTP で描画されません**（research.md R5 / T022a）。さらに MCP の
ツール入力は JSON のみで画像バイトを運べません。したがって **「チャット添付画像 → R2」を
widget 無しで運ぶ綺麗な経路は現状ありません**。

→ 本スパイクは **ストレージ機構（署名付き PUT 往復）だけ**を検証します。これが PASS でも、
US3 の「ユーザーがラベル画像をアップロードする UX」は widget が使えるようになるまで未解決のままです
（機構を ready にしておく価値はある）。

## あなたの準備（Cloudflare R2）

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) → R2 → バケット作成（例: `wine-labels`）。
2. **公開アクセスを有効化**: バケット設定で「Public Development URL（r2.dev）」を有効化、
   またはカスタムドメインを接続。これが `R2_PUBLIC_BASE_URL` になる（例: `https://pub-xxxx.r2.dev`）。
3. **API トークン作成**: R2 → 「Manage API Tokens」→ Object Read & Write 権限のトークンを作成。
   - `Access Key ID` と `Secret Access Key` を控える。
   - Account ID はダッシュボード URL / R2 概要で確認。
4. `.env`（リポジトリ直下・`.gitignore` 済み）に追記:
   ```
   R2_ACCOUNT_ID=xxxxxxxx
   R2_ACCESS_KEY_ID=xxxxxxxx
   R2_SECRET_ACCESS_KEY=xxxxxxxx
   R2_BUCKET=wine-labels
   R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
   ```
   （US1 検証で入れたダミー R2 値があれば実値に置き換える）

## 実行

```bash
node --env-file=.env --import tsx spikes/image-upload/run.ts
```

## 合格基準（PASS）

- 署名付き PUT URL が発行できる
- その URL へ直接 PUT してアップロードできる（HTTP 2xx）
- `R2_PUBLIC_BASE_URL/<key>` で再取得でき、バイトサイズが一致する

投入したテストオブジェクト（`spike-t012/` プレフィックス）は終了時に削除します。

## 失敗パターンと示唆

| 症状 | 示唆 |
|---|---|
| PUT が 403 / SignatureDoesNotMatch | API トークン権限不足、または Content-Type 不一致。トークンを Object R/W に |
| 公開取得が 401/403 | バケットの公開アクセス未設定。r2.dev かカスタムドメインを有効化し `R2_PUBLIC_BASE_URL` を合わせる |
| presign で endpoint エラー | `R2_ACCOUNT_ID` 誤り（endpoint は `https://<account>.r2.cloudflarestorage.com`） |

## 記録先

機構が PASS でも、UX ギャップ（widget 不在）は research.md R5 の保留事項。
本スパイク結果は Issue #20（T012）/ #4 にコメント。US3(#7) の前提として参照する。
