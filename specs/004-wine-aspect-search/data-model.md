# データモデル: 観点独立のワイン類似検索

検索は読み取り専用。新規の入力/出力エンティティと、既存 `VectorStore` の拡張を定義する。
表示情報は `overall` namespace のメタデータ（001 `buildOverallUpsert`）から復元する。

## 入力: SearchQuery（検証・正規化後）

ひとつの検索要求。観点表現・構造条件は**いずれも任意だが、最低どちらか一方が必須**（FR-009）。

| フィールド | 型 | 説明 | 検証（FR-009） |
|---|---|---|---|
| `appearance` | `string \| null` | 外観の表現（自然文・任意） | 空/空白は null 扱い |
| `aroma` | `string \| null` | 香りの表現（任意） | 同上 |
| `taste` | `string \| null` | 味わいの表現（任意） | 同上 |
| `region` | `RegionPath`（国/地方/地区/村・各 `string\|null`） | 構造条件（任意） | 001 `normalizeRegion` を再利用 |
| `vintage` | `Vintage`（`number\|"NV"\|null`） | 構造条件（任意） | 001 `normalizeVintage` を再利用 |
| `color` | `"white"\|"red"\|null` | 構造条件（任意） | 001 `parseWineColor` を再利用 |
| `weights` | `{appearance?:number; aroma?:number; taste?:number}` | 観点重み（任意） | 各 **> 0**・有限（**0 以下は検証エラー**）。未指定観点は既定 1。これにより指定観点の重み総和 Σ(wₐ)>0 が保証され、合成式の 0 除算（NaN）を排除する |
| `limit` | `number` | 返却件数上限 | 整数・≥1。未指定は既定 **10**（FR-008） |

- **不変条件**: `appearance/aroma/taste` のいずれか、または `region/vintage/color` のいずれかが非空（FR-009）。
  全て空なら検証エラー（フィールド別・原則 I/III）。
- **正規化**: 観点表現は trim、構造条件は 001 の正規化関数を再利用（語彙照合はしない＝自然文 OK・FR-005）。

## 出力: SearchResultItem

1 件のヒット。表示情報は `overall` メタデータから復元（FR-007）。

| フィールド | 型 | 説明 |
|---|---|---|
| `wineId` | `string` | 対象ワインの識別子 |
| `name` / `producer` / `region` / `vintage` / `color` / `imageUrl` | `overall` 由来 | 表示用記録情報（FR-007） |
| `score` | `number` | 総合スコア = `Σ(w_a·s_a)/Σ(w_a)`（D2）。構造のみクエリ（FR-012）では付与しない（null/省略） |
| `aspectScores` | `{appearance?:number; aroma?:number; taste?:number}` | 観点別の内訳スコア（FR-006・順位根拠の透明性）。クエリで指定した観点のみ |

- 並び順: 観点クエリ時は `(round(score,P) desc, wineId asc)`（D3・FR-011）。構造のみは `wineId asc`（FR-012）。
- 件数: 先頭 `limit` 件（FR-008）。合致全件が limit 未満ならその件数（エッジケース）。

## 出力ラッパ: SearchResult

`{ ok: true; items: SearchResultItem[] } | { ok: false; errors: FieldError[] }`（既存 `FieldError` を再利用）。
空コーパス・合致ゼロは `ok:true` で `items:[]`（エラーにしない・エッジケース／US3 シナリオ2）。

## ストレージ拡張: VectorStore

既存（不変）: `upsert` / `fetch(namespace, ids)` / `query(namespace, {data, topK, excludeId?})`。

追加（D4・D8）:

| メソッド | シグネチャ | 用途 |
|---|---|---|
| `scan` | `scan(namespace: Namespace): Promise<FetchedRecord[]>` | `range` でページング列挙（includeMetadata）。FR-012（構造のみ）の `overall` 全件取得に使う |

- **フェイクパリティ**: `tests/fixtures/vectorStore.ts` のフェイクにも `scan` を実装（seam を塞がない・原則 II）。
- 実装は Upstash `range({cursor, limit, includeMetadata}, {namespace})` を `nextCursor` が尽きるまで反復。

## 関係・既存依存

- `SearchResultItem` の表示情報 ⇐ `overall` メタデータ（001 `buildOverallUpsert` のキー: name/color/producer/
  country/region/subregion/commune/vintage/importer/store/imageUrl/recordedAt）。
- 観点別スコア ⇐ `appearance`/`aroma`/`taste` namespace の `query(data=観点表現)`。各 namespace には
  その観点の表現を持つワインのみ存在（001 `buildAspectUpserts` が空観点をスキップ・D7）。
- 構造条件の正規化・型（RegionPath/Vintage/WineColor）は 001 ドメインを再利用（重複実装しない）。
