# MCP ツール契約: ワインの記録

LLM クライアントから見た契約（原則 I）。入出力は検証必須。すべて JSON。

## tool: `get_jsa_taxonomy`

外観・香り・味わいの定義済み表現語彙を返す（タップ選択 UI の供給源）。

- **Input**: `{}`（引数なし）または `{ "category"?: "appearance" | "aroma" | "taste" }`
- **Output**:
  ```json
  {
    "appearance": ["string", "..."],
    "aroma": ["string", "..."],
    "taste": ["string", "..."]
  }
  ```
  `category` 指定時は該当カテゴリのみ返す。
- **副作用**: なし（読み取りのみ）。

## tool: `get_upload_url`

ラベル画像をオブジェクトストレージへ直接アップロードするための、短命の署名付き
URL を発行する。

- **Input**:
  ```json
  { "contentType": "image/jpeg" | "image/png" | "image/webp" }
  ```
- **Output**:
  ```json
  {
    "uploadUrl": "https://...(署名付きPUT URL, 短命)",
    "imageUrl": "https://...(保存後に参照する公開/取得URL)",
    "expiresInSeconds": 300
  }
  ```
- **副作用**: ストレージ上にアップロード先を予約。URL は短命・単一用途。

## tool: `record_wine`

確認済みのワイン記録を永続化する（Upstash Vector の全 namespace へ upsert）。

- **前提**: ユーザーが確認 UI で内容を承認していること（明示承認が保存の前提, FR-003）。
- **Input**:
  ```json
  {
    "name": "string (必須・非空)",
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
- **Output**:
  ```json
  { "wineId": "string (UUID)", "recordedAt": "ISO 8601" }
  ```
- **バリデーション**: `name` 非空 / `*Terms` は JSA タクソノミー内の値のみ /
  `vintage` は妥当な年 or "NV" or null / `imageUrl` は許可ドメインの https のみ。
  いずれか不正なら保存せずエラーを返す。
- **副作用**: `overall` + 選択された表現カテゴリの namespace へ upsert。

## エラー表現

- 入力検証エラーは、どのフィールドがなぜ不正かを構造化して返す（LLM が修正提示できるよう）。
- シークレットや内部詳細をエラーメッセージに含めない（原則 Security）。
