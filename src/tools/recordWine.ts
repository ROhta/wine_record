import type { ExpressionTaxonomy } from '../domain/taxonomy.js';
import type { VectorStore } from '../storage/vectorStore.js';
import type { WineRecord } from '../domain/wineRecord.js';
import { validateRecordInput, type FieldError } from '../domain/recordInput.js';
import { buildOverallUpsert } from '../storage/recordMapping.js';

/** record_wine の依存。テスト容易性のため ID/時刻生成も注入する。 */
export interface RecordWineDeps {
  taxonomy: ExpressionTaxonomy;
  store: VectorStore;
  /** 許可するラベル画像 URL の接頭辞（自ストレージ公開ベース URL）。 */
  allowedImageBaseUrl: string;
  generateId: () => string;
  /** 記録日時（ISO 8601）を返す。 */
  now: () => string;
}

export type RecordWineResult =
  | { ok: true; wineId: string; recordedAt: string }
  | { ok: false; errors: FieldError[] };

/**
 * record_wine ツールのハンドラを生成する。
 * 入力検証 → ID/日時付与 → `overall` namespace へ upsert。
 * 検証失敗時は永続化せず、フィールド別エラーを返す。
 */
export function createRecordWine(deps: RecordWineDeps) {
  return async function recordWine(input: unknown): Promise<RecordWineResult> {
    const validated = validateRecordInput(input, deps.taxonomy, deps.allowedImageBaseUrl);
    if (!validated.ok) {
      return { ok: false, errors: validated.errors };
    }
    const wineId = deps.generateId();
    const recordedAt = deps.now();
    const record: WineRecord = { ...validated.value, wineId, recordedAt };
    await deps.store.upsert('overall', buildOverallUpsert(record));
    return { ok: true, wineId, recordedAt };
  };
}
