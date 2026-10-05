import { describe, expect, it } from "vitest";
import {
  currentSiteUpdate,
  getSiteUpdateForVersion,
  isValidSiteVersion,
  resolveSiteVersion,
  siteUpdates
} from "./site-updates";

describe("site updates", () => {
  it("provides the current release entry", () => {
    expect(siteUpdates[0]).toBe(currentSiteUpdate);
    expect(currentSiteUpdate.version).toBe("0.0.2");
  });

  it("accepts semantic versions and rejects malformed values", () => {
    expect(isValidSiteVersion("1.2.3")).toBe(true);
    expect(isValidSiteVersion("1.2.3-beta.1+build.4")).toBe(true);
    expect(isValidSiteVersion(" 1.2.3")).toBe(false);
    expect(isValidSiteVersion("1.2")).toBe(false);
    expect(isValidSiteVersion(null)).toBe(false);
  });

  it("falls back safely when the runtime version is unknown", () => {
    expect(resolveSiteVersion("1.2")).toBe(currentSiteUpdate.version);
    expect(resolveSiteVersion(undefined)).toBe(currentSiteUpdate.version);
    expect(getSiteUpdateForVersion("1.2.3")).toBe(currentSiteUpdate);
  });
});
