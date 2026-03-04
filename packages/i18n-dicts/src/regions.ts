export const supportedRegions = ["jp", "en", "tw", "kr", "cn"] as const;

export type SupportedRegion = (typeof supportedRegions)[number];

export const regionLabels: Record<SupportedRegion, string> = {
  jp: "JP",
  en: "EN",
  tw: "TW",
  kr: "KR",
  cn: "CN"
};
