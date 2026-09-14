import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";
import { getGameNewsByRegionList } from "@platform/sekai-master-api-sdk";
import { getMasterApiBaseUrl } from "$lib/server/config";

export const GAME_NEWS_TAGS = [
  "information",
  "event",
  "gacha",
  "music",
  "campaign",
  "bug",
  "update"
] as const;
export type GameNewsTag = (typeof GAME_NEWS_TAGS)[number];

type GameNewsLegacyItem = {
  id: number;
  seq: number;
  displayOrder: number | null;
  bannerAssetbundleName: string | null;
  informationType: string;
  informationTag: GameNewsTag;
  browseType: string;
  platform: string;
  title: string;
  path: string;
  startAt: number;
  endAt: number | null;
};

export type GameNewsTargetRejection =
  "unsupported-browse-type" | "invalid-path" | "unsafe-scheme" | "cross-origin-internal-path";

export type GameNewsTarget =
  | { kind: "internal"; url: string }
  | { kind: "external"; url: string }
  | { kind: "none"; reason: GameNewsTargetRejection };

export type GameNewsTargetInput = Pick<GameNewsLegacyItem, "browseType" | "path"> & {
  region: SupportedRegion;
};

type GameNewsTargetFields = {
  target: GameNewsTarget;
  internalUrl: string | null;
  externalUrl: string | null;
  internalUrlKind: "iframe" | "none";
  externalUrlKind: "external" | "none";
};

export type GameNewsItem = GameNewsLegacyItem &
  GameNewsTargetFields & {
    region: SupportedRegion;
  };

export type GameNewsLoadResult =
  | { status: "ready"; items: GameNewsItem[] }
  | { status: "empty" }
  | { status: "error" }
  | { status: "unavailable" };

// These are the compatibility origins used by the legacy Game News iframe.
// They are target URLs only; the API source itself has no production default.
const LEGACY_INTERNAL_BASE_URLS: Readonly<Record<SupportedRegion, string>> = {
  jp: "https://production-web.sekai.colorfulpalette.org",
  tw: "https://production-web.sekai.colorfulpalette.org",
  en: "https://n-production-web.sekai-en.com",
  kr: "https://production-web.sekai.colorfulpalette.org",
  cn: "https://production-web.sekai.colorfulpalette.org"
};

const isHttpUrl = (value: URL): boolean =>
  value.protocol === "http:" || value.protocol === "https:";

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getRequiredText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const getSafeInteger = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

/**
 * Converts legacy second/millisecond timestamps and ISO date strings to epoch
 * milliseconds. Values outside the safe JavaScript date range are rejected.
 */
export const parseGameNewsTimestamp = (value: unknown): number | null => {
  let timestamp: number;

  if (typeof value === "number") {
    timestamp = value;
  } else if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (/^-?\d+$/.test(normalized)) {
      timestamp = Number(normalized);
    } else {
      const parsedDate = Date.parse(normalized);
      return Number.isFinite(parsedDate) && Number.isSafeInteger(parsedDate) ? parsedDate : null;
    }
  } else {
    return null;
  }

  if (!Number.isSafeInteger(timestamp)) {
    return null;
  }

  const timestampMs = Math.abs(timestamp) <= 1e12 ? timestamp * 1000 : timestamp;
  if (!Number.isSafeInteger(timestampMs) || !Number.isFinite(new Date(timestampMs).getTime())) {
    return null;
  }

  return timestampMs;
};

const resolveInternalTarget = (region: SupportedRegion, path: string): GameNewsTarget => {
  const baseUrl = new URL(`${LEGACY_INTERNAL_BASE_URLS[region]}/`);

  try {
    const targetUrl = new URL(path, baseUrl);
    if (!isHttpUrl(targetUrl)) {
      return { kind: "none", reason: "unsafe-scheme" };
    }

    if (targetUrl.origin !== baseUrl.origin) {
      return { kind: "none", reason: "cross-origin-internal-path" };
    }

    return { kind: "internal", url: targetUrl.toString() };
  } catch {
    return { kind: "none", reason: "invalid-path" };
  }
};

const resolveExternalTarget = (path: string): GameNewsTarget => {
  try {
    const targetUrl = new URL(path);
    return isHttpUrl(targetUrl) && targetUrl.hostname.length > 0
      ? { kind: "external", url: path }
      : { kind: "none", reason: "unsafe-scheme" };
  } catch {
    return { kind: "none", reason: "invalid-path" };
  }
};

export const resolveGameNewsTarget = (input: GameNewsTargetInput): GameNewsTarget => {
  const path = input.path.trim();
  if (path.length === 0) {
    return { kind: "none", reason: "invalid-path" };
  }

  const browseType = input.browseType.trim().toLowerCase();
  if (browseType === "internal") {
    return resolveInternalTarget(input.region, path);
  }

  if (browseType === "external") {
    return resolveExternalTarget(path);
  }

  return { kind: "none", reason: "unsupported-browse-type" };
};

const getTargetFields = (target: GameNewsTarget): GameNewsTargetFields => {
  if (target.kind === "internal") {
    return {
      target,
      internalUrl: target.url,
      externalUrl: null,
      internalUrlKind: "iframe",
      externalUrlKind: "none"
    };
  }

  if (target.kind === "external") {
    return {
      target,
      internalUrl: null,
      externalUrl: target.url,
      internalUrlKind: "none",
      externalUrlKind: "external"
    };
  }

  return {
    target,
    internalUrl: null,
    externalUrl: null,
    internalUrlKind: "none",
    externalUrlKind: "none"
  };
};

const parseOptionalTimestamp = (
  source: Record<string, unknown>,
  key: string
): { valid: boolean; value: number | null } => {
  if (!(key in source)) {
    return { valid: true, value: null };
  }

  if (source[key] === null || source[key] === undefined) {
    return { valid: true, value: null };
  }

  const value = parseGameNewsTimestamp(source[key]);
  return { valid: value !== null, value };
};

export const normalizeGameNewsItem = (
  payload: unknown,
  region: SupportedRegion
): GameNewsItem | null => {
  const source = getObject(payload);
  if (!source) {
    return null;
  }

  const id = getSafeInteger(source.id);
  const seq = getSafeInteger(source.seq);
  const displayOrder = getSafeInteger(source.displayOrder);
  const bannerAssetbundleName = getRequiredText(source.bannerAssetbundleName);
  const informationType = getRequiredText(source.informationType);
  const rawTag = getRequiredText(source.informationTag)?.toLowerCase();
  const informationTag = GAME_NEWS_TAGS.includes(rawTag as GameNewsTag)
    ? (rawTag as GameNewsTag)
    : null;
  const browseType = getRequiredText(source.browseType);
  const platform = getRequiredText(source.platform);
  const title = getRequiredText(source.title);
  const path = getRequiredText(source.path);
  const startAt = parseGameNewsTimestamp(source.startAt);
  const endAt = parseOptionalTimestamp(source, "endAt");

  if (
    id === null ||
    seq === null ||
    informationType === null ||
    informationTag === null ||
    browseType === null ||
    platform === null ||
    title === null ||
    path === null ||
    startAt === null ||
    !endAt.valid
  ) {
    return null;
  }

  const target = resolveGameNewsTarget({ region, browseType, path });

  return {
    id,
    seq,
    displayOrder,
    bannerAssetbundleName,
    informationType,
    informationTag,
    browseType,
    platform,
    title,
    path,
    startAt,
    endAt: endAt.value,
    region,
    ...getTargetFields(target)
  };
};

const getPayloadItems = (payload: unknown): unknown[] | null => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = getObject(payload);
  return root && Array.isArray(root.items) ? root.items : null;
};

export const parseGameNewsPayload = (
  payload: unknown,
  region: SupportedRegion
): GameNewsItem[] | null => {
  const sourceItems = getPayloadItems(payload);
  if (sourceItems === null) {
    return null;
  }

  const items: GameNewsItem[] = [];
  for (const sourceItem of sourceItems) {
    const item = normalizeGameNewsItem(sourceItem, region);
    if (item === null) {
      return null;
    }

    items.push(item);
  }

  return items;
};

const GAME_NEWS_CACHE_DURATION_MS = 60_000;

type CachedGameNews = {
  expiresAt: number;
  result: GameNewsLoadResult;
};

const gameNewsCache = new Map<string, CachedGameNews>();
const gameNewsInFlight = new Map<string, Promise<GameNewsLoadResult>>();

const getGameNewsCacheKey = (baseUrl: string, region: SupportedRegion): string =>
  `${baseUrl}|${region}`;

const resolveMasterApiBaseUrl = (): string | null => {
  try {
    return getMasterApiBaseUrl();
  } catch {
    return null;
  }
};

export const clearGameNewsCache = (): void => {
  gameNewsCache.clear();
  gameNewsInFlight.clear();
};

const fetchGameNews = async (
  baseUrl: string,
  region: SupportedRegion
): Promise<GameNewsLoadResult> => {
  try {
    const response = await getGameNewsByRegionList({
      baseUrl,
      path: { region },
      query: { includeAll: true }
    });
    if (response.error) {
      return { status: "error" };
    }

    const items = parseGameNewsPayload(response.data, region);
    if (items === null) {
      return { status: "error" };
    }

    return items.length > 0 ? { status: "ready", items } : { status: "empty" };
  } catch {
    return { status: "error" };
  }
};

export const loadGameNews = async (
  region: SupportedRegion
): Promise<GameNewsLoadResult> => {
  if (!supportedRegions.includes(region)) {
    return { status: "unavailable" };
  }

  const baseUrl = resolveMasterApiBaseUrl();
  if (baseUrl === null) {
    return { status: "unavailable" };
  }

  const cacheKey = getGameNewsCacheKey(baseUrl, region);
  const now = Date.now();
  const cached = gameNewsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }
  if (cached) {
    gameNewsCache.delete(cacheKey);
  }

  const inFlight = gameNewsInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchGameNews(baseUrl, region)
    .then((result) => {
      if (gameNewsInFlight.get(cacheKey) === request) {
        if (result.status === "error") {
          gameNewsCache.delete(cacheKey);
        } else {
          gameNewsCache.set(cacheKey, {
            expiresAt: Date.now() + GAME_NEWS_CACHE_DURATION_MS,
            result
          });
        }
      }

      return result;
    })
    .finally(() => {
      if (gameNewsInFlight.get(cacheKey) === request) {
        gameNewsInFlight.delete(cacheKey);
      }
    });
  gameNewsInFlight.set(cacheKey, request);
  return request;
};
