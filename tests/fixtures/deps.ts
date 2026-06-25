import {createRecordWine, type RecordWineDeps} from "../../src/tools/recordWine.js"
import {createPreviewRecord} from "../../src/tools/previewRecord.js"
import {createGetJsaTaxonomy} from "../../src/tools/getJsaTaxonomy.js"
import {createSearchWines} from "../../src/search/searchWines.js"
import type {McpServerDeps} from "../../src/server.js"
import type {VectorStore} from "../../src/storage/vectorStore.js"
import {testTaxonomy} from "./taxonomy.js"
import {makeFakeStore, type RecordedUpsert} from "./vectorStore.js"

/** 許可するラベル画像ストレージのベース URL（テスト共通）。 */
export const allowedImageBaseUrl = "https://img.example.com"

/** record_wine ハンドラの依存（テスト用・固定 id/時刻、標準タクソノミー）。 */
export function makeRecordWineDeps(store: VectorStore): RecordWineDeps {
	return {
		taxonomy: testTaxonomy,
		store,
		allowedImageBaseUrl,
		generateId: () => "wine-123",
		now: () => "2026-06-18T00:00:00.000Z",
	}
}

/** McpServerDeps 一式（標準タクソノミー＋フェイク store）。`upserts` で副作用を検証できる。 */
export function makeServerDeps(): {deps: McpServerDeps; upserts: RecordedUpsert[]} {
	const {store, upserts} = makeFakeStore()
	const recordWine = createRecordWine(makeRecordWineDeps(store))
	const previewRecord = createPreviewRecord({taxonomy: testTaxonomy, allowedImageBaseUrl})
	const getJsaTaxonomy = createGetJsaTaxonomy({taxonomy: testTaxonomy})
	const searchWines = createSearchWines({store})
	return {deps: {recordWine, previewRecord, getJsaTaxonomy, searchWines}, upserts}
}
