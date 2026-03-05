import { getEventsByRegionById } from "@platform/sekai-master-api-sdk";
import { regionLabels, supportedRegions, type SupportedRegion } from "@platform/i18n-dicts";
import {
  DEFAULT_PRIMARY_REGION,
  normalizeRegion,
  PRIMARY_REGION_COOKIE_NAME
} from "$lib/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import type { PageServerLoad } from "./$types";

type EventDetail = {
  id: string;
  title: string;
  startAt: string | number | null;
  endAt: string | number | null;
  assetBundleName: string | null;
};

type RegionEventLookup = {
  region: SupportedRegion;
  event: EventDetail | null;
  exists: boolean;
};

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getNestedObject = (
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null => {
  for (const key of keys) {
    const nested = getObject(source[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const pickFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstStringLike = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstDateValue = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | number | null => {
  for (const key of keys) {
    const value = getDateValue(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const parseEventDetail = (payload: unknown): EventDetail | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const eventNode = getNestedObject(root, ["event", "data"]) ?? root;
  const id = pickFirstStringLike(eventNode, ["id", "eventId"]);
  const title = pickFirstString(eventNode, ["name", "title", "eventName"]);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    startAt: pickFirstDateValue(eventNode, ["startAt", "start_at", "startDate"]),
    endAt: pickFirstDateValue(eventNode, ["aggregateAt", "aggregate_at", "endAt", "end_at", "endDate"]),
    assetBundleName: pickFirstString(eventNode, ["assetbundleName", "assetBundleName"])
  };
};

const fetchRegionEvent = async (
  baseUrl: string,
  region: SupportedRegion,
  eventId: string
): Promise<RegionEventLookup> => {
  try {
    const response = await getEventsByRegionById({
      baseUrl,
      path: { region, id: eventId }
    });

    if (response.error) {
      return {
        region,
        event: null,
        exists: false
      };
    }

    const event = parseEventDetail(response.data);
    return {
      region,
      event,
      exists: event !== null
    };
  } catch {
    return {
      region,
      event: null,
      exists: false
    };
  }
};

export const load: PageServerLoad = async ({ params, url, cookies }) => {
  const eventId = params.id?.trim() ?? "";
  const regionFromQuery = url.searchParams.get("region");
  const regionFromCookie = cookies.get(PRIMARY_REGION_COOKIE_NAME);
  const region: SupportedRegion = normalizeRegion(
    regionFromQuery ?? regionFromCookie,
    DEFAULT_PRIMARY_REGION
  );
  const baseUrl = getMasterApiBaseUrl();

  if (!eventId) {
    return {
      eventId,
      region,
      regionLabel: regionLabels[region],
      availableRegions: [region],
      event: null,
      error: "Invalid event id."
    };
  }

  try {
    const lookups = await Promise.all(
      supportedRegions.map(async (targetRegion) =>
        fetchRegionEvent(baseUrl, targetRegion, eventId)
      )
    );
    const currentLookup = lookups.find((lookup) => lookup.region === region) ?? {
      region,
      event: null,
      exists: false
    };
    const detectedRegions = lookups
      .filter((lookup) => lookup.exists)
      .map((lookup) => lookup.region);
    const availableRegions = detectedRegions.includes(region)
      ? detectedRegions
      : [region, ...detectedRegions];

    if (!currentLookup.event) {
      return {
        eventId,
        region,
        regionLabel: regionLabels[region],
        availableRegions,
        event: null,
        error:
          detectedRegions.length > 0
            ? "This event is not available in the current region. Switch region using the badges."
            : "Failed to load event data."
      };
    }

    return {
      eventId,
      region,
      regionLabel: regionLabels[region],
      availableRegions,
      event: currentLookup.event,
      error: null
    };
  } catch {
    return {
      eventId,
      region,
      regionLabel: regionLabels[region],
      availableRegions: [region],
      event: null,
      error: "Failed to load event data."
    };
  }
};
