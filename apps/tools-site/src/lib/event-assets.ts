import { env } from "$env/dynamic/public";
import { isTrackerSupportedRegion, type TrackerSupportedRegion } from "$lib/regions";

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

/** Resolve renderer sprite names without fetching or requiring remote configuration for local art. */
export const getHonorAssetURL = (
  bundlePath: string | null | undefined,
  resourceName: string | null | undefined,
  region: string,
  baseUrl: string | null = env.PUBLIC_REMOTE_ASSET_BASE_URL ?? ""
): string | null => {
  const bundle = trimBoundarySlashes(bundlePath ?? "");
  const resource = trimBoundarySlashes(resourceName ?? "");
  if (
    !bundle ||
    !resource ||
    !bundle.split("/").every((part) => /^[\w-]+$/.test(part)) ||
    !/^[\w-]+(?:\.png|\.webp)?$/.test(resource)
  )
    return null;

  const sprite = resource.replace(/\.(?:png|webp)$/, "");
  if (bundle === "local/honor") return `/degree/${sprite}.png`;
  const base = trimTrailingSlashes(baseUrl ?? "");
  if (!base || !isTrackerSupportedRegion(region)) return null;
  return `${base}/${assetBucketByRegion[region]}/${bundle}/${sprite}.webp`;
};
