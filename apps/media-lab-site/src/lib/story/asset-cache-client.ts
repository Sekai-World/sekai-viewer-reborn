/**
 * Registers the story-asset LRU cache service worker (`static/sw.js`) and
 * hands it this deployment's asset allowlist. The allowlist is derived from
 * the asset base the server resolves from `PUBLIC_REMOTE_ASSET_BASE_URL`
 * (passed in by the layout server load, the same value the story pages build
 * asset URLs from) plus the app's own Live2D relay route. Nothing path- or
 * origin-specific is hardcoded here: production deployments without a
 * reverse proxy cache the configured remote origin, dev deployments with a
 * same-origin proxy base cache that prefix.
 *
 * Registration is best-effort: when service workers are unavailable the
 * player simply falls back to plain networking plus the browser HTTP cache.
 */

const LIVE2D_RELAY_PREFIX = "/live2d/assets/";
const STORY_ASSET_CACHE_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

export const STORY_ASSET_CACHE_SW_PATH = "/sw.js";

export const registerStoryAssetCache = async (
  assetBase: string
): Promise<void> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const base = assetBase.trim().replace(/\/+$/, "");
  if (!base) return;
  try {
    await navigator.serviceWorker.register(STORY_ASSET_CACHE_SW_PATH, {
      scope: "/"
    });
    const registration = await navigator.serviceWorker.ready;
    // An absolute base is matched by origin (region and Live2D buckets share
    // the host); a relative base is a same-origin reverse proxy that must be
    // matched by path prefix instead.
    const isPathBase = base.startsWith("/");
    registration.active?.postMessage({
      type: "configure-story-asset-cache",
      origins: isPathBase ? [] : [new URL(base).origin],
      // The Live2D relay is an app route, so it stays in the allowlist for
      // every deployment whatever the asset base is.
      pathPrefixes: isPathBase
        ? [base, LIVE2D_RELAY_PREFIX]
        : [LIVE2D_RELAY_PREFIX],
      maxTotalBytes: STORY_ASSET_CACHE_MAX_TOTAL_BYTES
    });
  } catch {
    // Cache availability is optional; never block the reader on it.
  }
};
