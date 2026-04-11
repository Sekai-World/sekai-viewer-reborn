import { dev } from "$app/environment";
import {
  getEventsByRegionById,
  getEventsRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import {
  getContentSiteServerText,
  regionLabels,
  supportedRegions,
  type SupportedRegion
} from "@platform/i18n-dicts";
import {
  DEFAULT_REGION,
  normalizeRegion,
  normalizeUiLocale,
  UI_LOCALE_COOKIE_NAME
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
  rawPayloadJson: string | null;
};

type EventPayload = {
  event: EventDetail | null;
  debugEventJson: string | null;
  error: string | null;
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

const normalizeAvailableRegions = (payload: unknown): SupportedRegion[] => {
  const root = getObject(payload);

  const toSupportedRegionList = (value: unknown): SupportedRegion[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (region): region is SupportedRegion =>
        typeof region === "string" && supportedRegions.includes(region as SupportedRegion)
    );
  };

  const toSupportedRegionMap = (value: unknown): SupportedRegion[] => {
    const record = getObject(value);
    if (!record) {
      return [];
    }

    return supportedRegions.filter((region) => {
      const regionValue = record[region];

      if (regionValue === true) {
        return true;
      }

      const nested = getObject(regionValue);
      return nested?.available === true || nested?.exists === true;
    });
  };

  const fromRootArray = toSupportedRegionList(payload);
  if (fromRootArray.length > 0) {
    return fromRootArray;
  }

  if (!root) {
    return [];
  }

  const candidateArrayKeys = ["availableRegions", "regions"];
  for (const key of candidateArrayKeys) {
    const regions = toSupportedRegionList(root[key]);
    if (regions.length > 0) {
      return regions;
    }
  }

  const candidateMapKeys = ["availability", "availableRegions", "regions"];
  for (const key of candidateMapKeys) {
    const regions = toSupportedRegionMap(root[key]);
    if (regions.length > 0) {
      return regions;
    }
  }

  const dataNode = getObject(root.data);
  if (dataNode) {
    const nestedRegions = normalizeAvailableRegions(dataNode);
    if (nestedRegions.length > 0) {
      return nestedRegions;
    }
  }

  return [];
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
        exists: false,
        rawPayloadJson: null
      };
    }

    const event = parseEventDetail(response.data);
    return {
      region,
      event,
      exists: event !== null,
      rawPayloadJson: JSON.stringify(response.data, null, 2)
    };
  } catch {
    return {
      region,
      event: null,
      exists: false,
      rawPayloadJson: null
    };
  }
};

const fetchAvailableRegions = async ({
  baseUrl,
  eventId,
  region,
  currentLookupPromise
}: {
  baseUrl: string;
  eventId: string;
  region: SupportedRegion;
  currentLookupPromise: Promise<RegionEventLookup>;
}): Promise<SupportedRegion[]> => {
  try {
    const [currentLookup, availabilityResponse] = await Promise.all([
      currentLookupPromise,
      getEventsRegionsByIdAvailability({
        baseUrl,
        path: { id: eventId }
      })
    ]);
    const detectedRegions = availabilityResponse.error
      ? []
      : normalizeAvailableRegions(availabilityResponse.data);

    if (currentLookup.exists && !detectedRegions.includes(region)) {
      return [region, ...detectedRegions];
    }

    return detectedRegions.includes(region)
      ? detectedRegions
      : [region, ...detectedRegions];
  } catch {
    return [region];
  }
};

const fetchEventPayload = async ({
  currentLookupPromise,
  invalidEventIdMessage
}: {
  currentLookupPromise: Promise<RegionEventLookup>;
  invalidEventIdMessage: string | null;
}): Promise<EventPayload> => {
  if (invalidEventIdMessage) {
    return {
      event: null,
      debugEventJson: null,
      error: invalidEventIdMessage
    };
  }

  try {
    const currentLookup = await currentLookupPromise;

    return {
      event: currentLookup.event,
      debugEventJson: dev ? currentLookup.rawPayloadJson : null,
      error: null
    };
  } catch {
    return {
      event: null,
      debugEventJson: null,
      error: null
    };
  }
};

export const load: PageServerLoad = ({ params, url, cookies }) => {
  const eventId = params.id?.trim() ?? "";
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const invalidEventIdMessage = getContentSiteServerText(uiLocale, "invalidEventId");
  const eventUnavailableInCurrentRegionMessage = getContentSiteServerText(
    uiLocale,
    "eventUnavailableInCurrentRegion"
  );
  const failedToLoadEventDataMessage = getContentSiteServerText(uiLocale, "failedToLoadEventData");
  const region: SupportedRegion = normalizeRegion(url.searchParams.get("region"), DEFAULT_REGION);
  const baseUrl = getMasterApiBaseUrl();
  const currentLookupPromise = eventId
    ? fetchRegionEvent(baseUrl, region, eventId)
    : Promise.resolve({
        region,
        event: null,
        exists: false,
        rawPayloadJson: null
      } satisfies RegionEventLookup);

  return {
    eventId,
    region,
    regionLabel: regionLabels[region],
    eventUnavailableInCurrentRegionMessage,
    failedToLoadEventDataMessage,
    availableRegions: eventId
      ? fetchAvailableRegions({
          baseUrl,
          eventId,
          region,
          currentLookupPromise
        })
      : Promise.resolve([region] satisfies SupportedRegion[]),
    eventPayload: fetchEventPayload({
      currentLookupPromise,
      invalidEventIdMessage: eventId ? null : invalidEventIdMessage
    })
  };
};
