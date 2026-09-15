import {
  getCardsByRegionList,
  getEventsByRegionCurrent,
  getGachasByRegionList,
  getMusicsByRegionList
} from "@platform/sekai-master-api-sdk";
import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import {
  fetchUnitProfiles,
  toUnitProfileMap,
  type UnitProfileMap
} from "$lib/server/unit-profiles";
import { loadGameNews, type GameNewsLoadResult } from "$lib/server/game-news";
import {
  LATEST_GACHA_LIMIT,
  isOngoingGacha,
  selectLatestGachas,
  type LatestGachaItem
} from "$lib/server/home-latest-data";

export type EventSummary = {
  id: string;
  title: string;
  eventType: string | null;
  unit: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  assetBundleName: string | null;
};

export type RegionVersions = {
  appVersion: string | null;
  dataVersion: string | null;
  assetVersion: string | null;
  cdnVersion: string | null;
};

export type RegionEventCard = {
  region: SupportedRegion;
  label: string;
  event: EventSummary | null;
  unitProfiles: UnitProfileMap;
  error: string | null;
};

export type VersionsByRegion = Partial<Record<SupportedRegion, RegionVersions | null>>;

export type LatestCardItem = {
  id: string;
  prefix: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  initialSpecialTrainingStatus: string | null;
  rarityCount: number;
  releaseAt: string | number | null;
};

export type LatestMusicItem = {
  id: string;
  title: string | null;
  assetBundleName: string | null;
  composer: string | null;
  publishedAt: string | number | null;
};

export type RegionLatestData = {
  region: SupportedRegion;
  cards: LatestCardItem[];
  musics: LatestMusicItem[];
  gachas: LatestGachaItem[];
};

export type HomeRegionData = {
  region: SupportedRegion;
  card: RegionEventCard;
  latestData: RegionLatestData;
  news: GameNewsLoadResult;
};

export type LoadHomeRegionDataOptions = {
  baseUrl: string;
  region: SupportedRegion;
  unavailableErrorText: string;
  requestFailedErrorText: string;
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

export const parseRegionVersions = (payload: unknown): RegionVersions | null => {
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

export const parseVersionsByRegion = (payload: unknown): VersionsByRegion => {
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

export const fetchLatestGachas = async (
  baseUrl: string,
  region: SupportedRegion
): Promise<LatestGachaItem[]> => {
  const now = Date.now();
  const fetchGachaItems = async (
    ongoing: boolean,
    pageSize: number
  ): Promise<LatestGachaItem[]> => {
    const response = await getGachasByRegionList({
      baseUrl,
      path: { region },
      query: {
        page: 1,
        page_size: pageSize,
        spoiler: false,
        ...(ongoing ? { ongoing: true } : {}),
        sort_by: "startAt",
        sort_order: "desc"
      }
    });

    if (response.error) {
      return [];
    }

    const root = getObject(response.data);
    const rawItems = root && Array.isArray(root.items) ? root.items : [];
    return rawItems
      .map(parseLatestGacha)
      .filter((gacha): gacha is LatestGachaItem => gacha !== null);
  };

  const ongoingItems = (await fetchGachaItems(true, LATEST_GACHA_LIMIT)).filter((gacha) =>
    isOngoingGacha(gacha, now)
  );
  const ongoingGachas = selectLatestGachas(ongoingItems, now);
  const remaining = LATEST_GACHA_LIMIT - ongoingGachas.length;
  if (remaining <= 0) {
    return ongoingGachas;
  }

  const latestItems = await fetchGachaItems(false, remaining);
  return selectLatestGachas([...ongoingGachas, ...latestItems], now);
};

export const fetchRegionLatestData = async (
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

  const cardsRoot = getObject(cardsRes.data);
  const cardItems = Array.isArray(cardsRoot?.items)
    ? cardsRoot.items.map(parseLatestCard).filter((card): card is LatestCardItem => card !== null)
    : [];

  const musicsRoot = getObject(musicsRes.data);
  const musicItems = Array.isArray(musicsRoot?.items)
    ? musicsRoot.items
        .map(parseLatestMusic)
        .filter((music): music is LatestMusicItem => music !== null)
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
  unavailableErrorText: string
): Promise<RegionEventCard> => {
  const [eventResponse, unitProfiles] = await Promise.all([
    getEventsByRegionCurrent({
      baseUrl,
      path: { region }
    }),
    fetchUnitProfiles(baseUrl, region).then(toUnitProfileMap)
  ]);

  if (eventResponse.error) {
    return {
      region,
      label: regionLabels[region],
      event: null,
      unitProfiles,
      error: unavailableErrorText
    };
  }

  return {
    region,
    label: regionLabels[region],
    event: parseEventSummary(eventResponse.data),
    unitProfiles,
    error: null
  };
};

const createEmptyRegionLatestData = (region: SupportedRegion): RegionLatestData => ({
  region,
  cards: [],
  musics: [],
  gachas: []
});

const createFailedRegionEventCard = (
  region: SupportedRegion,
  requestFailedErrorText: string
): RegionEventCard => ({
  region,
  label: regionLabels[region],
  event: null,
  unitProfiles: {},
  error: requestFailedErrorText
});

export const loadHomeRegionEventCard = async ({
  baseUrl,
  region,
  unavailableErrorText,
  requestFailedErrorText
}: LoadHomeRegionDataOptions): Promise<RegionEventCard> =>
  toRegionEventCard(baseUrl, region, unavailableErrorText).catch(() =>
    createFailedRegionEventCard(region, requestFailedErrorText)
  );

export const loadHomeLatestData = async (
  baseUrl: string,
  region: SupportedRegion
): Promise<RegionLatestData> =>
  fetchRegionLatestData(baseUrl, region).catch(() => createEmptyRegionLatestData(region));

export const loadHomeNews = async (region: SupportedRegion): Promise<GameNewsLoadResult> =>
  loadGameNews(region).catch((): GameNewsLoadResult => ({ status: "error" }));

export const loadHomeRegionData = async ({
  baseUrl,
  region,
  unavailableErrorText,
  requestFailedErrorText
}: LoadHomeRegionDataOptions): Promise<HomeRegionData> => {
  const [card, latestData, news] = await Promise.all([
    loadHomeRegionEventCard({
      baseUrl,
      region,
      unavailableErrorText,
      requestFailedErrorText
    }),
    loadHomeLatestData(baseUrl, region),
    loadHomeNews(region)
  ]);

  return { region, card, latestData, news };
};
