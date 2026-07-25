type UnitColorCode = `#${string}`;

const unitColorBySlug = {
  light_sound: "#4455dd",
  idol: "#88dd44",
  street: "#ee1166",
  theme_park: "#ff9900",
  school_refusal: "#884499",
  piapro: "#ffffff"
} as const satisfies Record<string, UnitColorCode>;

export type UnitColorSlug = keyof typeof unitColorBySlug;

const normalizeUnitSlug = (
  slug: string | null | undefined,
  mapNoneToPiapro: boolean
): string | null => {
  const normalized = slug?.trim().toLowerCase() ?? "";
  if (normalized.length === 0) {
    return null;
  }

  return normalized === "none" && mapNoneToPiapro ? "piapro" : normalized;
};

const isUnitColorSlug = (value: string): value is UnitColorSlug => value in unitColorBySlug;

export const getStaticUnitColor = (
  slug: string | null | undefined,
  mapNoneToPiapro = false
): UnitColorCode | null => {
  const normalized = normalizeUnitSlug(slug, mapNoneToPiapro);
  return normalized !== null && isUnitColorSlug(normalized) ? unitColorBySlug[normalized] : null;
};
