import { asset } from "$app/paths";
import { normalizeUnitIconSlug } from "@platform/ui-shell";

export const resolveUnitLogoUrl = (slug: string): string | null => {
  const normalized = normalizeUnitIconSlug(slug);
  return normalized ? asset(`/logos/logo_${normalized}.png`) : null;
};
