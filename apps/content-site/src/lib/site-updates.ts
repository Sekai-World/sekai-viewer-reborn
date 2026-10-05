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

// Keep new releases at the beginning of this array.
export const siteUpdates: readonly SiteUpdate[] = [FALLBACK_SITE_UPDATE];

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
