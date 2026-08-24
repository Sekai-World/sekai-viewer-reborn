import { asset } from "$app/paths";

/**
 * Known unit slugs that have a dedicated icon PNG under /icons/.
 */
export const unitIconSlugs = new Set([
  "idol",
  "light_sound",
  "piapro",
  "school_refusal",
  "street",
  "theme_park"
]);

/** Returns a known local unit slug suitable for a unit detail route. */
export const resolveCanonicalUnitSlug = (slug: string | null | undefined): string | null => {
  const normalized = slug?.trim().toLowerCase() ?? "";
  return unitIconSlugs.has(normalized) ? normalized : null;
};

/**
 * Resolve the icon URL for a unit slug.
 * Returns null for unknown slugs.
 * When `mapNoneToPiapro` is true, slug "none" resolves to the piapro icon.
 */
export const resolveUnitIconUrl = (slug: string, mapNoneToPiapro = false): string | null => {
  const normalized = slug.trim().toLowerCase();
  if (normalized === "none" && mapNoneToPiapro) {
    return asset("/icons/icon_piapro.png");
  }
  return resolveCanonicalUnitSlug(normalized) ? asset(`/icons/icon_${normalized}.png`) : null;
};

export const resolveUnitLogoUrl = (slug: string): string | null => {
  const normalized = resolveCanonicalUnitSlug(slug);
  return normalized ? asset(`/logos/logo_${normalized}.png`) : null;
};
