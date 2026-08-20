import { env } from "$env/dynamic/public";
import type { TrackerSupportedRegion } from "$lib/regions";

const assetBucketByRegion: Record<TrackerSupportedRegion, string> = {
  jp: "sekai-jp-assets",
  en: "sekai-en-assets",
  tw: "sekai-tc-assets",
  kr: "sekai-kr-assets"
};

const trimTrailingSlashes = (value: string): string => {
  const trimmed = value.trim();
  let end = trimmed.length;
  while (end > 0 && trimmed[end - 1] === "/") end -= 1;
  return trimmed.slice(0, end);
};

const trimBoundarySlashes = (value: string): string => {
  const trimmed = value.trim();
  let start = 0;
  let end = trimmed.length;
  while (start < end && trimmed[start] === "/") start += 1;
  while (end > start && trimmed[end - 1] === "/") end -= 1;
  return trimmed.slice(start, end);
};

/** Matches content-site's confirmed event-banner endpoint and regional asset buckets. */
export const getEventBannerAssetURL = (
  assetBundleName: string,
  region: TrackerSupportedRegion,
  baseUrl = env.PUBLIC_REMOTE_ASSET_BASE_URL ?? ""
): string | null => {
  const bundle = trimBoundarySlashes(assetBundleName);
  const baseUrlValue = trimTrailingSlashes(baseUrl);
  if (!bundle || !baseUrlValue) return null;

  return `${baseUrlValue}/${assetBucketByRegion[region]}/home/banner/${bundle}/${bundle}.webp`;
};
