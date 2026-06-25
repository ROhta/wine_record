import type {Metadata, Namespace, QueryHit, UpsertItem, VectorStore} from "../../src/storage/vectorStore.js"

export interface RecordedUpsert {
	namespace: Namespace
	item: UpsertItem
}

/** upsert を記録するフェイク VectorStore。返した `upserts` 配列で副作用を検証できる。 */
export function makeFakeStore(): {store: VectorStore; upserts: RecordedUpsert[]} {
	const upserts: RecordedUpsert[] = []
	const store: VectorStore = {
		upsert: (namespace, item) => {
			upserts.push({namespace, item})
			return Promise.resolve()
		},
		fetch: () => Promise.resolve([]),
		query: () => Promise.resolve([]),
		scan: () => Promise.resolve([]),
	}
	return {store, upserts}
}

/** 副作用を記録しない空の VectorStore（読み取り専用ツールのテスト用）。 */
export const noStore: VectorStore = {
	upsert: () => Promise.resolve(),
	fetch: () => Promise.resolve([]),
	query: () => Promise.resolve([]),
	scan: () => Promise.resolve([]),
}

/** 検索テスト用フェイクの構成。 */
export interface SearchStoreConfig {
	/** 観点別 namespace の query 結果（id+score）。query は topK 件にスライスして返す。 */
	queryHits?: Partial<Record<Namespace, QueryHit[]>>
	/** id → メタデータ。`overall` の fetch / scan が返す（表示情報・構造条件の源）。 */
	records?: Record<string, Metadata>
}

/**
 * 観点独立検索のための読み取り専用フェイク VectorStore（004）。
 * - `query(ns)` は構成の `queryHits[ns]` を topK 件返す（観点別の意味スコアを差し込む）。
 * - `fetch("overall", ids)` は `records` から該当 id のメタデータを返す（ハイドレート）。
 * - `scan("overall")` は `records` 全件を返す（構造のみ検索 FR-012）。
 * - `upsert` は副作用なし（読み取り専用ツールの検証用）。
 */
export function makeSearchStore(config: SearchStoreConfig): VectorStore {
	const hits = config.queryHits ?? {}
	const records = config.records ?? {}
	return {
		upsert: () => Promise.resolve(),
		query: (namespace, opts) => Promise.resolve((hits[namespace] ?? []).slice(0, opts.topK)),
		fetch: (_namespace, ids) => Promise.resolve([...ids].map(id => ({id, metadata: records[id] ?? null}))),
		scan: () => Promise.resolve(Object.entries(records).map(([id, metadata]) => ({id, metadata}))),
	}
}
