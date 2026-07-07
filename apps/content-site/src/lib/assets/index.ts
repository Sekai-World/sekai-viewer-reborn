import { PUBLIC_REMOTE_ASSET_BASE_URL } from "$env/static/public";
import type { SupportedRegion } from "$lib/domain/regions";

const trimTrailingSlash = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const normalized = trimmed.replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : "/";
};

export const getRemoteAssetBaseURL = (baseUrlOverride?: string | null): string => {
  const configuredBaseUrl = trimTrailingSlash(baseUrlOverride ?? PUBLIC_REMOTE_ASSET_BASE_URL);
  if (!configuredBaseUrl) {
    throw new Error("Missing required environment variable: PUBLIC_REMOTE_ASSET_BASE_URL");
  }

  return configuredBaseUrl;
};

export type AssetServer = SupportedRegion | "comic" | "musicChart" | "live2d" | "best";

type AssetTestGlobal = {
  AssetTest?: {
    assetList?: string[];
  };
};

const assetBucketByServer: Record<AssetServer, string> = {
  jp: "sekai-jp-assets",
  en: "sekai-en-assets",
  tw: "sekai-tc-assets",
  kr: "sekai-kr-assets",
  cn: "sekai-cn-assets",
  comic: "sekai-comics",
  musicChart: "sekai-music-charts",
  live2d: "sekai-live2d-assets",
  best: "sekai-best-assets"
};

const buildServerAssetURL = (
  endpoint: string,
  server: AssetServer,
  baseUrlOverride?: string | null
): string => {
  const baseURL = getRemoteAssetBaseURL(baseUrlOverride).replace(/\/+$/, "");
  const bucket = assetBucketByServer[server];
  const normalizedEndpoint = endpoint.trim().replace(/^\/+/, "");
  return `${baseURL}/${bucket}/${normalizedEndpoint}`;
};

export const getRemoteAssetEndpointURL = (
  endpoint: string,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  if (!endpoint) {
    return "";
  }

  if (/^https?:\/\//i.test(endpoint.trim())) {
    return endpoint.trim();
  }

  return buildServerAssetURL(endpoint, server, baseUrlOverride);
};

export const getRemoteAssetURL = async (
  endpoint: string,
  server: AssetServer = "jp",
  verifyStatus = false
): Promise<string> => {
  if (!endpoint) {
    return "";
  }

  const url = getRemoteAssetEndpointURL(endpoint, server);

  if (!verifyStatus) {
    return url;
  }

  const assetTest = (globalThis as AssetTestGlobal).AssetTest;
  if (assetTest?.assetList) {
    return assetTest.assetList.includes(endpoint) ? url : "";
  }

  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.status <= 400) {
      return url;
    }

    return "";
  } catch {
    return "";
  }
};

export const getEventBannerAssetURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `home/banner/${normalizedAssetBundleName}/${normalizedAssetBundleName}.webp`,
    server,
    baseUrlOverride
  );
};

export const getVirtualLiveBannerAssetURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `virtual_live/select/banner/${normalizedAssetBundleName}/${normalizedAssetBundleName}.webp`,
    server,
    baseUrlOverride
  );
};

export const getEventLogoAssetURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  extension = "webp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `event/${normalizedAssetBundleName}/logo/logo.${extension}`,
    server,
    baseUrlOverride
  );
};

export const getEventBackgroundAssetURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `event/${normalizedAssetBundleName}/screen/bg.webp`,
    server,
    baseUrlOverride
  );
};

export const getEventCharacterAssetURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `event/${normalizedAssetBundleName}/screen/character.webp`,
    server,
    baseUrlOverride
  );
};

export const getEventBgmAssetURL = (
  bgmAssetbundleName: string,
  server: AssetServer = "jp",
  extension = "mp3",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = bgmAssetbundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(`${normalizedAssetBundleName}.${extension}`, server, baseUrlOverride);
};

export const getEventPointIconAssetURL = (
  eventPointIcon: string,
  server: AssetServer = "jp",
  suffix = "_1.webp",
  baseUrlOverride?: string | null
): string => {
  const normalizedEventPointIcon = eventPointIcon.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedEventPointIcon.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(`${normalizedEventPointIcon}${suffix}`, server, baseUrlOverride);
};

export const getCharacterThumbnailAssetURL = (
  characterId: number,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const paddedId = String(characterId).padStart(5, "0");
  return buildServerAssetURL(
    `thumbnail/chara_rip/chr_ts_${paddedId}_01.webp`,
    server,
    baseUrlOverride
  );
};

export const getCardSmallAssetURL = (
  assetBundleName: string,
  trained = false,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `character/member_small/${normalizedAssetBundleName}/card_${trained ? "after_training" : "normal"}.webp`,
    server,
    baseUrlOverride
  );
};

export const getCardThumbnailAssetURL = (
  assetBundleName: string,
  trained = false,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `thumbnail/chara/${normalizedAssetBundleName}_${trained ? "after_training" : "normal"}.webp`,
    server,
    baseUrlOverride
  );
};

export const getCardFullAssetURL = (
  assetBundleName: string,
  trained = false,
  server: AssetServer = "jp",
  extension = "webp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `character/member/${normalizedAssetBundleName}/card_${trained ? "after_training" : "normal"}.${extension}`,
    server,
    baseUrlOverride
  );
};

export const getCardCutoutAssetURL = (
  assetBundleName: string,
  trained = false,
  server: AssetServer = "jp",
  extension = "webp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `character/member_cutout/${normalizedAssetBundleName}/${trained ? "after_training" : "normal"}.${extension}`,
    server,
    baseUrlOverride
  );
};

export const getCardGachaVoiceAssetURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `sound/gacha/get_voice/${normalizedAssetBundleName}/${normalizedAssetBundleName}.mp3`,
    server,
    baseUrlOverride
  );
};

export const getGachaLogoAssetURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  extension = "webp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `gacha/${normalizedAssetBundleName}/logo/logo.${extension}`,
    server,
    baseUrlOverride
  );
};

export const getGachaBannerAssetURL = (
  gachaId: string,
  server: AssetServer = "jp",
  extension = "webp",
  baseUrlOverride?: string | null
): string => {
  const normalizedGachaId = gachaId.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedGachaId.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  const assetBundleName = `banner_gacha${normalizedGachaId}`;
  return buildServerAssetURL(
    `home/banner/${assetBundleName}/${assetBundleName}.${extension}`,
    server,
    baseUrlOverride
  );
};

export const getCommonMaterialThumbnailURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  extension = "webp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `thumbnail/common_material/${normalizedAssetBundleName}.${extension}`,
    server,
    baseUrlOverride
  );
};

/**
 * Determine which asset server to use for music audio/jacket assets.
 *
 * Rule: if the music exists on the JP server (availableRegions includes "jp"),
 * use JP assets — they are shared across all servers. If the music is
 * server-exclusive (not available on JP), fall back to the current region's
 * own asset bucket.
 */
export const getMusicAssetServer = (
  region: SupportedRegion,
  availableRegions: SupportedRegion[]
): AssetServer => {
  if (availableRegions.includes("jp")) {
    return "jp";
  }

  return region;
};

export const getMusicJacketAssetURL = (
  assetBundleName: string,
  server: AssetServer = "jp",
  baseUrlOverride?: string | null
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `music/jacket/${normalizedAssetBundleName}/${normalizedAssetBundleName}.webp`,
    server,
    baseUrlOverride
  );
};

export const getMusicLongPreviewAssetURL = (
  vocalAssetBundleName: string,
  server: AssetServer = "jp",
  extension = "mp3",
  baseUrlOverride?: string | null
): string => {
  const normalized = vocalAssetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalized.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `music/long/${normalized}/${normalized}.${extension}`,
    server,
    baseUrlOverride
  );
};

export const getMusicShortPreviewAssetURL = (
  vocalAssetBundleName: string,
  server: AssetServer = "jp",
  extension = "mp3",
  baseUrlOverride?: string | null
): string => {
  const normalized = vocalAssetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalized.length === 0) {
    return getRemoteAssetBaseURL(baseUrlOverride);
  }

  return buildServerAssetURL(
    `music/short/${normalized}/${normalized}_short.${extension}`,
    server,
    baseUrlOverride
  );
};

export const getMusicChartPreviewAssetURL = (
  region: SupportedRegion,
  musicId: number | string,
  difficulty: string
): string => {
  const normalizedRegion = region.trim().toLowerCase();
  const normalizedMusicId = String(musicId).trim().padStart(4, "0");
  const normalizedDifficulty = difficulty.trim().toLowerCase();

  return buildServerAssetURL(
    `${normalizedRegion}/${normalizedMusicId}/${normalizedDifficulty}.png`,
    "musicChart"
  );
};
