import { supportedRegions } from "#lib/domain/regions.js";

// Every route whose next path segment is a `[region]` parameter.
// `region-routes.test.ts` fails when a route directory is missing here.
export const REGION_ROUTE_PREFIXES: readonly string[] = [
  "/api/gacha",
  "/api/home",
  "/card",
  "/cards",
  "/character",
  "/characters",
  "/comics",
  "/costume",
  "/costumes",
  "/event",
  "/events",
  "/gacha",
  "/gachas",
  "/honors",
  "/missions",
  "/music",
  "/musics",
  "/mysekai/fixture",
  "/mysekai/fixtures",
  "/mysekai/material",
  "/mysekai/materials",
  "/mysekai/photo-frames",
  "/mysekai/shop",
  "/mysekai/soundtracks",
  "/news",
  "/stamps",
  "/unit",
  "/virtual-live",
  "/virtual-lives"
];

/** A pathname that matches no route, so SvelteKit answers with its 404 page. */
export const UNKNOWN_REGION_PATHNAME = "/__unknown-region__";

const regions: readonly string[] = supportedRegions;
// Two-segment prefixes first, so `/mysekai/fixture` is not read as `/mysekai` + region.
const prefixes = [...REGION_ROUTE_PREFIXES].sort((a, b) => b.length - a.length);

/**
 * Returns the pathname to route instead when `pathname` is under a region
 * route but names a region that is not served, or `undefined` to leave the
 * request alone. Routing such a request nowhere makes it a normal 404 instead
 * of a page of Japanese data under an arbitrary region segment.
 *
 * Assumes the app is served from the root: with a `paths.base`, both the
 * prefixes and the target would need that base.
 */
export const rerouteUnknownRegion = (pathname: string): string | undefined => {
  const prefix = prefixes.find((candidate) => pathname.startsWith(`${candidate}/`));
  if (prefix === undefined) return undefined;

  const region = pathname.slice(prefix.length + 1).split("/", 1)[0];
  // No region segment at all (`/cards/`): the list redirect or the router handles it.
  if (region === "" || regions.includes(region)) return undefined;

  return UNKNOWN_REGION_PATHNAME;
};
