import {
  getEventsByRegionById,
  getEventsByRegionCurrent,
  getEventsByRegionList
} from "@platform/sekai-master-api-sdk";
import type { TrackerRegion } from "./event-tracker";
import { withRequestTimeout } from "./network";
import { getCachedMetadata } from "./metadata-cache";

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

const record = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};
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
  let id: number | null = null;
  if (typeof value === "number") {
    id = value;
  } else if (typeof value === "string" && /^\d+$/.test(value)) {
    id = Number(value);
  }
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
};

const dateValue = (value: unknown): string | number | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};
const event = (value: unknown): TrackerEventMetadata | null => {
  const unwrapped = unwrap(value);
  const root = record(unwrapped);
  const source = record(root?.event) ?? root;
  const id = positiveId(source?.id);
  const name = source?.name;
  if (id === null || typeof name !== "string" || !name) return null;
  return {
    id,
    name,
    startAt: dateValue(source.startAt),
    aggregateAt: dateValue(source.aggregateAt),
    closedAt: dateValue(source.closedAt)
  };
};

const unavailableCatalog = (
  currentStatus: CatalogRequestStatus,
  listStatus: CatalogRequestStatus
): EventCatalogResult => ({
  status: currentStatus,
  currentStatus,
  listStatus,
  currentEvent: null,
  selectedEvent: null,
  eligibleEvents: []
});

const withTimeout = async <T>(
  request: (signal: AbortSignal) => Promise<T>
): Promise<{ status: CatalogRequestStatus; value?: T }> => {
  try {
    const value = await withRequestTimeout(request);
    return { status: "available", value };
  } catch {
    return { status: "network-error" };
  }
};

const responseData = (value: unknown): unknown => {
  const source = record(value);
  return source && "data" in source ? source.data : null;
};

const hasSdkError = (value: unknown): boolean => {
  const source = record(value);
  return Boolean(source?.error);
};

type ParsedEventResponse = {
  status: CatalogRequestStatus;
  metadata: TrackerEventMetadata | null;
};

const parseEventResponse = (result: {
  status: CatalogRequestStatus;
  value?: unknown;
}): ParsedEventResponse => {
  if (result.status !== "available") return { status: result.status, metadata: null };
  if (hasSdkError(result.value)) return { status: "sdk-error", metadata: null };

  const metadata = event(responseData(result.value));
  return metadata ? { status: "available", metadata } : { status: "invalid-data", metadata: null };
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

const timestamp = (value: string | number | null): number | null => {
  if (value === null) return null;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
};

const isEligibleEvent = (value: TrackerEventMetadata): boolean => {
  const start = timestamp(value.startAt);
  return start !== null && start <= Date.now();
};

const getCurrentEventFromList = (events: TrackerEventMetadata[]): TrackerEventMetadata | null => {
  const now = Date.now();
  return (
    events
      .filter((value) => {
        const start = timestamp(value.startAt);
        const closed = timestamp(value.closedAt);
        return start !== null && closed !== null && start <= now && now <= closed;
      })
      .sort(
        (left, right) =>
          (timestamp(right.startAt) ?? -Infinity) - (timestamp(left.startAt) ?? -Infinity)
      )
      .at(0) ?? null
  );
};

const getListEvents = (value: unknown): TrackerEventMetadata[] | null => {
  const items = record(unwrap(value))?.items;
  if (!Array.isArray(items)) return null;
  return items.map(event).filter((value): value is TrackerEventMetadata => value !== null);
};

const parseListResponse = (result: {
  status: CatalogRequestStatus;
  value?: unknown;
}): {
  status: CatalogRequestStatus;
  events: TrackerEventMetadata[];
  allEvents: TrackerEventMetadata[];
} => {
  if (result.status !== "available") return { status: result.status, events: [], allEvents: [] };
  if (hasSdkError(result.value)) return { status: "sdk-error", events: [], allEvents: [] };

  const events = getListEvents(responseData(result.value));
  return events
    ? { status: "available", events: events.filter(isEligibleEvent), allEvents: events }
    : { status: "invalid-data", events: [], allEvents: [] };
};

const getSelectedEvent = async (
  baseUrl: string,
  region: TrackerRegion,
  selectedEventId: number,
  eligibleEvents: TrackerEventMetadata[],
  currentEvent: TrackerEventMetadata | null
): Promise<{ status: CatalogRequestStatus; metadata: TrackerEventMetadata | null }> => {
  if (currentEvent?.id === selectedEventId) return { status: "available", metadata: currentEvent };
  const listedEvent = eligibleEvents.find((candidate) => candidate.id === selectedEventId);
  if (listedEvent) return { status: "available", metadata: listedEvent };

  const result = await withTimeout((signal) =>
    getEventsByRegionById({ baseUrl, path: { region, id: String(selectedEventId) }, signal })
  );
  const parsed = parseEventResponse(result);
  if (parsed.status !== "available" || parsed.metadata?.id !== selectedEventId) {
    return {
      status: parsed.status === "available" ? "invalid-data" : parsed.status,
      metadata: null
    };
  }
  return parsed;
};

export const getEventCatalog = async (
  baseUrl: string,
  region: TrackerRegion,
  selectedEventId?: number
): Promise<EventCatalogResult> => {
  const { current, list } = await getCachedMetadata(
    `event-catalog|${baseUrl}|${region}`,
    () =>
      Promise.all([
        withTimeout((signal) => getEventsByRegionCurrent({ baseUrl, path: { region }, signal })),
        withTimeout((signal) =>
          getEventsByRegionList({
            baseUrl,
            path: { region },
            query: { page_size: 1000, sort_by: "startAt", sort_order: "desc" },
            signal
          })
        )
      ]).then(([current, list]) => ({ current, list })),
    5 * 60 * 1000,
    ({ current, list }) => current.status === "available" && list.status === "available"
  );

  const currentResult = parseEventResponse(current);
  const listResult = parseListResponse(list);
  const { status: currentStatus, metadata: currentEvent } = currentResult;
  const { status: normalizedListStatus, events: eligibleEvents, allEvents } = listResult;
  const listedCurrentEvent =
    currentStatus === "available" ? null : getCurrentEventFromList(allEvents);
  const mergedCurrentEvent = mergeEventMetadata(currentEvent ?? listedCurrentEvent, eligibleEvents);

  if (selectedEventId !== undefined) {
    const selected = await getSelectedEvent(
      baseUrl,
      region,
      selectedEventId,
      eligibleEvents,
      mergedCurrentEvent
    );
    return {
      status: selected.status,
      currentStatus,
      listStatus: normalizedListStatus,
      currentEvent: mergedCurrentEvent,
      selectedEvent: selected.metadata,
      eligibleEvents
    };
  }

  if (!mergedCurrentEvent) {
    return unavailableCatalog(
      currentStatus === "available" ? "invalid-data" : currentStatus,
      normalizedListStatus
    );
  }
  return {
    status: "available",
    currentStatus,
    listStatus: normalizedListStatus,
    currentEvent: mergedCurrentEvent,
    selectedEvent: mergedCurrentEvent,
    eligibleEvents
  };
};
