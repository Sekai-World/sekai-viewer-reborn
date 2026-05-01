import { dev } from "$app/environment";
import {
  getEventsByRegionCurrent,
  getEventsByRegionById,
  getEventsRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/regions";
import {
  normalizeRegion,
  normalizeUiLocale,
  UI_LOCALE_COOKIE_NAME
} from "$lib/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { parseEventDetail, type EventDetail } from "$lib/server/event-detail";
import type { PageServerLoad } from "./$types";

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

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

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

const fetchIsCurrentEvent = async ({
  baseUrl,
  region,
  eventId,
  invalidEventIdMessage
}: {
  baseUrl: string;
  region: SupportedRegion;
  eventId: string;
  invalidEventIdMessage: string | null;
}): Promise<boolean> => {
  if (invalidEventIdMessage) {
    return false;
  }

  try {
    const response = await getEventsByRegionCurrent({
      baseUrl,
      path: { region }
    });

    if (response.error) {
      return false;
    }

    return parseEventDetail(response.data)?.id === eventId;
  } catch {
    return false;
  }
};

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const eventId = params.id?.trim() ?? "";
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [
    invalidEventIdMessage,
    eventUnavailableInCurrentRegionMessage,
    failedToLoadEventDataMessage
  ] = await Promise.all([
    getServerI18nText(uiLocale, "invalidEventId", fetch),
    getServerI18nText(uiLocale, "eventUnavailableInCurrentRegion", fetch),
    getServerI18nText(uiLocale, "failedToLoadEventData", fetch)
  ]);
  const region: SupportedRegion = normalizeRegion(params.region);
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
    }),
    isCurrentEvent: fetchIsCurrentEvent({
      baseUrl,
      region,
      eventId,
      invalidEventIdMessage: eventId ? null : invalidEventIdMessage
    })
  };
};
