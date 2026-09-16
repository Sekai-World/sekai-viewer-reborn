import { env } from "$env/dynamic/public";

/**
 * Registers the story-asset LRU cache service worker (`static/sw.js`) and
 * hands it this deployment's asset allowlist. The worker is the only
 * interception point that covers every loader the player uses (pixi model
 * XHRs, Howler audio, `<img>`/`fetch` preloaders), so registration is
 * best-effort: when service workers are unavailable the player simply falls
 * back to plain networking plus the browser HTTP cache.
 */

const DEFAULT_REMOTE_ASSET_BASE = "https://storage.sekai.best";
const LIVE2D_RELAY_PREFIX = "/live2d/assets/";
const STORY_ASSET_CACHE_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

export const STORY_ASSET_CACHE_SW_PATH = "/sw.js";

export const registerStoryAssetCache = async (): Promise<void> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    await navigator.serviceWorker.register(STORY_ASSET_CACHE_SW_PATH, {
      scope: "/"
    });
    const registration = await navigator.serviceWorker.ready;
    const base =
      env.PUBLIC_REMOTE_ASSET_BASE_URL?.trim().replace(/\/+$/, "") ||
      DEFAULT_REMOTE_ASSET_BASE;
    // An absolute base is matched by origin (region + Live2D buckets live on
    // the same host); a relative base is a same-origin reverse proxy that
    // must be matched by path prefix instead.
    const isPathBase = base.startsWith("/");
    registration.active?.postMessage({
      type: "configure-story-asset-cache",
      origins: isPathBase ? [] : [new URL(base).origin],
      // The Live2D relay is always same-origin, whatever the asset base is.
      pathPrefixes: isPathBase
        ? [base, LIVE2D_RELAY_PREFIX]
        : [LIVE2D_RELAY_PREFIX],
      maxTotalBytes: STORY_ASSET_CACHE_MAX_TOTAL_BYTES
    });
  } catch {
    // Cache availability is optional; never block the reader on it.
  }
};
