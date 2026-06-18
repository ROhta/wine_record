# フェーズ1 データモデル: ワインの記録

## エンティティ

### WineRecord（ワイン記録）

1 本のワインの記録。`overall` namespace のメタデータが正本。

| フィールド | 型 | 必須 | 備考 |
|---|---|---|---|
| `wineId` | string (UUID) | ✔ | 一意キー。全 namespace で共通 |
| `name` | string | ✔ | ワイン名 |
| `producer` | string | | 生産者 |
| `region` | RegionPath | | 産地（階層）|
| `vintage` | number \| "NV" \| null | | 収穫年。ノン・ヴィンテージは "NV" |
| `importer` | string | | 輸入業者 |
| `store` | string | | 購入店舗 |
| `appearanceTerms` | string[] | | JSA 外観表現タグ（語彙内の値のみ）|
| `aromaTerms` | string[] | | JSA 香り表現タグ（語彙内の値のみ）|
| `tasteTerms` | string[] | | JSA 味わい表現タグ（語彙内の値のみ）|
| `imageUrl` | string \| null | | ラベル画像の参照（オブジェクトストレージ URL）|
| `recordedAt` | string (ISO 8601) | ✔ | 記録日時 |

**バリデーション**:
- `name` は非空。
- `vintage` は number のとき妥当な年範囲、もしくは "NV"、もしくは null。
- `*Terms` は **JSA タクソノミーに存在する値のみ**許可（自由入力不可、原則 I/III）。
- `imageUrl` は許可ドメイン（自ストレージ）の https URL のみ。
- すべて境界（ツール入力）で検証してから内部型に変換する。

### RegionPath（産地階層）

| フィールド | 型 | 備考 |
|---|---|---|
| `country` | string \| null | 国 |
| `region` | string \| null | 地方 |
| `subregion` | string \| null | 地区 |
| `commune` | string \| null | 村 |

判明した範囲のみ埋める。後続の検索で「最長共通接頭辞」による産地近接ランクに使う。

### ExpressionTaxonomy（表現語彙）

| フィールド | 型 | 備考 |
|---|---|---|
| `appearance` | string[] | 外観表現のターム一覧 |
| `aroma` | string[] | 香り表現のターム一覧 |
| `taste` | string[] | 味わい表現のターム一覧 |

JSA 表現集 PDF を構造化した `data/jsa-taxonomy.json` が供給源。`get_jsa_taxonomy`
ツールと記録時のバリデーションが参照する。

### LabelImage（ラベル画像）

オブジェクトストレージ上の画像と参照（URL）。本体はストレージ、参照は
`WineRecord.imageUrl`。記録とは独立に保存され、保存失敗時も記録自体は成立する（FR-007 / エッジケース）。

## namespace へのマッピング（Upstash Vector）

| namespace | `data`（ベクトル化対象） | metadata |
|---|---|---|
| `overall` | `name` + 産地文字列 + 全表現の結合テキスト | WineRecord 全フィールド |
| `aroma` | `aromaTerms` の結合テキスト | `{ wineId }` |
| `appearance` | `appearanceTerms` の結合テキスト | `{ wineId }` |
| `taste` | `tasteTerms` の結合テキスト | `{ wineId }` |

記録（保存）時は 4 namespace すべてに upsert する。表現が未選択のカテゴリは、
当該 namespace への書き込みをスキップしてよい（後から追記可能）。

## 状態遷移

```
[下書き(未保存)] --ユーザー承認--> [保存済み]
       │
       └--未承認のまま離脱--> (破棄 / 永続化されない)
```
