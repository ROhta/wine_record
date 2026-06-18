/**
 * 産地の階層。判明した範囲のみ埋める（不明な層は null）。
 * 後続の観点別検索では、この階層の「最長共通接頭辞」で産地近接をランクする。
 */
export interface RegionPath {
  country: string | null;
  region: string | null;
  subregion: string | null;
  commune: string | null;
}
