import type {RegionPath} from "./region.js"
import type {WineColor} from "./taxonomy.js"

/**
 * 収穫年。
 * - `number`: 収穫年
 * - `"NV"`: ノン・ヴィンテージ（意図的に年が無いワイン）
 * - `null`: ヴィンテージ不明
 *
 * `"NV"` と `null` は別状態として区別する（潰すと後で復元できない）。
 */
export type Vintage = number | "NV" | null

/** JSA 表現タグの配列（値は JSA タクソノミー内のもののみ。検証は別レイヤ）。 */
export type ExpressionTerms = readonly string[]

/**
 * ワイン 1 件の記録。Upstash Vector の `overall` namespace のメタデータが正本。
 * data-model.md 準拠。
 */
export interface WineRecord {
	/** 一意キー（UUID）。全 namespace で共通。 */
	wineId: string
	/** ワイン名（必須・非空）。 */
	name: string
	/** ワインの色。タップ選択する JSA 用語セット（白用/赤用）を決める。 */
	color: WineColor
	producer: string | null
	region: RegionPath
	vintage: Vintage
	importer: string | null
	store: string | null
	appearanceTerms: ExpressionTerms
	aromaTerms: ExpressionTerms
	tasteTerms: ExpressionTerms
	/** ラベル画像の参照（自ストレージの https URL）。未保存は null。 */
	imageUrl: string | null
	/** 記録日時（ISO 8601）。 */
	recordedAt: string
}
