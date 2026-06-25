import {Index} from "@upstash/vector"
import type {Config} from "../config.js"

/**
 * Upstash Vector の namespace。
 * - `overall`: 正本（名前+産地+全表現の結合テキスト、全メタデータ）
 * - `aroma`/`appearance`/`taste`: 観点別（各表現テキストのみ、metadata は wineId のみ）
 */
export const NAMESPACES = ["overall", "aroma", "appearance", "taste"] as const
export type Namespace = (typeof NAMESPACES)[number]

export type Metadata = Record<string, unknown>

export interface UpsertItem {
	id: string
	/** 埋め込みモデル（インデックス設定のモデル）でベクトル化されるテキスト。 */
	data: string
	metadata: Metadata
}

export interface FetchedRecord {
	id: string
	metadata: Metadata | null
}

export interface QueryHit {
	id: string
	score: number
}

/**
 * namespace 付き I/O の薄いラッパ。記録（001）と観点独立検索（004）が利用する。
 */
export interface VectorStore {
	upsert(namespace: Namespace, item: UpsertItem): Promise<void>
	fetch(namespace: Namespace, ids: readonly string[]): Promise<FetchedRecord[]>
	query(namespace: Namespace, opts: {data: string; topK: number; excludeId?: string}): Promise<QueryHit[]>
	/**
	 * namespace の全レコードを列挙する（メタデータ込み）。クエリベクトル無しの取得に使う。
	 * 構造条件のみの検索（FR-012）で `overall` を走査するため（004）。
	 */
	scan(namespace: Namespace): Promise<FetchedRecord[]>
}

/** Upstash Vector を裏に持つ VectorStore を生成する。 */
export function createVectorStore(config: Config): VectorStore {
	const index = new Index({url: config.upstash.url, token: config.upstash.token})
	return {
		async upsert(namespace, item) {
			await index.namespace(namespace).upsert({id: item.id, data: item.data, metadata: item.metadata})
		},
		async fetch(namespace, ids) {
			const res = await index.namespace(namespace).fetch([...ids], {includeMetadata: true})
			return res.filter((v): v is NonNullable<typeof v> => v !== null).map(v => ({id: String(v.id), metadata: v.metadata ?? null}))
		},
		async query(namespace, opts) {
			const res = await index.namespace(namespace).query({data: opts.data, topK: opts.topK})
			return res.filter(r => String(r.id) !== opts.excludeId).map(r => ({id: String(r.id), score: r.score}))
		},
		async scan(namespace) {
			const out: FetchedRecord[] = []
			let cursor = "0"
			for (;;) {
				const res = await index.namespace(namespace).range({cursor, limit: 100, includeMetadata: true})
				for (const v of res.vectors) out.push({id: String(v.id), metadata: v.metadata ?? null})
				if (!res.nextCursor) break
				cursor = String(res.nextCursor)
			}
			return out
		},
	}
}
