import { getContext, setContext } from "svelte";

export const supportedRegions = ["jp", "en", "tw", "kr", "cn"] as const;

export type SupportedRegion = (typeof supportedRegions)[number];

export const DEFAULT_PRIMARY_REGION: SupportedRegion = "jp";
export const DEFAULT_SECONDARY_REGION: SupportedRegion = "en";

const REGION_SELECTION_CONTEXT_KEY = "media-lab-site:region-selection";

/**
 * Owns the primary/secondary region selection shared by the navbar settings
 * dropdowns (root layout) and the home page region card badges.
 *
 * The root layout instantiates one object and shares it with descendants
 * through Svelte context, so each request owns its state and importing this
 * module stays SSR-safe: there is no module-level mutable state.
 */
export class RegionSelection {
  primary = $state<SupportedRegion>(DEFAULT_PRIMARY_REGION);
  secondary = $state<SupportedRegion>(DEFAULT_SECONDARY_REGION);
}

/** Called once by the root layout during component initialisation. */
export const provideRegionSelection = (): RegionSelection => {
  const selection = new RegionSelection();
  setContext(REGION_SELECTION_CONTEXT_KEY, selection);
  return selection;
};

/** Reads the selection provided by the root layout. */
export const useRegionSelection = (): RegionSelection => {
  const selection = getContext<RegionSelection | undefined>(REGION_SELECTION_CONTEXT_KEY);
  if (!selection) {
    throw new Error("Region selection must be provided by the root layout before use.");
  }
  return selection;
};
