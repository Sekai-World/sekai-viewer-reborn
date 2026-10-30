import { getMusicsByRegionList } from "@platform/sekai-master-api-sdk";
import {
  makeRegionChartKey,
  MUSIC_META_DIFFICULTIES,
  type YieldRegion
} from "#lib/music-recommender.js";
import { getCachedMetadata } from "#lib/server/metadata-cache.js";
import { withRequestTimeout } from "#lib/server/network.js";

export type RegionCharts =
  { status: "available"; charts: ReadonlySet<string> } | { status: "unavailable" };

export type RegionChartLoader = (region: YieldRegion) => Promise<RegionCharts>;

const REGION_CHARTS_TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000;
// A region lists a few hundred songs; the cap only stops a malformed pagination loop.
const MAX_PAGES = 20;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readMusicId = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  return null;
};

const readDifficultyName = (value: unknown): string | null =>
  typeof value === "string" &&
  (MUSIC_META_DIFFICULTIES as readonly string[]).includes(value.trim().toLowerCase())
    ? value.trim().toLowerCase()
    : null;

/** Adds the charts of one list item, or returns false when the item is malformed. */
const addItemCharts = (item: unknown, charts: Set<string>): boolean => {
  const source = record(item);
  const musicId = readMusicId(source?.id);
  const difficulties = source?.difficulties;
  if (musicId === null || !Array.isArray(difficulties)) return false;
  for (const entry of difficulties) {
    const difficulty = readDifficultyName(record(entry)?.musicDifficulty);
    if (difficulty === null) return false;
    charts.add(makeRegionChartKey(musicId, difficulty));
  }
  return true;
};

type ListPage = { items: unknown[]; hasNext: boolean };

const readListPage = (result: unknown): ListPage | null => {
  const envelope = record(result);
  if (envelope === null || envelope.error) return null;
  const payload = record(envelope.data);
  const items = payload?.items;
  if (!Array.isArray(items)) return null;
  return { items, hasNext: record(payload?.pagination)?.has_next === true };
};

const fetchRegionCharts = async (baseUrl: string, region: YieldRegion): Promise<RegionCharts> => {
  const charts = new Set<string>();
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await withRequestTimeout((signal) =>
        getMusicsByRegionList({
          baseUrl,
          path: { region },
          query: { page, page_size: PAGE_SIZE },
          signal
        })
      );
      const parsed = readListPage(result);
      if (parsed === null || !parsed.items.every((item) => addItemCharts(item, charts))) {
        return { status: "unavailable" };
      }
      if (!parsed.hasNext)
        return charts.size > 0 ? { status: "available", charts } : { status: "unavailable" };
    }
  } catch {
    return { status: "unavailable" };
  }
  return { status: "unavailable" };
};

/**
 * The charts a region's master data lists, read from the master API. Any failed, malformed, or
 * empty answer is "unavailable": a partial list would silently drop songs from the ranking.
 */
export const loadRegionCharts = (baseUrl: string, region: YieldRegion): Promise<RegionCharts> =>
  getCachedMetadata(
    `region-charts|${baseUrl}|${region}`,
    () => fetchRegionCharts(baseUrl, region),
    REGION_CHARTS_TTL_MS,
    (value) => value.status === "available"
  );
