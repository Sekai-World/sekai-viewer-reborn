import { getBoostsByRegionList } from "@platform/sekai-master-api-sdk";
import type { YieldRegion } from "#lib/music-recommender.js";
import type { BoostRow } from "#lib/plan-live-bonus.js";
import { getCachedMetadata } from "#lib/server/metadata-cache.js";
import { withRequestTimeout } from "#lib/server/network.js";

export type RegionBoosts =
  { status: "available"; boosts: readonly BoostRow[] } | { status: "unavailable" };

export type RegionBoostLoader = (region: YieldRegion) => Promise<RegionBoosts>;

const REGION_BOOSTS_TTL_MS = 5 * 60 * 1000;
// The table has eleven rows; a second page would mean it is not the table this code expects.
const PAGE_SIZE = 100;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readWholeNumber = (value: unknown, min: number): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min ? value : null;

const readBoostRow = (item: unknown): BoostRow | null => {
  const source = record(item);
  const costBoost = readWholeNumber(source?.costBoost, 0);
  const eventPointRate = readWholeNumber(source?.eventPointRate, 1);
  return costBoost === null || eventPointRate === null ? null : { costBoost, eventPointRate };
};

/** The lookup goes from a rate to its cost, so a rate must name one row. */
const hasDistinctRates = (rows: readonly BoostRow[]): boolean =>
  new Set(rows.map((row) => row.eventPointRate)).size === rows.length;

const readBoosts = (result: unknown): RegionBoosts => {
  const envelope = record(result);
  if (envelope === null || envelope.error) return { status: "unavailable" };
  const payload = record(envelope.data);
  const items = payload?.items;
  if (!Array.isArray(items) || items.length === 0) return { status: "unavailable" };
  if (record(payload?.pagination)?.has_next === true) return { status: "unavailable" };

  const boosts = items.map(readBoostRow);
  if (boosts.includes(null)) return { status: "unavailable" };
  const rows = boosts as BoostRow[];
  return hasDistinctRates(rows) ? { status: "available", boosts: rows } : { status: "unavailable" };
};

const fetchRegionBoosts = async (baseUrl: string, region: YieldRegion): Promise<RegionBoosts> => {
  try {
    const result = await withRequestTimeout((signal) =>
      getBoostsByRegionList({
        baseUrl,
        path: { region },
        query: { page: 1, page_size: PAGE_SIZE },
        signal
      })
    );
    return readBoosts(result);
  } catch {
    return { status: "unavailable" };
  }
};

/**
 * A region's boost table, read from the master API. Any failed, malformed, or empty answer, or one
 * where two rows share a rate, is "unavailable": a partial table would report a wrong live bonus.
 */
export const loadRegionBoosts = (baseUrl: string, region: YieldRegion): Promise<RegionBoosts> =>
  getCachedMetadata(
    `region-boosts|${baseUrl}|${region}`,
    () => fetchRegionBoosts(baseUrl, region),
    REGION_BOOSTS_TTL_MS,
    (value) => value.status === "available"
  );
