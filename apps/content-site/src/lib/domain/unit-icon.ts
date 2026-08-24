import { asset } from "$app/paths";
import { normalizeUnitIconSlug } from "@platform/ui-shell";

export { normalizeUnitIconSlug as resolveCanonicalUnitSlug } from "@platform/ui-shell";

/** Resolve the unit logo URL for a canonical unit slug under /logos/. */
export const resolveUnitLogoUrl = (slug: string): string | null => {
  const normalized = normalizeUnitIconSlug(slug);
  return normalized ? asset(`/logos/logo_${normalized}.png`) : null;
};
