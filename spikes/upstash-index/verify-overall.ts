// [SPIKE 補助] Upstash の各 namespace の中身を一覧して、record_wine の永続化を裏取りする。
import { Index } from '@upstash/vector';

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

const info = await index.info();
console.log('total vectorCount =', info.vectorCount, '/ pending =', info.pendingVectorCount);

for (const ns of ['overall', 'aroma', 'appearance', 'taste']) {
  const r = await index.namespace(ns).range({ cursor: '', limit: 30, includeMetadata: true });
  console.log(`\n[${ns}] ${r.vectors.length} 件`);
  for (const v of r.vectors) {
    console.log('  id=', v.id, 'metadata=', JSON.stringify(v.metadata));
  }
}
