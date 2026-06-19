/**
 * [SPIKE] T014: Upstash Vector 無料枠の検証（捨てコード）
 *
 * 殺したい未知数:
 *   ホスト型 `BAAI/bge-m3` 埋め込みインデックスを Upstash 無料枠で作成し、
 *   namespace 付きの data ベース upsert / query / fetch が成立するか。
 *   （成立しなければ vectorStore.ts のサーバー側埋め込み前提が崩れ、設計変更が要る）
 *
 * 実行方法（spikes/upstash-index/README.md 参照）:
 *   node --env-file=.env --import tsx spikes/upstash-index/run.ts
 *   もしくは環境変数をインラインで渡す。
 *
 * 安全策:
 *   - 全テスト ID に `spike-t014-` プレフィックスを付ける。
 *   - 終了時に投入したベクトルを全 namespace から削除する（無料枠の枠を消費したまま残さない）。
 */
import { Index } from '@upstash/vector';

const url = process.env.UPSTASH_VECTOR_REST_URL;
const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

if (!url || !token) {
  console.error(
    '✗ 環境変数が未設定です: UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN\n' +
      '  README.md の手順で Upstash Vector（埋め込みモデル BAAI/bge-m3）のインデックスを作成し、\n' +
      '  REST URL / Token を渡してください。',
  );
  process.exit(1);
}

/** 実コード（src/storage/vectorStore.ts）と同じ namespace 構成。 */
const NAMESPACES = ['overall', 'aroma', 'appearance', 'taste'] as const;
type Namespace = (typeof NAMESPACES)[number];

const PREFIX = 'spike-t014-';

/** overall namespace 用の検証データ（日本語＝多言語埋め込みの確認も兼ねる）。 */
const OVERALL = [
  {
    id: `${PREFIX}burgundy`,
    data: 'ブルゴーニュの赤ワイン ピノ・ノワール チェリーや赤い果実の香り 軽やかな酸味',
    metadata: { wineId: `${PREFIX}burgundy`, name: 'スパイク用ブルゴーニュ', color: 'red' },
  },
  {
    id: `${PREFIX}chablis`,
    data: 'シャブリの白ワイン シャルドネ 柑橘とミネラル 樽香は控えめ シャープな酸',
    metadata: { wineId: `${PREFIX}chablis`, name: 'スパイク用シャブリ', color: 'white' },
  },
] as const;

/** 観点別 namespace 用の検証データ（表現テキストのみ・metadata は wineId のみ）。 */
const ASPECT: Record<Exclude<Namespace, 'overall'>, { id: string; data: string }> = {
  aroma: { id: `${PREFIX}aroma`, data: 'チェリー カシス すみれ' },
  appearance: { id: `${PREFIX}appearance`, data: '澄んだ ルビー 中程度の濃さ' },
  taste: { id: `${PREFIX}taste`, data: '果実味豊か 滑らかなタンニン 長い余韻' },
};

const allIds: Record<Namespace, string[]> = {
  overall: OVERALL.map((r) => r.id),
  aroma: [ASPECT.aroma.id],
  appearance: [ASPECT.appearance.id],
  taste: [ASPECT.taste.id],
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const index = new Index({ url, token });
  const checks: { label: string; ok: boolean; detail: string }[] = [];

  // 1) info(): hosted-embedding インデックスであることと次元を確認（bge-m3 = 1024 次元）
  let dimension = 0;
  try {
    const info = await index.info();
    dimension = info.dimension;
    const ok = dimension > 0;
    checks.push({
      label: 'info(): 埋め込みインデックスの次元',
      ok,
      detail: `dimension=${dimension} (bge-m3 期待値=1024) / similarity=${info.similarityFunction}`,
    });
    if (!ok) {
      console.error(
        '✗ dimension=0。埋め込みモデル未設定のインデックスの可能性があります。\n' +
          '  Upstash でインデックス作成時に「Embedding Model = BAAI/bge-m3」を選んでください。',
      );
    }
  } catch (e) {
    checks.push({ label: 'info()', ok: false, detail: errMsg(e) });
  }

  // 2) upsert: 各 namespace へ data ベース（サーバー側埋め込み）で投入
  try {
    for (const r of OVERALL) {
      await index.namespace('overall').upsert({ id: r.id, data: r.data, metadata: r.metadata });
    }
    for (const ns of ['aroma', 'appearance', 'taste'] as const) {
      const r = ASPECT[ns];
      await index.namespace(ns).upsert({ id: r.id, data: r.data, metadata: { wineId: r.id } });
    }
    checks.push({ label: 'upsert: 全 namespace へ data ベース投入', ok: true, detail: '4 namespace OK' });
  } catch (e) {
    checks.push({ label: 'upsert', ok: false, detail: errMsg(e) });
    await report(checks);
    return;
  }

  // 3) 結果整合性待ち: Upstash は eventual consistent。pendingVectorCount が捌けるまでポーリング
  await waitForIndexing(index);

  // 4) fetch: overall から id 指定で取得し metadata が往復するか
  try {
    const fetched = await index.namespace('overall').fetch(allIds.overall, { includeMetadata: true });
    const present = fetched.filter((v) => v !== null);
    const ok = present.length === OVERALL.length && present.every((v) => v?.metadata != null);
    checks.push({
      label: 'fetch: id 指定取得 + metadata 往復',
      ok,
      detail: `${present.length}/${OVERALL.length} 件取得・metadata 復元 ${ok ? 'OK' : 'NG'}`,
    });
  } catch (e) {
    checks.push({ label: 'fetch', ok: false, detail: errMsg(e) });
  }

  // 5) query: 日本語テキストで意味検索し、ヒットが返るか（順位は人間が目視確認）
  try {
    const q = 'ブルゴーニュ 赤 チェリーの香り';
    const hits = await index.namespace('overall').query({ data: q, topK: 2, includeMetadata: true });
    const ok = hits.length > 0;
    const ranking = hits
      .map((h, i) => `${i + 1}. ${String(h.id)} (score=${h.score.toFixed(4)})`)
      .join(' / ');
    checks.push({
      label: `query: data 検索「${q}」`,
      ok,
      detail: ok ? ranking : 'ヒット 0 件',
    });
  } catch (e) {
    checks.push({ label: 'query', ok: false, detail: errMsg(e) });
  }

  await report(checks);
}

/** pendingVectorCount が 0 になるまで待つ（最大 ~30 秒）。 */
async function waitForIndexing(index: Index): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const info = await index.info();
    if (info.pendingVectorCount === 0) return;
    await sleep(1000);
  }
}

/** 投入したテストベクトルを全 namespace から削除する。 */
async function cleanup(): Promise<void> {
  const index = new Index({ url, token });
  for (const ns of NAMESPACES) {
    try {
      await index.namespace(ns).delete(allIds[ns]);
    } catch (e) {
      console.warn(`! cleanup 失敗 namespace=${ns}: ${errMsg(e)}`);
    }
  }
}

async function report(checks: { label: string; ok: boolean; detail: string }[]): Promise<void> {
  console.log('\n=== T014 Upstash 無料枠スパイク 結果 ===');
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} ${c.label}\n    ${c.detail}`);
  }
  await cleanup();
  console.log('\n(投入したテストベクトルは削除しました)');
  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  console.log(allOk ? '\n結論: PASS — 無料枠で data ベース namespace I/O が成立。' : '\n結論: FAIL — 上記の ✗ を確認。設計見直しが必要かもしれません。');
  process.exit(allOk ? 0 : 1);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

void main();
