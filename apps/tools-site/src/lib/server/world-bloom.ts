import { getWorldBloomsByRegionList } from "@platform/sekai-master-api-sdk";
import type { TrackerRegion } from "./event-tracker";
import { withRequestTimeout } from "./network";

type WorldBloomResponse = {
  aggregateAt?: unknown;
  chapterEndAt?: unknown;
  chapterNo?: unknown;
  chapterStartAt?: unknown;
  eventId?: unknown;
  gameCharacterId?: unknown;
  id?: unknown;
};

export type WorldBloomChapter = {
  id: number;
  chapterNo: number;
  gameCharacterId: number;
  chapterStartAt: string | number | null;
  chapterEndAt: string | number | null;
  aggregateAt: string | number | null;
};

export type WorldBloomMetadata = {
  eventId: number;
  chapters: WorldBloomChapter[];
};

export type WorldBloomResult = {
  status: "available" | "sdk-error" | "network-error" | "invalid-data";
  items: WorldBloomMetadata[];
};

const MAX_PAGES = 50;
const PAGE_SIZE = 100;

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const positiveInteger = (value: unknown): number | null => {
  let parsed: number | null = null;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && /^\d+$/.test(value)) {
    parsed = Number(value);
  }
  return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const timestamp = (value: unknown): string | number | null =>
  typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? value : null;

const unwrap = (value: unknown): unknown => {
  let current = value;
  let source = object(current);
  while (source && "data" in source && source.data !== undefined) {
    current = source.data;
    source = object(current);
  }
  return current;
};

const parseChapter = (
  value: unknown
): { eventId: number; chapter: WorldBloomChapter } | null => {
  const source = object(value);
  if (!source) return null;

  const eventId = positiveInteger(source.eventId);
  const chapterNo = positiveInteger(source.chapterNo);
  const gameCharacterId = positiveInteger(source.gameCharacterId);
  if (eventId === null || chapterNo === null || gameCharacterId === null) return null;

  return {
    eventId,
    chapter: {
      id: positiveInteger(source.id) ?? chapterNo,
      chapterNo,
      gameCharacterId,
      chapterStartAt: timestamp(source.chapterStartAt),
      chapterEndAt: timestamp(source.chapterEndAt),
      aggregateAt: timestamp(source.aggregateAt)
    }
  };
};

const pageCount = (payload: Record<string, unknown>, receivedItems: number): number | null => {
  const pagination = object(payload.pagination);
  if (!pagination) return receivedItems < PAGE_SIZE ? 0 : null;
  const totalPages = positiveInteger(pagination.totalPages ?? pagination.total_pages ?? pagination.pages);
  if (totalPages !== null) return totalPages;
  const totalCount = positiveInteger(pagination.totalCount ?? pagination.total_count);
  return totalCount === null ? (receivedItems < PAGE_SIZE ? 0 : null) : Math.ceil(totalCount / PAGE_SIZE);
};

export const parseWorldBloomItems = (items: unknown[]): WorldBloomMetadata[] => {
  const chaptersByEvent = new Map<number, Map<string, WorldBloomChapter>>();
  for (const item of items) {
    const parsed = parseChapter(item);
    if (!parsed) continue;
    const chapters = chaptersByEvent.get(parsed.eventId) ?? new Map<string, WorldBloomChapter>();
    chaptersByEvent.set(parsed.eventId, chapters);
    const key = `${parsed.chapter.chapterNo}:${parsed.chapter.gameCharacterId}`;
    if (!chapters.has(key)) chapters.set(key, parsed.chapter);
  }

  return [...chaptersByEvent.entries()]
    .map(([eventId, chapters]) => ({
      eventId,
      chapters: [...chapters.values()].sort(
        (left, right) => left.chapterNo - right.chapterNo || left.gameCharacterId - right.gameCharacterId
      )
    }))
    .filter((item) => item.chapters.length > 0)
    .sort((left, right) => right.eventId - left.eventId);
};

export const getWorldBloomMetadata = async (
  baseUrl: string,
  region: TrackerRegion
): Promise<WorldBloomResult> => {
  try {
    const allItems: WorldBloomResponse[] = [];
    const seenPages = new Set<number>();
    let page = 1;

    for (let requestCount = 0; requestCount < MAX_PAGES; requestCount += 1) {
      if (seenPages.has(page)) return { status: "invalid-data", items: [] };
      seenPages.add(page);
      const response = await withRequestTimeout((signal) =>
        getWorldBloomsByRegionList({
          baseUrl,
          path: { region },
          query: { page, page_size: PAGE_SIZE, sort_by: "id", sort_order: "desc", spoiler: false },
          signal
        })
      );
      if ("error" in response && response.error) return { status: "sdk-error", items: [] };

      const payload = object(unwrap(response.data));
      const items = payload?.items;
      if (!payload || !Array.isArray(items)) return { status: "invalid-data", items: [] };
      allItems.push(...items);

      const pages = pageCount(payload, items.length);
      if (pages === 0 || (pages !== null && page >= pages)) {
        return { status: "available", items: parseWorldBloomItems(allItems) };
      }
      page += 1;
    }
    return { status: "invalid-data", items: [] };
  } catch {
    return { status: "network-error", items: [] };
  }
};
