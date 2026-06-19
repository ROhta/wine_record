import type { WineRecord } from '../domain/wineRecord.js';
import type { UpsertItem } from './vectorStore.js';

/** `overall` namespace 用の結合テキスト（名前+生産者+産地+全表現）。埋め込みモデルでベクトル化される。 */
export function buildOverallText(r: WineRecord): string {
  const regionParts = [r.region.country, r.region.region, r.region.subregion, r.region.commune];
  const parts = [r.name, r.producer, ...regionParts, ...r.appearanceTerms, ...r.aromaTerms, ...r.tasteTerms];
  return parts.filter((x): x is string => typeof x === 'string' && x.trim() !== '').join(' ');
}

/**
 * WineRecord を `overall` namespace の upsert アイテムに変換する。
 * 産地は階層を平坦化して metadata に持たせる（後続の構造的近接検索の前提）。
 */
export function buildOverallUpsert(r: WineRecord): UpsertItem {
  return {
    id: r.wineId,
    data: buildOverallText(r),
    metadata: {
      name: r.name,
      color: r.color,
      producer: r.producer,
      country: r.region.country,
      region: r.region.region,
      subregion: r.region.subregion,
      commune: r.region.commune,
      vintage: r.vintage,
      importer: r.importer,
      store: r.store,
      appearanceTerms: r.appearanceTerms,
      aromaTerms: r.aromaTerms,
      tasteTerms: r.tasteTerms,
      imageUrl: r.imageUrl,
      recordedAt: r.recordedAt,
    },
  };
}
