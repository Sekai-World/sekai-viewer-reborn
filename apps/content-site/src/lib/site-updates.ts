export type SiteUpdate = Readonly<{
  version: string;
  titleKey: string;
  summaryKey: string;
  changeKeys: readonly string[];
}>;

const FALLBACK_SITE_UPDATE: SiteUpdate = {
  version: "0.0.2",
  titleKey: "updates.release.0.0.2.title",
  summaryKey: "updates.release.0.0.2.summary",
  changeKeys: ["updates.release.0.0.2.change.catalogues", "updates.release.0.0.2.change.details"]
};

const RELEASE_0_1_0: SiteUpdate = {
  version: "0.1.0",
  titleKey: "updates.release.0.1.0.title",
  summaryKey: "updates.release.0.1.0.summary",
  changeKeys: [
    "updates.release.0.1.0.change.mysekai",
    "updates.release.0.1.0.change.titles",
    "updates.release.0.1.0.change.missions",
    "updates.release.0.1.0.change.news",
    "updates.release.0.1.0.change.music",
    "updates.release.0.1.0.change.guide",
    "updates.release.0.1.0.change.navigation"
  ]
};

// Keep new releases at the beginning of this array.
export const siteUpdates: readonly SiteUpdate[] = [RELEASE_0_1_0, FALLBACK_SITE_UPDATE];

export const currentSiteUpdate: SiteUpdate = siteUpdates[0] ?? FALLBACK_SITE_UPDATE;

const SITE_VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const isValidSiteVersion = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 64 &&
  value === value.trim() &&
  SITE_VERSION_PATTERN.test(value);

export const resolveSiteVersion = (value: unknown): string =>
  isValidSiteVersion(value) ? value : currentSiteUpdate.version;

export const getSiteUpdateForVersion = (version: string): SiteUpdate =>
  siteUpdates.find((update) => update.version === version) ?? currentSiteUpdate;
