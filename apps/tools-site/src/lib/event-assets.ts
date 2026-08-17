import { env } from "$env/dynamic/public";
import type { TrackerSupportedRegion } from "$lib/regions";

const assetBucketByRegion: Record<TrackerSupportedRegion, string> = {
  jp: "sekai-jp-assets",
  en: "sekai-en-assets",
  tw: "sekai-tc-assets",
  kr: "sekai-kr-assets"
};

const trimTrailingSlash = (value: string): string => value.trim().replace(/\/+$/, "");

/** Matches content-site's confirmed event-banner endpoint and regional asset buckets. */
export const getEventBannerAssetURL = (
  assetBundleName: string,
  region: TrackerSupportedRegion,
  baseUrl = env.PUBLIC_REMOTE_ASSET_BASE_URL ?? ""
): string | null => {
  const bundle = assetBundleName.trim().replace(/^\/+|\/+$/g, "");
  const baseUrlValue = trimTrailingSlash(baseUrl);
  if (!bundle || !baseUrlValue) return null;

  return `${baseUrlValue}/${assetBucketByRegion[region]}/home/banner/${bundle}/${bundle}.webp`;
};
