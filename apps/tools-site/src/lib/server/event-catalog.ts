import {
  getEventsByRegionById,
  getEventsByRegionCurrent,
  getEventsByRegionList
} from "@platform/sekai-master-api-sdk";
import type { TrackerRegion } from "./event-tracker";

export type TrackerEventMetadata = {
  id: number;
  name: string;
  startAt: string | number | null;
  /** The actual ranking aggregation deadline, when the upstream API supplies it. */
  aggregateAt: string | number | null;
  /** Event closure is distinct from the ranking aggregation deadline. */
  closedAt: string | number | null;
};
export type CatalogRequestStatus = "available" | "sdk-error" | "network-error" | "invalid-data";
export type EventCatalogResult = {
  /** Overall status follows the selected event metadata request. */
  status: CatalogRequestStatus;
  currentStatus: CatalogRequestStatus;
  listStatus: CatalogRequestStatus;
  currentEvent: TrackerEventMetadata | null;
  /** The requested event, which must never fall back to current-event metadata. */
  selectedEvent: TrackerEventMetadata | null;
  eligibleEvents: TrackerEventMetadata[];
};

const EVENT_CATALOG_TIMEOUT_MS = 5_000;

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const unwrap = (value: unknown): unknown => {
  let current = value;
  let source = record(current);
  while (source && "data" in source && source.data !== undefined) {
    current = source.data;
    source = record(current);
  }
  return current;
};
const positiveId = (value: unknown): number | null => {
  const id = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
};
const event = (value: unknown): TrackerEventMetadata | null => {
  const unwrapped = unwrap(value);
  const root = record(unwrapped);
  const source = record(root?.event) ?? root;
  const id = positiveId(source?.id);
  const name = source?.name;
  if (id === null || typeof name !== "string" || !name) return null;
  const date = (value: unknown): string | number | null => typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? value : null;
  return {
    id,
    name,
    startAt: date(source.startAt),
    aggregateAt: date(source.aggregateAt),
    closedAt: date(source.closedAt)
  };
};

const unavailableCatalog = (currentStatus: CatalogRequestStatus, listStatus: CatalogRequestStatus): EventCatalogResult => ({
  status: currentStatus,
  currentStatus,
  listStatus,
  currentEvent: null,
  selectedEvent: null,
  eligibleEvents: []
});

const withTimeout = async <T>(request: (signal: AbortSignal) => Promise<T>): Promise<{ status: CatalogRequestStatus; value?: T }> => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      request(controller.signal),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("Event catalog request timed out"));
        }, EVENT_CATALOG_TIMEOUT_MS);
      })
    ]);
    return { status: "available", value };
  } catch (error) {
    return { status: error instanceof Error && error.message === "Event catalog request timed out" ? "network-error" : "network-error" };
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

const mergeEventMetadata = (
  currentEvent: TrackerEventMetadata | null,
  listEvents: TrackerEventMetadata[]
): TrackerEventMetadata | null => {
  if (currentEvent === null) return null;
  const listedEvent = listEvents.find((candidate) => candidate.id === currentEvent.id);
  if (!listedEvent) return currentEvent;
  return {
    ...currentEvent,
    startAt: currentEvent.startAt ?? listedEvent.startAt,
    aggregateAt: currentEvent.aggregateAt ?? listedEvent.aggregateAt,
    closedAt: currentEvent.closedAt ?? listedEvent.closedAt
  };
};

const getListEvents = (value: unknown): TrackerEventMetadata[] | null => {
  const items = record(unwrap(value))?.items;
  if (!Array.isArray(items)) return null;
  return items.map(event).filter((value): value is TrackerEventMetadata => value !== null).filter((value) => {
    if (value.startAt === null) return false;
    const start = new Date(value.startAt).getTime();
    return Number.isNaN(start) || start <= Date.now();
  });
};

export const getEventCatalog = async (
  baseUrl: string,
  region: TrackerRegion,
  selectedEventId?: number
): Promise<EventCatalogResult> => {
  const [current, list] = await Promise.all([
    withTimeout((signal) => getEventsByRegionCurrent({ baseUrl, path: { region }, signal })),
    withTimeout((signal) => getEventsByRegionList({ baseUrl, path: { region }, query: { page_size: 1000, sort_by: "startAt", sort_order: "desc" }, signal }))
  ]);

  const currentStatus: CatalogRequestStatus = current.status === "available"
    ? current.value && "error" in current.value && current.value.error
      ? "sdk-error"
      : event(current.value && "data" in current.value ? current.value.data : null) ? "available" : "invalid-data"
    : current.status;
  const listStatus: CatalogRequestStatus = list.status === "available"
    ? list.value && "error" in list.value && list.value.error ? "sdk-error" : "available"
    : list.status;

  const listEvents = listStatus === "available" ? getListEvents(list.value && "data" in list.value ? list.value.data : null) : null;
  const eligibleEvents = listEvents ?? [];
  const normalizedListStatus = listStatus === "available" && listEvents === null ? "invalid-data" : listStatus;
  const currentEvent = currentStatus === "available"
    ? event(current.value && "data" in current.value ? current.value.data : null)
    : null;
  const mergedCurrentEvent = mergeEventMetadata(currentEvent, eligibleEvents);

  if (selectedEventId !== undefined) {
    const listedEvent = eligibleEvents.find((candidate) => candidate.id === selectedEventId) ?? null;
    if (listedEvent) {
      return {
        status: "available",
        currentStatus,
        listStatus: normalizedListStatus,
        currentEvent: mergedCurrentEvent,
        selectedEvent: listedEvent,
        eligibleEvents
      };
    }

    const selected = await withTimeout((signal) =>
      getEventsByRegionById({ baseUrl, path: { region, id: String(selectedEventId) }, signal })
    );
    const selectedMetadata = selected.value && "data" in selected.value
      ? event(selected.value.data)
      : null;
    const selectedStatus: CatalogRequestStatus = selected.status === "available"
      ? selected.value && "error" in selected.value && selected.value.error
        ? "sdk-error"
        : selectedMetadata?.id === selectedEventId ? "available" : "invalid-data"
      : selected.status;
    return {
      status: selectedStatus,
      currentStatus,
      listStatus: normalizedListStatus,
      currentEvent: mergedCurrentEvent,
      selectedEvent: selectedStatus === "available" ? selectedMetadata : null,
      eligibleEvents
    };
  }

  if (currentStatus !== "available" || !mergedCurrentEvent) {
    return unavailableCatalog(currentStatus === "available" ? "invalid-data" : currentStatus, normalizedListStatus);
  }
  return {
    status: "available",
    currentStatus: "available",
    listStatus: normalizedListStatus,
    currentEvent: mergedCurrentEvent,
    selectedEvent: mergedCurrentEvent,
    eligibleEvents
  };
};
