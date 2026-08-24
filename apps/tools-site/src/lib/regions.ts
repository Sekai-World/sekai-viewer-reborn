export const supportedRegions = ["jp", "en", "tw", "kr", "cn"] as const;

export type SupportedRegion = (typeof supportedRegions)[number];

// The tracker is not backed by CN ranking data. Keep this separate from the
// broader region list, which is still used by non-tracker features.
export const trackerSupportedRegions = ["jp", "tw", "en", "kr"] as const;

export type TrackerSupportedRegion = (typeof trackerSupportedRegions)[number];

export const regionLabels: Record<SupportedRegion, string> = {
  jp: "JP",
  en: "EN",
  tw: "TW",
  kr: "KR",
  cn: "CN"
};

export const isSupportedRegion = (value: string): value is SupportedRegion =>
  supportedRegions.includes(value as SupportedRegion);

export const isTrackerSupportedRegion = (value: string): value is TrackerSupportedRegion =>
  trackerSupportedRegions.includes(value as TrackerSupportedRegion);

export const normalizeRegion = (
  value: string | null | undefined,
  fallback: SupportedRegion
): SupportedRegion => {
  const normalized = value?.trim().toLowerCase();
  return normalized && isSupportedRegion(normalized) ? normalized : fallback;
};
