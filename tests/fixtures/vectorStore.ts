import type {Namespace, UpsertItem, VectorStore} from "../../src/storage/vectorStore.js"

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
	}
	return {store, upserts}
}

/** 副作用を記録しない空の VectorStore（読み取り専用ツールのテスト用）。 */
export const noStore: VectorStore = {
	upsert: () => Promise.resolve(),
	fetch: () => Promise.resolve([]),
	query: () => Promise.resolve([]),
}
