import type {ExpressionTaxonomy} from "../domain/taxonomy.js"
import {validateRecordInput, type FieldError, type ValidatedRecord} from "../domain/recordInput.js"

/** preview_record の依存。検証・正規化に必要なものだけ（保存しないので store/ID は不要）。 */
export interface PreviewRecordDeps {
	taxonomy: ExpressionTaxonomy
	/** 許可するラベル画像 URL の接頭辞（自ストレージ公開ベース URL）。 */
	allowedImageBaseUrl: string
}

export type PreviewRecordResult = {ok: true; preview: ValidatedRecord} | {ok: false; errors: FieldError[]}

/**
 * preview_record ツールのハンドラを生成する（読み取り専用）。
 * record_wine と同じ `validateRecordInput` を通すため、「プレビューした正規化結果」＝
 * 「実際に保存される内容」が一致する（検証ロジックを二重化しない）。保存はしない。
 */
export function createPreviewRecord(deps: PreviewRecordDeps) {
	return function previewRecord(input: unknown): PreviewRecordResult {
		const validated = validateRecordInput(input, deps.taxonomy, deps.allowedImageBaseUrl)
		if (!validated.ok) {
			return {ok: false, errors: validated.errors}
		}
		return {ok: true, preview: validated.value}
	}
}
