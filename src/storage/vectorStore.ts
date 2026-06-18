import { Index } from '@upstash/vector';
import type { Config } from '../config.js';

/**
 * Upstash Vector の namespace。
 * - `overall`: 正本（名前+産地+全表現の結合テキスト、全メタデータ）
 * - `aroma`/`appearance`/`taste`: 観点別（各表現テキストのみ、metadata は wineId のみ）
 */
export const NAMESPACES = ['overall', 'aroma', 'appearance', 'taste'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export type Metadata = Record<string, unknown>;

export interface UpsertItem {
  id: string;
  /** 埋め込みモデル（bge-m3）でベクトル化されるテキスト。 */
  data: string;
  metadata: Metadata;
}

export interface FetchedRecord {
  id: string;
  metadata: Metadata | null;
}

export interface QueryHit {
  id: string;
  score: number;
}

/**
 * 観点別検索の前提となる namespace 付き I/O の薄いラッパ（骨組み）。
 * 記録→namespace へのマッピングや結合テキスト生成は US1/US2（T020/T029）で実装する。
 */
export interface VectorStore {
  upsert(namespace: Namespace, item: UpsertItem): Promise<void>;
  fetch(namespace: Namespace, ids: readonly string[]): Promise<FetchedRecord[]>;
  query(
    namespace: Namespace,
    opts: { data: string; topK: number; excludeId?: string },
  ): Promise<QueryHit[]>;
}

/** Upstash Vector を裏に持つ VectorStore を生成する。 */
export function createVectorStore(config: Config): VectorStore {
  const index = new Index({ url: config.upstash.url, token: config.upstash.token });
  return {
    async upsert(namespace, item) {
      await index
        .namespace(namespace)
        .upsert({ id: item.id, data: item.data, metadata: item.metadata });
    },
    async fetch(namespace, ids) {
      const res = await index.namespace(namespace).fetch([...ids], { includeMetadata: true });
      return res
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .map((v) => ({ id: String(v.id), metadata: v.metadata ?? null }));
    },
    async query(namespace, opts) {
      const res = await index.namespace(namespace).query({ data: opts.data, topK: opts.topK });
      return res
        .filter((r) => String(r.id) !== opts.excludeId)
        .map((r) => ({ id: String(r.id), score: r.score }));
    },
  };
}
