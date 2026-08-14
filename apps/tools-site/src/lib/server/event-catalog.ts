import { getEventsByRegionCurrent, getEventsByRegionList } from "@platform/sekai-master-api-sdk";
import type { TrackerRegion } from "./event-tracker";

export type TrackerEventMetadata = { id: number; name: string; startAt: string | number | null; closedAt: string | number | null };
export type EventCatalogResult = { status: "available" | "sdk-error" | "network-error" | "invalid-data"; currentEvent: TrackerEventMetadata | null; eligibleEvents: TrackerEventMetadata[] };

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const event = (value: unknown): TrackerEventMetadata | null => {
  const source = record(record(value)?.event) ?? record(value);
  const id = source?.id;
  const name = source?.name;
  if (!(typeof id === "number" && Number.isSafeInteger(id) && id > 0) || typeof name !== "string" || !name) return null;
  const date = (value: unknown): string | number | null => typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? value : null;
  return { id, name, startAt: date(source.startAt), closedAt: date(source.closedAt) };
};

export const getEventCatalog = async (baseUrl: string, region: TrackerRegion): Promise<EventCatalogResult> => {
  try {
    const [current, list] = await Promise.all([
      getEventsByRegionCurrent({ baseUrl, path: { region } }),
      getEventsByRegionList({ baseUrl, path: { region }, query: { page_size: 1000, sort_by: "startAt", sort_order: "desc" } })
    ]);
    if (current.error || list.error) return { status: "sdk-error", currentEvent: null, eligibleEvents: [] };
    const items = record(list.data)?.items;
    if (!Array.isArray(items)) return { status: "invalid-data", currentEvent: null, eligibleEvents: [] };
    const eligibleEvents = items
      .map(event)
      .filter((value): value is TrackerEventMetadata => value !== null)
      .filter((value) => {
        if (value.startAt === null) return false;
        const start = new Date(value.startAt).getTime();
        return Number.isNaN(start) || start <= Date.now();
      });
    return { status: "available", currentEvent: event(current.data), eligibleEvents };
  } catch { return { status: "network-error", currentEvent: null, eligibleEvents: [] }; }
};
