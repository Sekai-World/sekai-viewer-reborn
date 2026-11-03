import { normalizeRegion } from "#lib/i18n/region.js";

// List pages that only exist under a region segment, e.g. `/musics/:region`.
// `region-list-redirect.test.ts` fails when a new list route is missing here.
export const REGION_LIST_PATHS: readonly string[] = [
  "/cards",
  "/characters",
  "/events",
  "/gachas",
  "/honors",
  "/missions",
  "/musics",
  "/mysekai/fixtures",
  "/mysekai/materials",
  "/mysekai/shop",
  "/mysekai/soundtracks",
  "/news",
  "/stamps",
  "/virtual-lives"
];

const regionListPaths = new Set(REGION_LIST_PATHS);

/**
 * Sends a list URL without a region to the visitor's preferred region. The
 * target depends on the region cookie, so the redirect is temporary and must
 * not be cached.
 */
export const getRegionListRedirect = (
  method: string,
  url: URL,
  preferredRegionCookie: string | undefined
): Response | null => {
  if (method !== "GET" && method !== "HEAD") return null;

  const pathname =
    url.pathname.length > 1 && url.pathname.endsWith("/")
      ? url.pathname.slice(0, -1)
      : url.pathname;
  if (!regionListPaths.has(pathname)) return null;

  const region = normalizeRegion(preferredRegionCookie);
  return new Response(null, {
    status: 302,
    headers: {
      location: `${pathname}/${region}${url.search}`,
      "cache-control": "private, no-store"
    }
  });
};
