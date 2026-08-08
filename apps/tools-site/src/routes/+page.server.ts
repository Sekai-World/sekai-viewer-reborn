import { getEventsByRegionCurrent } from "@platform/sekai-master-api-sdk";
import { normalizeRegion, type SupportedRegion } from "$lib/regions";
import { getMasterApiBaseUrl } from "$lib/server/config";
import type { PageServerLoad } from "./$types";

export type EventSummary = {
  id: string;
  name: string;
  eventType: string | null;
  unit: string | null;
  startAt: string | number | null;
  aggregateAt: string | number | null;
  closedAt: string | number | null;
};

export type RegionCurrentEvent =
  | { region: SupportedRegion; status: "available"; event: EventSummary }
  | { region: SupportedRegion; status: "unavailable"; event: null }
  | { region: SupportedRegion; status: "failed"; event: null };

const DEFAULT_PRIMARY_REGION: SupportedRegion = "jp";
const DEFAULT_SECONDARY_REGION: SupportedRegion = "en";
const CURRENT_EVENT_REQUEST_TIMEOUT_MS = 5_000;

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null =>
  getString(value) ?? (typeof value === "number" && Number.isFinite(value) ? String(value) : null);

const getDateValue = (value: unknown): string | number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : getString(value);

const pick = <Value>(
  source: Record<string, unknown>,
  keys: readonly string[],
  parser: (value: unknown) => Value | null
): Value | null => {
  for (const key of keys) {
    const value = parser(source[key]);
    if (value !== null) return value;
  }

  return null;
};

const parseEventSummary = (payload: unknown): EventSummary | null => {
  const root = getObject(payload);
  if (!root) return null;

  const event =
    getObject(root.event) ?? getObject(root.currentEvent) ?? getObject(root.data) ?? root;
  const unitRecord = getObject(event.unit);
  const id = pick(event, ["id", "eventId"], getStringLike);
  const name = pick(event, ["name", "title", "eventName"], getString);

  if (!id || !name) return null;

  return {
    id,
    name,
    eventType: pick(event, ["eventType", "event_type"], getString),
    unit: pick(unitRecord ?? event, ["unit", "unitName"], getString),
    startAt: pick(event, ["startAt", "start_at", "startDate"], getDateValue),
    aggregateAt: pick(event, ["aggregateAt", "aggregate_at", "endAt", "end_at"], getDateValue),
    closedAt: pick(event, ["closedAt", "closed_at"], getDateValue)
  };
};

const getResponseStatus = (response: { response?: Response }): number | null =>
  response.response?.status ?? null;

const fetchCurrentEvent = async (
  baseUrl: string,
  region: SupportedRegion
): Promise<RegionCurrentEvent> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CURRENT_EVENT_REQUEST_TIMEOUT_MS);

  try {
    const response = await getEventsByRegionCurrent({
      baseUrl,
      path: { region },
      signal: controller.signal
    });

    if (response.error) {
      return getResponseStatus(response) === 404
        ? { region, status: "unavailable", event: null }
        : { region, status: "failed", event: null };
    }

    const event = parseEventSummary(response.data);
    return event
      ? { region, status: "available", event }
      : { region, status: "unavailable", event: null };
  } catch {
    return { region, status: "failed", event: null };
  } finally {
    clearTimeout(timeout);
  }
};

export const load: PageServerLoad = async ({ url }) => {
  const primaryRegion = normalizeRegion(url.searchParams.get("primary"), DEFAULT_PRIMARY_REGION);
  const secondaryRegion = normalizeRegion(
    url.searchParams.get("secondary"),
    DEFAULT_SECONDARY_REGION
  );
  const baseUrl = getMasterApiBaseUrl();
  const [primary, secondary] = await Promise.all([
    fetchCurrentEvent(baseUrl, primaryRegion),
    fetchCurrentEvent(baseUrl, secondaryRegion)
  ]);

  return { primaryRegion, secondaryRegion, comparison: { primary, secondary } };
};
