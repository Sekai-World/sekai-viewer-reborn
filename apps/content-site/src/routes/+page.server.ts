import {
  getCardsByRegionList,
  getEventsByRegionCurrent,
  getGachasByRegionList,
  getMusicsByRegionList,
  getVersions
} from "@platform/sekai-master-api-sdk";
import { getServerI18nText } from "$lib/i18n/runtime";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { normalizeUiLocale, UI_LOCALE_COOKIE_NAME } from "$lib/i18n/region";
import {
  fetchUnitProfiles,
  toUnitProfileMap,
  type UnitProfileMap
} from "$lib/server/unit-profiles";
import {
  LATEST_GACHA_CANDIDATE_LIMIT,
  LATEST_GACHA_LIMIT,
  selectLatestGachas,
  type LatestGachaItem
} from "$lib/server/home-latest-data";
import type { PageServerLoad } from "./$types";

type EventSummary = {
  id: string;
  title: string;
  eventType: string | null;
  unit: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  assetBundleName: string | null;
};

type RegionVersions = {
  appVersion: string | null;
  dataVersion: string | null;
  assetVersion: string | null;
  cdnVersion: string | null;
};

type RegionEventCard = {
  region: SupportedRegion;
  label: string;
  event: EventSummary | null;
  versions: RegionVersions | null;
  unitProfiles: UnitProfileMap;
  error: string | null;
};

type VersionsByRegion = Partial<Record<SupportedRegion, RegionVersions | null>>;

type LatestCardItem = {
  id: string;
  prefix: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  initialSpecialTrainingStatus: string | null;
  rarityCount: number;
  releaseAt: string | number | null;
};

type LatestMusicItem = {
  id: string;
  title: string | null;
  assetBundleName: string | null;
  composer: string | null;
  publishedAt: string | number | null;
};

type RegionLatestData = {
  region: SupportedRegion;
  cards: LatestCardItem[];
  musics: LatestMusicItem[];
  gachas: LatestGachaItem[];
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

const parseRegionVersions = (payload: unknown): RegionVersions | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    appVersion: pickFirstString(root, ["appVersion", "app_version"]),
    dataVersion: pickFirstString(root, ["dataVersion", "data_version"]),
    assetVersion: pickFirstString(root, ["assetVersion", "asset_version"]),
    cdnVersion: pickFirstStringLike(root, ["cdnVersion", "cdn_version"])
  };
};

const parseVersionsByRegion = (payload: unknown): VersionsByRegion => {
  const root = getObject(payload);
  if (!root) {
    return {};
  }

  return supportedRegions.reduce<VersionsByRegion>((accumulator, region) => {
    accumulator[region] = parseRegionVersions(root[region]);
    return accumulator;
  }, {});
};

const parseEventSummary = (payload: unknown): EventSummary | null => {
  const root = getObject(payload);

  if (!root) {
    return null;
  }

  const eventNode = getNestedObject(root, ["event", "currentEvent", "data"]) ?? root;
  const unitNode = getNestedObject(eventNode, ["unit"]);
  const id = pickFirstStringLike(eventNode, ["id", "eventId"]);
  const title = pickFirstString(eventNode, ["name", "title", "eventName"]);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    eventType: pickFirstString(eventNode, ["eventType", "event_type"]),
    unit: pickFirstString(unitNode ?? eventNode, ["unit"]),
    startAt: pickFirstDateValue(eventNode, ["startAt", "start_at", "startDate"]),
    endAt: pickFirstDateValue(eventNode, [
      "aggregateAt",
      "aggregate_at",
      "endAt",
      "end_at",
      "endDate"
    ]),
    assetBundleName: pickFirstString(eventNode, ["assetbundleName", "assetBundleName"])
  };
};

const RARITY_COUNT_BY_TYPE: Record<string, number> = {
  rarity_1: 1,
  rarity_2: 2,
  rarity_3: 3,
  rarity_4: 4,
  rarity_birthday: 1
};

const parseLatestCard = (raw: unknown): LatestCardItem | null => {
  const root = getObject(raw);
  if (!root) {
    return null;
  }

  const id = pickFirstStringLike(root, ["id"]);
  if (!id) {
    return null;
  }

  const rarityNode = getNestedObject(root, ["cardRarity"]);
  const rarityType = rarityNode ? pickFirstString(rarityNode, ["cardRarityType"]) : null;
  const rarityCount = rarityType ? (RARITY_COUNT_BY_TYPE[rarityType] ?? 0) : 0;

  return {
    id,
    prefix: pickFirstString(root, ["prefix"]),
    assetBundleName: pickFirstString(root, ["assetbundleName", "assetBundleName"]),
    attr: pickFirstString(root, ["attr"]),
    rarityType,
    initialSpecialTrainingStatus: pickFirstString(root, [
      "initialSpecialTrainingStatus",
      "initial_special_training_status"
    ]),
    rarityCount,
    releaseAt: pickFirstDateValue(root, ["releaseAt", "archivePublishedAt"])
  };
};

const parseLatestMusic = (raw: unknown): LatestMusicItem | null => {
  const root = getObject(raw);
  if (!root) {
    return null;
  }

  const id = pickFirstStringLike(root, ["id"]);
  if (!id) {
    return null;
  }

  return {
    id,
    title: pickFirstString(root, ["title"]),
    assetBundleName: pickFirstString(root, ["assetbundleName", "assetBundleName"]),
    composer: pickFirstString(root, ["composer"]),
    publishedAt: pickFirstDateValue(root, ["publishedAt"])
  };
};

const parseLatestGacha = (raw: unknown): LatestGachaItem | null => {
  const root = getObject(raw);
  if (!root) {
    return null;
  }

  const id = pickFirstStringLike(root, ["id"]);
  if (!id) {
    return null;
  }

  return {
    id,
    name: pickFirstString(root, ["name"]),
    assetBundleName: pickFirstString(root, ["assetbundleName", "assetBundleName"]),
    startAt: pickFirstDateValue(root, ["startAt"]),
    endAt: pickFirstDateValue(root, ["endAt"])
  };
};

// Only pages without trustworthy pagination metadata use this defensive bound.
// Declared has_next/total_pages/total sequences bypass this fallback limit; the
// separate emergency ceiling below still applies to every pagination mode.
const LATEST_GACHA_FALLBACK_PAGE_LIMIT = 10;

// This independent ceiling protects the homepage from a non-terminating upstream,
// including responses that claim authoritative pagination without a page number.
const LATEST_GACHA_EMERGENCY_REQUEST_CEILING = 100;

const getPaginationInteger = (
  pagination: Record<string, unknown> | null,
  keys: readonly string[],
  minimum: number
): number | null => {
  for (const key of keys) {
    const value = pagination?.[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= minimum) {
      return value;
    }
  }

  return null;
};

type GachaPageContinuation = {
  hasNext: boolean;
  authoritative: boolean;
  reportedPage: number | null;
  pageProvided: boolean;
};

const getGachaPageContinuation = (
  payload: unknown,
  requestedPage: number,
  requestedPageSize: number,
  rawItemCount: number
): GachaPageContinuation => {
  const root = getObject(payload);
  const pagination = getObject(root?.pagination);
  const reportedPage = getPaginationInteger(pagination, ["page"], 1);
  const pageProvided =
    pagination !== null && Object.prototype.hasOwnProperty.call(pagination, "page");
  const hasNext = pagination?.has_next;

  if (typeof hasNext === "boolean") {
    return { hasNext, authoritative: true, reportedPage, pageProvided };
  }

  const page = reportedPage ?? requestedPage;
  const pageSize =
    getPaginationInteger(pagination, ["page_size", "pageSize"], 1) ?? requestedPageSize;
  const totalPages = getPaginationInteger(pagination, ["total_pages", "totalPages"], 1);

  if (totalPages !== null) {
    return { hasNext: page < totalPages, authoritative: true, reportedPage, pageProvided };
  }

  const total = getPaginationInteger(pagination, ["total"], 0);
  if (total !== null) {
    return { hasNext: page * pageSize < total, authoritative: true, reportedPage, pageProvided };
  }

  return {
    hasNext: rawItemCount >= pageSize,
    authoritative: false,
    reportedPage,
    pageProvided
  };
};

const toTimestamp = (value: string | number | null): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isOngoingGacha = (gacha: LatestGachaItem, now: number): boolean => {
  const startAt = toTimestamp(gacha.startAt);
  const endAt = toTimestamp(gacha.endAt);
  return startAt !== null && endAt !== null && startAt <= now && now <= endAt;
};

const fetchLatestGachas = async (
  baseUrl: string,
  region: SupportedRegion
): Promise<LatestGachaItem[]> => {
  const items: LatestGachaItem[] = [];
  const now = Date.now();
  const reportedPages = new Set<number>();
  const pageSignatures = new Set<string>();
  let fallbackPagesFetched = 0;

  for (
    let page = 1, requestsMade = 0;
    requestsMade < LATEST_GACHA_EMERGENCY_REQUEST_CEILING;
    page += 1, requestsMade += 1
  ) {
    const response = await getGachasByRegionList({
      baseUrl,
      path: { region },
      query: {
        page,
        page_size: LATEST_GACHA_CANDIDATE_LIMIT,
        spoiler: false,
        sort_by: "startAt",
        sort_order: "desc"
      }
    });

    if (response.error) {
      break;
    }

    const root = getObject(response.data);
    const rawItems = root && Array.isArray(root.items) ? root.items : [];
    const pageSignature = JSON.stringify(rawItems);
    if (pageSignature !== undefined && pageSignatures.has(pageSignature)) {
      break;
    }
    if (pageSignature !== undefined) {
      pageSignatures.add(pageSignature);
    }

    items.push(
      ...rawItems
        .map(parseLatestGacha)
        .filter((gacha): gacha is LatestGachaItem => gacha !== null)
    );

    const latestGachas = selectLatestGachas(items, now);
    const ongoingGachaCount = items.filter((gacha) => isOngoingGacha(gacha, now)).length;
    if (latestGachas.length >= LATEST_GACHA_LIMIT && ongoingGachaCount >= LATEST_GACHA_LIMIT) {
      return latestGachas;
    }

    const continuation = getGachaPageContinuation(
      response.data,
      page,
      LATEST_GACHA_CANDIDATE_LIMIT,
      rawItems.length
    );
    if (
      continuation.pageProvided &&
      (continuation.reportedPage === null || continuation.reportedPage !== page)
    ) {
      break;
    }
    if (
      continuation.reportedPage !== null &&
      reportedPages.has(continuation.reportedPage)
    ) {
      break;
    }
    if (continuation.reportedPage !== null) {
      reportedPages.add(continuation.reportedPage);
    }

    if (!continuation.hasNext) {
      break;
    }

    if (!continuation.authoritative) {
      fallbackPagesFetched += 1;
      if (fallbackPagesFetched >= LATEST_GACHA_FALLBACK_PAGE_LIMIT) {
        break;
      }
    }
  }

  return selectLatestGachas(items, now);
};

const fetchRegionLatestData = async (
  baseUrl: string,
  region: SupportedRegion
): Promise<RegionLatestData> => {
  const [cardsRes, musicsRes, gachas] = await Promise.all([
    getCardsByRegionList({
      baseUrl,
      path: { region },
      query: { page: 1, page_size: 9, spoiler: false, sort_by: "releaseAt", sort_order: "desc" }
    }),
    getMusicsByRegionList({
      baseUrl,
      path: { region },
      query: { page: 1, page_size: 3, spoiler: false, sort_by: "publishedAt", sort_order: "desc" }
    }),
    fetchLatestGachas(baseUrl, region)
  ]);

  const cardItems = Array.isArray((cardsRes.data as Record<string, unknown>)?.items)
    ? ((cardsRes.data as Record<string, unknown>).items as unknown[])
        .map(parseLatestCard)
        .filter((c): c is LatestCardItem => c !== null)
    : [];

  const musicItems = Array.isArray((musicsRes.data as Record<string, unknown>)?.items)
    ? ((musicsRes.data as Record<string, unknown>).items as unknown[])
        .map(parseLatestMusic)
        .filter((m): m is LatestMusicItem => m !== null)
    : [];

  return {
    region,
    cards: cardItems,
    musics: musicItems,
    gachas
  };
};

const toRegionEventCard = async (
  baseUrl: string,
  region: SupportedRegion,
  unavailableErrorText: string,
  versionsByRegion: VersionsByRegion
): Promise<RegionEventCard> => {
  const [eventResponse, unitProfiles] = await Promise.all([
    getEventsByRegionCurrent({
      baseUrl,
      path: { region }
    }),
    fetchUnitProfiles(baseUrl, region).then(toUnitProfileMap)
  ]);
  const versions = versionsByRegion[region] ?? null;

  if (eventResponse.error) {
    return {
      region,
      label: regionLabels[region],
      event: null,
      versions,
      unitProfiles,
      error: unavailableErrorText
    };
  }

  return {
    region,
    label: regionLabels[region],
    event: parseEventSummary(eventResponse.data),
    versions,
    unitProfiles,
    error: null
  };
};

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const uiLocale = normalizeUiLocale(cookies.get(UI_LOCALE_COOKIE_NAME));
  const [homeEventDataUnavailable, homeEventDataRequestFailed] = await Promise.all([
    getServerI18nText(uiLocale, "homeEventDataUnavailable", fetch),
    getServerI18nText(uiLocale, "homeEventDataRequestFailed", fetch)
  ]);
  const baseUrl = getMasterApiBaseUrl();
  const versionsByRegion = await (async (): Promise<VersionsByRegion> => {
    try {
      const response = await getVersions({ baseUrl });
      if (response.error) {
        return {};
      }

      return parseVersionsByRegion(response.data);
    } catch {
      return {};
    }
  })();

  const cards = supportedRegions.map(async (region) => {
    try {
      return await toRegionEventCard(baseUrl, region, homeEventDataUnavailable, versionsByRegion);
    } catch {
      return {
        region,
        label: regionLabels[region],
        event: null,
        versions: null,
        unitProfiles: {},
        error: homeEventDataRequestFailed
      } satisfies RegionEventCard;
    }
  });

  const latestData = supportedRegions.map(async (region) => {
    try {
      return await fetchRegionLatestData(baseUrl, region);
    } catch {
      return {
        region,
        cards: [],
        musics: [],
        gachas: []
      } satisfies RegionLatestData;
    }
  });

  return {
    cards,
    currentEventLoadFailedMessage: homeEventDataRequestFailed,
    latestData
  };
};
