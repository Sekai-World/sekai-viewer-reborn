import { PUBLIC_REMOTE_ASSET_BASE_URL } from "$env/static/public";
import type { SupportedRegion } from "@platform/i18n-dicts";

const DEFAULT_STORAGE_PROXY_PATH = "/storage";
const DEFAULT_REMOTE_ASSET_BASE_URL = "https://storage.sekai.best";

const trimTrailingSlash = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const normalized = trimmed.replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : "/";
};

export const getRemoteAssetBaseURL = (): string => {
  const configuredBaseUrl = trimTrailingSlash(PUBLIC_REMOTE_ASSET_BASE_URL);
  if (configuredBaseUrl.length > 0) {
    return configuredBaseUrl;
  }

  return import.meta.env.DEV ? DEFAULT_STORAGE_PROXY_PATH : DEFAULT_REMOTE_ASSET_BASE_URL;
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

const buildServerAssetURL = (endpoint: string, server: AssetServer): string => {
  const baseURL = getRemoteAssetBaseURL().replace(/\/+$/, "");
  const bucket = assetBucketByServer[server];
  const normalizedEndpoint = endpoint.trim().replace(/^\/+/, "");
  return `${baseURL}/${bucket}/${normalizedEndpoint}`;
};

export const getRemoteAssetURL = async (
  endpoint: string,
  server: AssetServer = "jp",
  verifyStatus = false
): Promise<string> => {
  if (!endpoint) {
    return "";
  }

  if (/^https?:\/\//i.test(endpoint.trim())) {
    return endpoint.trim();
  }

  const url = buildServerAssetURL(endpoint, server);

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
  server: AssetServer = "jp"
): string => {
  const normalizedAssetBundleName = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  if (normalizedAssetBundleName.length === 0) {
    return getRemoteAssetBaseURL();
  }

  return buildServerAssetURL(
    `home/banner/${normalizedAssetBundleName}/${normalizedAssetBundleName}.webp`,
    server
  );
};
