import idolIconUrl from "./assets/unit-icons/icon_idol.png";
import lightSoundIconUrl from "./assets/unit-icons/icon_light_sound.png";
import piaproIconUrl from "./assets/unit-icons/icon_piapro.png";
import schoolRefusalIconUrl from "./assets/unit-icons/icon_school_refusal.png";
import streetIconUrl from "./assets/unit-icons/icon_street.png";
import themeParkIconUrl from "./assets/unit-icons/icon_theme_park.png";

export const unitIconSlugs = [
  "idol",
  "light_sound",
  "piapro",
  "school_refusal",
  "street",
  "theme_park"
] as const;

export type UnitIconSlug = (typeof unitIconSlugs)[number];

const unitIconBySlug: Record<UnitIconSlug, string> = {
  idol: idolIconUrl,
  light_sound: lightSoundIconUrl,
  piapro: piaproIconUrl,
  school_refusal: schoolRefusalIconUrl,
  street: streetIconUrl,
  theme_park: themeParkIconUrl
};

const unitBorderColorBySlug: Record<UnitIconSlug, `#${string}`> = {
  light_sound: "#4455dd",
  idol: "#88dd44",
  street: "#ee1166",
  theme_park: "#ff9900",
  school_refusal: "#884499",
  piapro: "#ffffff"
};

export const normalizeUnitIconSlug = (
  unit: string | null | undefined,
  mapNoneToPiapro = false
): UnitIconSlug | null => {
  const normalized = unit?.trim().toLowerCase() ?? "";
  const slug = normalized === "none" && mapNoneToPiapro ? "piapro" : normalized;

  return unitIconSlugs.includes(slug as UnitIconSlug) ? (slug as UnitIconSlug) : null;
};

export const resolveUnitIconUrl = (
  unit: string | null | undefined,
  mapNoneToPiapro = false
): string | null => {
  const slug = normalizeUnitIconSlug(unit, mapNoneToPiapro);
  return slug ? unitIconBySlug[slug] : null;
};

export const getUnitIconBorderColor = (
  unit: string | null | undefined,
  mapNoneToPiapro = false
): `#${string}` | null => {
  const slug = normalizeUnitIconSlug(unit, mapNoneToPiapro);
  return slug ? unitBorderColorBySlug[slug] : null;
};
