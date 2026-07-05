import { dev } from "$app/environment";
import {
  getEventsByRegionCurrent,
  getEventsByRegionById,
  getEventsByRegionByIdBonuses,
  getEventsByRegionByIdCards,
  getEventsByRegionByIdMusics,
  getEventsByRegionByIdRewards,
  getEventsRegionsByIdAvailability,
  getCardsByRegionByIdDetail,
  getMusicsByRegionByIdDetail
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n/runtime";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  mergeEventMusicDetail,
  mergeFeaturedCardDetail,
  parseEventDetail,
  parseEventRelatedData,
  type EventDetail
} from "$lib/server/event-detail";
import { parseCardDetail } from "$lib/server/card-detail";
import { parseMusicDetail } from "$lib/server/music-detail";
import type { EventRelatedData } from "$lib/domain/event-detail";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import type { PageServerLoad } from "./$types";

type RegionEventLookup = {
  region: SupportedRegion;
  event: EventDetail | null;
  exists: boolean;
  rawPayloadJson: string | null;
};

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

    return detectedRegions.includes(region) ? detectedRegions : [region, ...detectedRegions];
  } catch {
    return [region];
  }
};

const fetchEventPayload = async ({
  baseUrl,
  region,
  eventId,
  currentLookupPromise,
  invalidEventIdMessage
}: {
  baseUrl: string;
  region: SupportedRegion;
  eventId: string;
  currentLookupPromise: Promise<RegionEventLookup>;
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
    const currentLookup = await currentLookupPromise;
    const relatedData = currentLookup.event
      ? await fetchEventRelatedData(baseUrl, region, eventId)
      : null;

    return {
      event: currentLookup.event,
      relatedData,
      debugEventJson: dev ? currentLookup.rawPayloadJson : null,
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

const getResponseData = <T>(response: { data?: T; error?: unknown }): T | null =>
  response.error ? null : (response.data ?? null);

const fetchEventRelatedData = async (
  baseUrl: string,
  region: SupportedRegion,
  eventId: string
): Promise<EventRelatedData> => {
  const [bonusesResponse, cardsResponse, musicsResponse, rewardsResponse] = await Promise.all([
    getEventsByRegionByIdBonuses({ baseUrl, path: { region, id: eventId } }),
    getEventsByRegionByIdCards({ baseUrl, path: { region, id: eventId } }),
    getEventsByRegionByIdMusics({ baseUrl, path: { region, id: eventId } }),
    getEventsByRegionByIdRewards({ baseUrl, path: { region, id: eventId } })
  ]);

  const relatedData = parseEventRelatedData({
    bonusesPayload: getResponseData(bonusesResponse),
    cardsPayload: getResponseData(cardsResponse),
    musicsPayload: getResponseData(musicsResponse),
    rewardsPayload: getResponseData(rewardsResponse)
  });

  const [cards, musics] = await Promise.all([
    Promise.all(
      relatedData.cards.map(async (eventCard) => {
        if (!eventCard.cardId) {
          return eventCard;
        }

        try {
          const response = await getCardsByRegionByIdDetail({
            baseUrl,
            path: { region, id: eventCard.cardId }
          });
          return mergeFeaturedCardDetail(
            eventCard,
            response.error ? null : parseCardDetail(response.data)
          );
        } catch {
          return eventCard;
        }
      })
    ),
    Promise.all(
      relatedData.musics.map(async (eventMusic) => {
        if (!eventMusic.musicId) {
          return eventMusic;
        }

        try {
          const response = await getMusicsByRegionByIdDetail({
            baseUrl,
            path: { region, id: eventMusic.musicId }
          });
          return mergeEventMusicDetail(
            eventMusic,
            response.error ? null : parseMusicDetail(response.data)
          );
        } catch {
          return eventMusic;
        }
      })
    )
  ]);

  return {
    ...relatedData,
    cards,
    musics
  };
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
      baseUrl,
      region,
      eventId,
      currentLookupPromise,
      invalidEventIdMessage: eventId ? null : invalidEventIdMessage
    }),
    unitProfiles: fetchUnitProfiles(baseUrl, region).then(toUnitProfileMap),
    isCurrentEvent: fetchIsCurrentEvent({
      baseUrl,
      region,
      eventId,
      invalidEventIdMessage: eventId ? null : invalidEventIdMessage
    })
  };
};
