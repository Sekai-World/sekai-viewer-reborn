import { resolve } from "$app/paths";
import { regionLabels, type SupportedRegion } from "$lib/domain/regions";

export type NewsRegionOption = {
  key: SupportedRegion;
  label: string;
  active: boolean;
  href: string;
};

export const getNewsRegionOptions = (
  supportedRegions: readonly SupportedRegion[],
  currentRegion: SupportedRegion
): NewsRegionOption[] =>
  supportedRegions.map((region) => ({
    key: region,
    label: regionLabels[region],
    active: region === currentRegion,
    href: resolve("/news/[region]", { region })
  }));
