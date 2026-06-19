# MCP ツール契約: ワインの記録

LLM クライアントから見た契約（原則 I）。入出力は検証必須。すべて JSON。

## ツール: `get_jsa_taxonomy`

外観・香り・味わいの定義済み表現語彙を返す（タップ選択 UI の供給源）。

- **入力**: `{}`（引数なし）または `{ "category"?: "appearance" | "aroma" | "taste" }`
- **出力**:
  ```json
  {
    "appearance": ["string", "..."],
    "aroma": ["string", "..."],
    "taste": ["string", "..."]
  }
  ```
  `category` 指定時は該当カテゴリのみ返す。
- **副作用**: なし（読み取りのみ）。

## ツール: `get_upload_url`

ラベル画像をオブジェクトストレージへ直接アップロードするための、短命の署名付き
URL を発行する。

- **入力**:
  ```json
  { "contentType": "image/jpeg" | "image/png" | "image/webp" }
  ```
- **出力**:
  ```json
  {
    "uploadUrl": "https://...(署名付きPUT URL, 短命)",
    "imageUrl": "https://...(保存後に参照する公開/取得URL)",
    "expiresInSeconds": 300
  }
  ```
- **副作用**: ストレージ上にアップロード先を予約。URL は短命・単一用途。

## ツール: `record_wine`

確認済みのワイン記録を永続化する（Upstash Vector の全 namespace へ upsert）。

- **前提**: ユーザーが確認 UI で内容を承認していること（明示承認が保存の前提, FR-003）。
- **入力**:
  ```json
  {
    "name": "string (必須・非空)",
    "color": "\"white\" | \"red\" (必須。タップ選択する JSA 用語セットを決める)",
    "producer": "string | null",
    "region": {
      "country": "string | null",
      "region": "string | null",
      "subregion": "string | null",
      "commune": "string | null"
    },
    "vintage": "number | \"NV\" | null",
    "importer": "string | null",
    "store": "string | null",
    "appearanceTerms": ["string (語彙内のみ)"],
    "aromaTerms": ["string (語彙内のみ)"],
    "tasteTerms": ["string (語彙内のみ)"],
    "imageUrl": "string | null (自ストレージの https のみ)"
  }
  ```
- **出力**:
  ```json
  { "wineId": "string (UUID)", "recordedAt": "ISO 8601" }
  ```
- **バリデーション**: `name` 非空 / `color` は "white" or "red" /
  `*Terms` は当該 `color` の JSA タクソノミー内の値のみ /
  `vintage` は妥当な年 or "NV" or null / `imageUrl` は許可ドメインの https のみ。
  いずれか不正なら保存せずエラーを返す。
- **副作用**: `overall` + 選択された表現カテゴリの namespace へ upsert。

## ツール: `preview_record`

抽出した下書きを**正規化・検証して「保存される内容」をテキストで返す**読み取り専用ツール。
保存はしない。ユーザーが確認・修正するための確認フロー（FR-003）の中核。

> リモート HTTP では MCP Apps ウィジェット・elicitation が現状使えないため、確認はテキストで行う。
> 経緯は research.md R5（T022a スパイク結果）。

- **入力**: `record_wine` と同形の下書き（**全フィールド任意・nullable**）。vision 抽出値をそのまま渡す。
- **出力**: 正規化後の各フィールド（産地階層・vintage パース等）を人間可読テキスト＋`structuredContent`
  で返す。`name`/`color` 欠落や `*Terms` の語彙外などの検証エラーはフィールド別に提示する。
- **副作用**: なし（保存しない）。
- **確認フロー（FR-003）**: モデルは vision 抽出 → `preview_record` で内容提示 → **ユーザーが明示承認**
  → `record_wine`。`record_wine` は「ユーザーが内容を明示承認した後にのみ呼ぶ」と description で規定する。
  ただし UI ゲート不在のため**ハードな強制ではなく会話プロトコルのベストエフォート**（モデルは
  preview を飛ばして record_wine を直接呼べる）。完全強制は widget/elicitation 対応待ち。

## エラー表現

- 入力検証エラーは、どのフィールドがなぜ不正かを構造化して返す（LLM が修正提示できるよう）。
- シークレットや内部詳細をエラーメッセージに含めない（原則「セキュリティ」）。
