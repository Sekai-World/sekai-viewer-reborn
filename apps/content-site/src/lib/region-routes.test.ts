import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { supportedRegions } from "#lib/domain/regions.js";
import {
  REGION_ROUTE_PREFIXES,
  rerouteUnknownRegion,
  UNKNOWN_REGION_PATHNAME
} from "./region-routes.js";

const routesDir = join(import.meta.dirname, "../routes");

const findRegionRoutePrefixes = (): string[] =>
  readdirSync(routesDir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith("/[region]"))
    .map((entry) => `/${entry.slice(0, -"/[region]".length)}`)
    .sort();

describe("rerouteUnknownRegion", () => {
  it("covers every route directory that takes a region", () => {
    expect([...REGION_ROUTE_PREFIXES].sort()).toEqual(findRegionRoutePrefixes());
  });

  it("only lists prefixes whose single child route is the region", () => {
    // A static sibling such as `/cards/about` would be mistaken for a region.
    for (const prefix of REGION_ROUTE_PREFIXES) {
      const siblings = readdirSync(`${routesDir}${prefix}`, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      expect(siblings, prefix).toEqual(["[region]"]);
    }
  });

  it("does not shadow a real route", () => {
    expect(existsSync(`${routesDir}${UNKNOWN_REGION_PATHNAME}`)).toBe(false);
  });

  it.each(supportedRegions.map((region) => [region]))("leaves the %s region alone", (region) => {
    expect(rerouteUnknownRegion(`/cards/${region}`)).toBeUndefined();
    expect(rerouteUnknownRegion(`/card/${region}/1`)).toBeUndefined();
    expect(rerouteUnknownRegion(`/mysekai/fixture/${region}/12`)).toBeUndefined();
    expect(rerouteUnknownRegion(`/api/home/${region}`)).toBeUndefined();
  });

  it.each([
    ["an unknown region on a list page", "/cards/xx"],
    ["an unknown region on a detail page", "/card/xx/1"],
    ["an unknown region on a data endpoint", "/cards/xx/data"],
    ["an unknown region on an API endpoint", "/api/home/xx"],
    ["an unknown region under a two-segment prefix", "/mysekai/fixture/xx/12"],
    ["an unknown region on a redirect route", "/events/xx/list"],
    ["an unknown region on a unit page", "/unit/xx/leo_need"],
    ["an upper-case region", "/cards/JP"],
    ["a region with surrounding text", "/cards/jpx"],
    ["a numeric id where the region belongs", "/card/1"],
    ["a percent-encoded region", "/cards/%6Ap"]
  ])("routes %s nowhere", (_label, pathname) => {
    expect(rerouteUnknownRegion(pathname)).toBe(UNKNOWN_REGION_PATHNAME);
  });

  it.each([
    ["the home page", "/"],
    ["a list path without a region", "/cards"],
    ["a list path with a trailing slash", "/cards/"],
    ["a route without a region", "/updates"],
    ["a path that only shares a prefix's start", "/cardsx/xx"],
    ["a first segment of a two-segment prefix", "/mysekai/xx"],
    ["an API route without a region", "/api/other/xx"]
  ])("leaves %s alone", (_label, pathname) => {
    expect(rerouteUnknownRegion(pathname)).toBeUndefined();
  });
});
