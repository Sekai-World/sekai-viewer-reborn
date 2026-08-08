export const supportedRegions = ["jp", "en", "tw", "kr", "cn"] as const;

export type SupportedRegion = (typeof supportedRegions)[number];

export const regionLabels: Record<SupportedRegion, string> = {
  jp: "JP",
  en: "EN",
  tw: "TW",
  kr: "KR",
  cn: "CN"
};

export const isSupportedRegion = (value: string): value is SupportedRegion =>
  supportedRegions.includes(value as SupportedRegion);

export const normalizeRegion = (
  value: string | null | undefined,
  fallback: SupportedRegion
): SupportedRegion => {
  const normalized = value?.trim().toLowerCase();
  return normalized && isSupportedRegion(normalized) ? normalized : fallback;
};
