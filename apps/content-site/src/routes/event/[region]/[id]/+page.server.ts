import { dev } from "$app/environment";
import {
  getEventsByRegionByIdDetail,
  getEventsRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n/runtime";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  parseEventAggregateRelatedData,
  parseEventDetail,
  type EventDetail
} from "$lib/server/event-detail";
import type { EventRelatedData } from "$lib/domain/event-detail";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import type { PageServerLoad } from "./$types";

type EventPayload = {
  event: EventDetail | null;
  relatedData: EventRelatedData | null;
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

type EventAggregateLookup = {
  region: SupportedRegion;
  event: EventDetail | null;
  relatedData: EventRelatedData | null;
  availableRegions: SupportedRegion[];
  isCurrentEvent: boolean;
  exists: boolean;
  rawPayloadJson: string | null;
};

const fetchEventAggregate = async (
  baseUrl: string,
  region: SupportedRegion,
  eventId: string
): Promise<EventAggregateLookup> => {
  try {
    const response = await getEventsByRegionByIdDetail({
      baseUrl,
      path: { region, id: eventId }
    });

    if (response.error) {
      return {
        region,
        event: null,
        relatedData: null,
        availableRegions: [],
        isCurrentEvent: false,
        exists: false,
        rawPayloadJson: null
      };
    }

    const event = parseEventDetail(response.data);
    return {
      region,
      event,
      relatedData: event ? parseEventAggregateRelatedData(response.data) : null,
      availableRegions: normalizeAvailableRegions(response.data),
      isCurrentEvent: getObject(response.data)?.["isCurrentEvent"] === true,
      exists: event !== null,
      rawPayloadJson: JSON.stringify(response.data, null, 2)
    };
  } catch {
    return {
      region,
      event: null,
      relatedData: null,
      availableRegions: [],
      isCurrentEvent: false,
      exists: false,
      rawPayloadJson: null
    };
  }
};

const fetchAvailableRegions = async ({
  baseUrl,
  eventId,
  region,
  aggregatePromise
}: {
  baseUrl: string;
  eventId: string;
  region: SupportedRegion;
  aggregatePromise: Promise<EventAggregateLookup>;
}): Promise<SupportedRegion[]> => {
  const aggregate = await aggregatePromise;
  let detectedRegions = aggregate.availableRegions;

  if (!aggregate.exists && detectedRegions.length === 0) {
    try {
      const response = await getEventsRegionsByIdAvailability({
        baseUrl,
        path: { id: eventId }
      });
      detectedRegions = response.error ? [] : normalizeAvailableRegions(response.data);
    } catch {
      detectedRegions = [];
    }
  }

  if (aggregate.exists && !detectedRegions.includes(region)) {
    return [region, ...detectedRegions];
  }

  return detectedRegions.includes(region) ? detectedRegions : [region, ...detectedRegions];
};

const fetchEventPayload = async ({
  aggregatePromise,
  invalidEventIdMessage
}: {
  aggregatePromise: Promise<EventAggregateLookup>;
  invalidEventIdMessage: string | null;
}): Promise<EventPayload> => {
  if (invalidEventIdMessage) {
    return {
      event: null,
      relatedData: null,
      debugEventJson: null,
      error: invalidEventIdMessage
    };
  }

  try {
    const aggregate = await aggregatePromise;

    return {
      event: aggregate.event,
      relatedData: aggregate.relatedData,
      debugEventJson: dev ? aggregate.rawPayloadJson : null,
      error: null
    };
  } catch {
    return {
      event: null,
      relatedData: null,
      debugEventJson: null,
      error: null
    };
  }
};

const fetchIsCurrentEvent = async ({
  aggregatePromise,
  invalidEventIdMessage
}: {
  aggregatePromise: Promise<EventAggregateLookup>;
  invalidEventIdMessage: string | null;
}): Promise<boolean> => {
  if (invalidEventIdMessage) {
    return false;
  }

  return (await aggregatePromise).isCurrentEvent;
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
  const aggregatePromise = eventId
    ? fetchEventAggregate(baseUrl, region, eventId)
    : Promise.resolve({
        region,
        event: null,
        relatedData: null,
        availableRegions: [region],
        isCurrentEvent: false,
        exists: false,
        rawPayloadJson: null
      } satisfies EventAggregateLookup);

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
          aggregatePromise
        })
      : Promise.resolve([region] satisfies SupportedRegion[]),
    eventPayload: fetchEventPayload({
      aggregatePromise,
      invalidEventIdMessage: eventId ? null : invalidEventIdMessage
    }),
    unitProfiles: fetchUnitProfiles(baseUrl, region).then(toUnitProfileMap),
    isCurrentEvent: fetchIsCurrentEvent({
      aggregatePromise,
      invalidEventIdMessage: eventId ? null : invalidEventIdMessage
    })
  };
};
