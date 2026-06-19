import type {ExpressionTaxonomy} from "../domain/taxonomy.js"
import type {VectorStore} from "../storage/vectorStore.js"
import type {WineRecord} from "../domain/wineRecord.js"
import {validateRecordInput, type FieldError} from "../domain/recordInput.js"
import {buildOverallUpsert, buildAspectUpserts} from "../storage/recordMapping.js"

/** record_wine の依存。テスト容易性のため ID/時刻生成も注入する。 */
export interface RecordWineDeps {
	taxonomy: ExpressionTaxonomy
	store: VectorStore
	/** 許可するラベル画像 URL の接頭辞（自ストレージ公開ベース URL）。 */
	allowedImageBaseUrl: string
	generateId: () => string
	/** 記録日時（ISO 8601）を返す。 */
	now: () => string
}

export type RecordWineResult = {ok: true; wineId: string; recordedAt: string} | {ok: false; errors: FieldError[]}

/**
 * record_wine ツールのハンドラを生成する。
 * 入力検証 → ID/日時付与 → `overall` namespace へ upsert。
 * 検証失敗時は永続化せず、フィールド別エラーを返す。
 */
export function createRecordWine(deps: RecordWineDeps) {
	return async function recordWine(input: unknown): Promise<RecordWineResult> {
		const validated = validateRecordInput(input, deps.taxonomy, deps.allowedImageBaseUrl)
		if (!validated.ok) {
			return {ok: false, errors: validated.errors}
		}
		const wineId = deps.generateId()
		const recordedAt = deps.now()
		const record: WineRecord = {...validated.value, wineId, recordedAt}
		// overall が正本（全表現を含む）。先に書く。
		await deps.store.upsert("overall", buildOverallUpsert(record))
		// 観点別 namespace（aroma/appearance/taste）はベストエフォート。overall が正本のため、
		// ここでの失敗は記録自体を失敗させない（観点別検索インデックスが一時的に欠けるだけ・原則 IV）。
		for (const {namespace, item} of buildAspectUpserts(record)) {
			try {
				await deps.store.upsert(namespace, item)
			} catch (e) {
				console.warn(`観点別 namespace への upsert に失敗しました (namespace=${namespace}): ${e instanceof Error ? e.message : String(e)}`)
			}
		}
		return {ok: true, wineId, recordedAt}
	}
}
