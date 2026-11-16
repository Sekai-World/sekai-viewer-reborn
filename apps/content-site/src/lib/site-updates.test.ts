import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  currentSiteUpdate,
  getSiteUpdateForVersion,
  isValidSiteVersion,
  resolveSiteVersion,
  siteUpdates
} from "./site-updates";

const GUIDE =
  'See AGENTS.md section "`content-site` Release Notes / Update Notices" (apps/content-site/src/lib/site-updates.ts).';

const packageVersion = (
  JSON.parse(readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8")) as {
    version: string;
  }
).version;

const i18nKeys = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../../../packages/i18n-source/content-site/common.json"),
    "utf8"
  )
) as Record<string, string>;

const parseSemver = (version: string): [number, number, number] => {
  const [major = 0, minor = 0, patch = 0] = version
    .split(/[-+]/)[0]!
    .split(".")
    .map((part) => Number(part));
  return [major, minor, patch];
};

const compareSemver = (a: string, b: string): number => {
  const left = parseSemver(a);
  const right = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i]! - right[i]!;
  }
  return 0;
};

describe("site updates", () => {
  it("provides the current release entry", () => {
    expect(siteUpdates[0]).toBe(currentSiteUpdate);
  });

  it("has an entry for the released package version", () => {
    expect(
      siteUpdates.some((update) => update.version === packageVersion),
      `No siteUpdates entry for content-site version ${packageVersion}. ${GUIDE}`
    ).toBe(true);
  });

  it("is ordered newest-first and not behind the package version", () => {
    for (let i = 1; i < siteUpdates.length; i += 1) {
      expect(
        compareSemver(siteUpdates[i - 1]!.version, siteUpdates[i]!.version),
        `siteUpdates must be newest-first: ${siteUpdates[i - 1]!.version} precedes ${siteUpdates[i]!.version}. ${GUIDE}`
      ).toBeGreaterThan(0);
    }
    expect(
      compareSemver(currentSiteUpdate.version, packageVersion),
      `Newest siteUpdates entry ${currentSiteUpdate.version} is older than package version ${packageVersion}. ${GUIDE}`
    ).toBeGreaterThanOrEqual(0);
  });

  it("only references i18n keys that exist in common.json", () => {
    for (const update of siteUpdates) {
      for (const key of [update.titleKey, update.summaryKey, ...update.changeKeys]) {
        expect(
          Object.hasOwn(i18nKeys, key),
          `Missing i18n key "${key}" for update ${update.version} in packages/i18n-source/content-site/common.json. ${GUIDE}`
        ).toBe(true);
      }
    }
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
