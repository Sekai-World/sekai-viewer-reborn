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

export type EventMetadataResponse = {
  status: CatalogRequestStatus;
  metadata: TrackerEventMetadata | null;
};

export type EventMetadataResult = {
  /** Overall status follows the selected event metadata request. */
  status: CatalogRequestStatus;
  currentStatus: CatalogRequestStatus;
  selectedStatus: CatalogRequestStatus;
  currentEvent: TrackerEventMetadata | null;
  /** The requested event, which must never fall back to current-event metadata. */
  selectedEvent: TrackerEventMetadata | null;
};

export type EventSearchResult = {
  status: CatalogRequestStatus;
  events: TrackerEventMetadata[];
};

const EVENT_METADATA_TTL_MS = 5 * 60 * 1000;
const EVENT_SEARCH_TTL_MS = 60 * 1000;
export const MAX_EVENT_SEARCH_RESULTS = 10;

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
  const source = record(root?.event) ?? record(root?.currentEvent) ?? root;
  if (!source) return null;
  const id = positiveId(source.id ?? source.eventId);
  const name = source.name ?? source.title;
  if (id === null || typeof name !== "string" || !name) return null;
  return {
    id,
    name,
    startAt: dateValue(source.startAt ?? source.start_at),
    aggregateAt: dateValue(source.aggregateAt ?? source.aggregate_at),
    closedAt: dateValue(source.closedAt ?? source.closed_at)
  };
};

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
  // The generated SDK normally returns { data, response, request }, but a
  // client configured with responseStyle="data" returns the payload itself.
  return source && "data" in source ? source.data : value;
};

const hasSdkError = (value: unknown): boolean => {
  const source = record(value);
  return Boolean(source?.error);
};

const parseEventResponse = (result: {
  status: CatalogRequestStatus;
  value?: unknown;
}): EventMetadataResponse => {
  if (result.status !== "available") return { status: result.status, metadata: null };
  if (hasSdkError(result.value)) return { status: "sdk-error", metadata: null };

  const metadata = event(responseData(result.value));
  return metadata ? { status: "available", metadata } : { status: "invalid-data", metadata: null };
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

const parseListResponse = (result: {
  status: CatalogRequestStatus;
  value?: unknown;
}): EventSearchResult => {
  if (result.status !== "available") return { status: result.status, events: [] };
  if (hasSdkError(result.value)) return { status: "sdk-error", events: [] };

  const items = record(unwrap(responseData(result.value)))?.items;
  if (!Array.isArray(items)) return { status: "invalid-data", events: [] };

  return {
    status: "available",
    events: items
      .map(event)
      .filter((value): value is TrackerEventMetadata => value !== null && isEligibleEvent(value))
      .slice(0, MAX_EVENT_SEARCH_RESULTS)
  };
};

const isSuccessfulMetadata = (value: EventMetadataResponse): boolean =>
  value.status === "available" && value.metadata !== null;

const isSuccessfulSearch = (value: EventSearchResult): boolean => value.status === "available";

export const getCurrentEventMetadata = async (
  baseUrl: string,
  region: TrackerRegion
): Promise<EventMetadataResponse> =>
  getCachedMetadata(
    `event-current|${baseUrl}|${region}`,
    () =>
      withTimeout((signal) => getEventsByRegionCurrent({ baseUrl, path: { region }, signal })).then(
        parseEventResponse
      ),
    EVENT_METADATA_TTL_MS,
    isSuccessfulMetadata
  );

export const getSelectedEventMetadata = async (
  baseUrl: string,
  region: TrackerRegion,
  eventId: number
): Promise<EventMetadataResponse> =>
  getCachedMetadata(
    `event-by-id|${baseUrl}|${region}|${eventId}`,
    async () => {
      const result = await withTimeout((signal) =>
        getEventsByRegionById({ baseUrl, path: { region, id: String(eventId) }, signal })
      );
      const parsed = parseEventResponse(result);
      if (parsed.status !== "available") return parsed;
      return parsed.metadata?.id === eventId
        ? parsed
        : { status: "invalid-data" as const, metadata: null };
    },
    EVENT_METADATA_TTL_MS,
    isSuccessfulMetadata
  );

/**
 * Search is intentionally separate from initial event metadata. The tracker
 * only calls this after the user provides a non-empty name query.
 */
export const searchEvents = async (
  baseUrl: string,
  region: TrackerRegion,
  query: string
): Promise<EventSearchResult> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { status: "available", events: [] };

  return getCachedMetadata(
    `event-search|${baseUrl}|${region}|${normalizedQuery.toLocaleLowerCase()}`,
    () =>
      withTimeout((signal) =>
        getEventsByRegionList({
          baseUrl,
          path: { region },
          query: {
            page: 1,
            page_size: MAX_EVENT_SEARCH_RESULTS,
            name: normalizedQuery,
            sort_by: "startAt",
            sort_order: "desc"
          },
          signal
        })
      ).then(parseListResponse),
    EVENT_SEARCH_TTL_MS,
    isSuccessfulSearch
  );
};

/** Resolve picker input without ever using the list endpoint for numeric IDs. */
export const getEventPickerResults = async (
  baseUrl: string,
  region: TrackerRegion,
  query: string
): Promise<EventSearchResult> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { status: "available", events: [] };

  if (/^\d+$/.test(normalizedQuery)) {
    const eventId = positiveId(normalizedQuery);
    if (eventId === null) return { status: "invalid-data", events: [] };
    const result = await getSelectedEventMetadata(baseUrl, region, eventId);
    return {
      status: result.status,
      events: result.metadata ? [result.metadata] : []
    };
  }

  return searchEvents(baseUrl, region, normalizedQuery);
};

export const getEventMetadata = async (
  baseUrl: string,
  region: TrackerRegion,
  selectedEventId?: number
): Promise<EventMetadataResult> => {
  const current = getCurrentEventMetadata(baseUrl, region);
  const selected =
    selectedEventId === undefined
      ? current
      : getSelectedEventMetadata(baseUrl, region, selectedEventId);
  const [currentResult, selectedResult] = await Promise.all([current, selected]);
  return {
    status: selectedResult.status,
    currentStatus: currentResult.status,
    selectedStatus: selectedResult.status,
    currentEvent: currentResult.metadata,
    selectedEvent: selectedResult.metadata
  };
};
