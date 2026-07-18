import { dev } from "$app/environment";
import {
  getMusicsByRegionById,
  getVirtualLivesByRegionById,
  getVirtualLivesByRegionByIdSchedules,
  getVirtualLivesByRegionByIdSetlists,
  getVirtualLivesRegionsByIdAvailability
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n/runtime";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import { normalizeRegion, normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  parseVirtualLiveDetail,
  parseVirtualLiveSetlistItems,
  buildCharacterUnitEnrichmentMap,
  enrichVirtualLiveCharacters,
  type VirtualLiveDetail
} from "$lib/server/virtual-live-detail";
import { aggregateGameCharacterUnitsByRegion } from "$lib/server/character-pages";
import type { PageServerLoad } from "./$types";

type VirtualLivePayload = {
  virtualLive: VirtualLiveDetail | null;
  debugVirtualLiveJson: string | null;
  error: string | null;
};

type VirtualLiveAggregateLookup = {
  region: SupportedRegion;
  virtualLive: VirtualLiveDetail | null;
  availableRegions: SupportedRegion[];
  exists: boolean;
  rawPayloadJson: string | null;
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
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

const parseVirtualLiveSchedules = (items: unknown): VirtualLiveDetail["schedules"] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const getNumber = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const getDateValue = (value: unknown): string | number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    return typeof value === "string" && value.trim().length > 0 ? value : null;
  };

  return items
    .map((item) => {
      const node = getObject(item);
      if (!node) {
        return null;
      }

      return {
        id: getNumber(node["id"]),
        virtualLiveId: getNumber(node["virtualLiveId"]),
        seq: getNumber(node["seq"]),
        startAt: getDateValue(node["startAt"]),
        endAt: getDateValue(node["endAt"]),
        isAfterEvent: typeof node["isAfterEvent"] === "boolean" ? node["isAfterEvent"] : null,
        noticeGroupId: getNumber(node["noticeGroupId"])
      };
    })
    .filter((schedule): schedule is VirtualLiveDetail["schedules"][number] => schedule !== null);
};

/**
 * Resolve a human-readable music title for a positive integer `musicId`.
 *
 * Returns `null` on any failure (missing id, non-positive id, SDK error,
 * empty response, or a response carrying no usable title). Failures are
 * always optional and never make the caller's result unavailable.
 */
const fetchMusicTitle = async (
  baseUrl: string,
  region: SupportedRegion,
  musicId: number | null
): Promise<string | null> => {
  if (typeof musicId !== "number" || !Number.isInteger(musicId) || musicId <= 0) {
    return null;
  }

  try {
    const response = await getMusicsByRegionById({
      baseUrl,
      path: { region, id: String(musicId) }
    });
    if (response.error || !response.data) {
      return null;
    }

    const title = getString(getObject(response.data)?.["title"]);
    return title;
  } catch {
    return null;
  }
};

/**
 * Enrich a parsed Virtual Live detail's `screenMvMusicVocal` with a fetched
 * music title, when a valid `musicId` is present.
 *
 * Immutable: returns a new detail object and never mutates the input. When
 * there is no `screenMvMusicVocal`, no valid `musicId`, or the lookup fails,
 * the detail is returned unchanged (with `musicTitle` left undefined → null
 * on serialization). The `musicId` is already captured by the parser so the
 * UI retains a `/music/:region/:id` link with a useful fallback.
 */
const enrichScreenMvMusicTitle = async (
  detail: VirtualLiveDetail,
  baseUrl: string,
  region: SupportedRegion
): Promise<VirtualLiveDetail> => {
  const screenMv = detail.screenMvMusicVocal;
  if (!screenMv || typeof screenMv.musicId !== "number" || screenMv.musicId <= 0) {
    return detail;
  }

  const musicTitle = await fetchMusicTitle(baseUrl, region, screenMv.musicId);
  if (musicTitle === null) {
    return detail;
  }

  return {
    ...detail,
    screenMvMusicVocal: {
      ...screenMv,
      musicTitle
    }
  };
};

const fetchVirtualLiveAggregate = async (
  baseUrl: string,
  region: SupportedRegion,
  virtualLiveId: string
): Promise<VirtualLiveAggregateLookup> => {
  try {
    const [detailResponse, schedulesResponse, setlistsResponse, unitsAggregate] = await Promise.all([
      getVirtualLivesByRegionById({ baseUrl, path: { region, id: virtualLiveId } }),
      getVirtualLivesByRegionByIdSchedules({ baseUrl, path: { region, id: virtualLiveId } }),
      getVirtualLivesByRegionByIdSetlists({ baseUrl, path: { region, id: virtualLiveId } }),
      aggregateGameCharacterUnitsByRegion(baseUrl, region).catch(() => ({
        data: { items: [] },
        loadFailed: true
      }))
    ]);

    if (detailResponse.error) {
      return {
        region,
        virtualLive: null,
        availableRegions: [],
        exists: false,
        rawPayloadJson: null
      };
    }

    const baseDetail = parseVirtualLiveDetail(detailResponse.data);
    if (!baseDetail) {
      return {
        region,
        virtualLive: null,
        availableRegions: [],
        exists: false,
        rawPayloadJson: null
      };
    }

    const schedules = getObject(schedulesResponse.data);
    const setlists = getObject(setlistsResponse.data);

    const mergedDetail: VirtualLiveDetail = {
      ...baseDetail,
      schedules:
        baseDetail.schedules.length > 0
          ? baseDetail.schedules
          : parseVirtualLiveSchedules(schedules?.["items"]),
      setlists:
        baseDetail.setlists.length > 0
          ? baseDetail.setlists
          : parseVirtualLiveSetlistItems(setlists?.["items"])
    };

    const enrichmentMap = buildCharacterUnitEnrichmentMap(
      unitsAggregate.data,
      unitsAggregate.loadFailed
    );
    const enrichedDetail = enrichVirtualLiveCharacters(mergedDetail, enrichmentMap);

    const detailWithMusicTitle = await enrichScreenMvMusicTitle(
      enrichedDetail,
      baseUrl,
      region
    );

    return {
      region,
      virtualLive: detailWithMusicTitle,
      availableRegions: normalizeAvailableRegions(detailResponse.data),
      exists: true,
      rawPayloadJson: JSON.stringify(detailResponse.data, null, 2)
    };
  } catch {
    return {
      region,
      virtualLive: null,
      availableRegions: [],
      exists: false,
      rawPayloadJson: null
    };
  }
};

const fetchAvailableRegions = async ({
  baseUrl,
  virtualLiveId,
  region,
  aggregatePromise
}: {
  baseUrl: string;
  virtualLiveId: string;
  region: SupportedRegion;
  aggregatePromise: Promise<VirtualLiveAggregateLookup>;
}): Promise<SupportedRegion[]> => {
  const aggregate = await aggregatePromise;
  let detectedRegions = aggregate.availableRegions;

  if (!aggregate.exists && detectedRegions.length === 0) {
    try {
      const response = await getVirtualLivesRegionsByIdAvailability({
        baseUrl,
        path: { id: virtualLiveId }
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

const fetchVirtualLivePayload = async ({
  aggregatePromise,
  invalidVirtualLiveIdMessage
}: {
  aggregatePromise: Promise<VirtualLiveAggregateLookup>;
  invalidVirtualLiveIdMessage: string | null;
}): Promise<VirtualLivePayload> => {
  if (invalidVirtualLiveIdMessage) {
    return {
      virtualLive: null,
      debugVirtualLiveJson: null,
      error: invalidVirtualLiveIdMessage
    };
  }

  try {
    const aggregate = await aggregatePromise;

    return {
      virtualLive: aggregate.virtualLive,
      debugVirtualLiveJson: dev ? aggregate.rawPayloadJson : null,
      error: null
    };
  } catch {
    return {
      virtualLive: null,
      debugVirtualLiveJson: null,
      error: null
    };
  }
};

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const virtualLiveId = params.id?.trim() ?? "";
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [
    invalidVirtualLiveIdMessage,
    virtualLiveUnavailableInCurrentRegionMessage,
    failedToLoadVirtualLiveDataMessage
  ] = await Promise.all([
    getServerI18nText(uiLocale, "invalidVirtualLiveId", fetch),
    getServerI18nText(uiLocale, "virtualLiveUnavailableInCurrentRegion", fetch),
    getServerI18nText(uiLocale, "failedToLoadVirtualLiveData", fetch)
  ]);

  const region: SupportedRegion = normalizeRegion(params.region);
  const baseUrl = getMasterApiBaseUrl();
  const aggregatePromise = virtualLiveId
    ? fetchVirtualLiveAggregate(baseUrl, region, virtualLiveId)
    : Promise.resolve({
        region,
        virtualLive: null,
        availableRegions: [region],
        exists: false,
        rawPayloadJson: null
      } satisfies VirtualLiveAggregateLookup);

  return {
    virtualLiveId,
    region,
    regionLabel: regionLabels[region],
    virtualLiveUnavailableInCurrentRegionMessage,
    failedToLoadVirtualLiveDataMessage,
    availableRegions: virtualLiveId
      ? fetchAvailableRegions({
          baseUrl,
          virtualLiveId,
          region,
          aggregatePromise
        })
      : Promise.resolve([region] satisfies SupportedRegion[]),
    virtualLivePayload: fetchVirtualLivePayload({
      aggregatePromise,
      invalidVirtualLiveIdMessage: virtualLiveId ? null : invalidVirtualLiveIdMessage
    })
  };
};
