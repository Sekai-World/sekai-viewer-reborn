import {
  getGameCharactersByRegionList,
  getGameCharacterUnitsByRegionList
} from "@platform/sekai-master-api-sdk";

const MAX_PAGES = 20;
const PAGE_SIZE = 100;

type AggregateResult = { data: { items: unknown[] }; loadFailed: boolean };

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const getNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getItemsFromEnvelope = (payload: unknown): unknown[] => {
  const root = getObject(payload);
  if (Array.isArray(root?.items)) return root.items;
  const data = getObject(root?.data);
  return Array.isArray(data?.items) ? data.items : [];
};

const parsePagination = (payload: unknown) => {
  const root = getObject(payload);
  const pagination = getObject(root?.pagination);
  return {
    hasNext: pagination?.has_next === true,
    totalPages: getNumber(pagination?.total_pages),
    page: getNumber(pagination?.page) ?? 0
  };
};

const collectPage = (
  items: unknown[],
  seen: Set<string>,
  keyOf: (raw: unknown) => string | null
): unknown[] => {
  const collected: unknown[] = [];
  for (const raw of items) {
    const key = keyOf(raw);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    collected.push(raw);
  }
  return collected;
};

/**
 * Aggregate every page of a region character list into a single envelope.
 *
 * The master API list responses are paginated. In local runtime verification a
 * `page_size` request of 200 was answered with an effective `page_size` of 100,
 * so a single oversized request cannot be assumed to return the full set when a
 * region spans more than one page. This helper therefore requests
 * `page_size: 100` and follows the returned pagination (`pagination.has_next`,
 * with `pagination.total_pages` as a secondary stop) until all pages are
 * collected.
 *
 * Defensive guards prevent infinite loops:
 * - stop after `MAX_PAGES` pages,
 * - stop on an empty page,
 * - stop when `has_next` is false, or the current page reaches a valid
 *   `total_pages`,
 * - deduplicate by character id (stable order preserved).
 *
 * Returns `{ items: unknown[] }` shaped exactly like the per-page SDK response
 * envelope, so callers can feed it straight into the existing `parseCharacterList`
 * / `parseCharacterUnits` helpers unchanged.
 */
export const aggregateGameCharactersByRegion = async (
  baseUrl: string,
  region: string,
  sortBy: "seq" = "seq",
  sortOrder: "asc" | "desc" = "asc"
): Promise<AggregateResult> => {
  const collected: unknown[] = [];
  const seen = new Set<string>();
  let page = 1;
  while (page <= MAX_PAGES) {
    const response = await getGameCharactersByRegionList({
      baseUrl,
      path: { region },
      query: { page, page_size: PAGE_SIZE, sort_by: sortBy, sort_order: sortOrder }
    });
    if (response.error || !response.data) {
      return { data: { items: [] }, loadFailed: true };
    }
    const items = getItemsFromEnvelope(response.data);
    if (items.length === 0) break;
    collected.push(...collectPage(items, seen, (raw) => getString(getObject(raw)?.id)));
    const { hasNext, totalPages } = parsePagination(response.data);
    if (!hasNext) break;
    if (totalPages !== null && page >= totalPages) break;
    page += 1;
  }
  return { data: { items: collected }, loadFailed: false };
};

/**
 * Aggregate every page of a region game-character-unit list into one envelope.
 *
 * Same pagination strategy as `aggregateGameCharactersByRegion`. Units are
 * deduplicated by id when present, otherwise by `gameCharacterId`+`unit`
 * identity; when neither id nor `gameCharacterId`/`unit` is present the record is
 * dropped (no shared empty key). Stable order is preserved.
 */
export const aggregateGameCharacterUnitsByRegion = async (
  baseUrl: string,
  region: string,
  sortBy: "id" = "id",
  sortOrder: "asc" | "desc" = "asc"
): Promise<AggregateResult> => {
  const collected: unknown[] = [];
  const seen = new Set<string>();
  let page = 1;
  while (page <= MAX_PAGES) {
    const response = await getGameCharacterUnitsByRegionList({
      baseUrl,
      path: { region },
      query: { page, page_size: PAGE_SIZE, sort_by: sortBy, sort_order: sortOrder }
    });
    if (response.error || !response.data) {
      return { data: { items: [] }, loadFailed: true };
    }
    const items = getItemsFromEnvelope(response.data);
    if (items.length === 0) break;
    collected.push(
      ...collectPage(items, seen, (raw) => {
        const node = getObject(raw);
        const id = getString(node?.id);
        if (id) return `u:${id}`;
        const gameCharacterId = getString(node?.gameCharacterId);
        const unit = getString(node?.unit);
        if (!gameCharacterId && !unit) return null;
        return `g:${gameCharacterId ?? ""}:${unit ?? ""}`;
      })
    );
    const { hasNext, totalPages } = parsePagination(response.data);
    if (!hasNext) break;
    if (totalPages !== null && page >= totalPages) break;
    page += 1;
  }
  return { data: { items: collected }, loadFailed: false };
};
