import { describe, expect, it } from "vitest";
import { reroute } from "./hooks";
import { UNKNOWN_REGION_PATHNAME } from "#lib/region-routes.js";

const rerouteFor = (path: string) => reroute({ url: new URL(path, "https://example.test"), fetch });

describe("content-site reroute hook", () => {
  it("routes an unknown region nowhere", () => {
    expect(rerouteFor("/cards/xx")).toBe(UNKNOWN_REGION_PATHNAME);
    expect(rerouteFor("/api/home/xx?limit=1")).toBe(UNKNOWN_REGION_PATHNAME);
  });

  it("leaves a supported region and other routes alone", () => {
    expect(rerouteFor("/cards/jp")).toBeUndefined();
    expect(rerouteFor("/updates")).toBeUndefined();
  });
});
