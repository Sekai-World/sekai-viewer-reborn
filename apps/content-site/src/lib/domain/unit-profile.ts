export const UNIT_CODE_ORDER = [
  "light_sound",
  "idol",
  "street",
  "theme_park",
  "school_refusal",
  "piapro"
] as const;

export const musicTagByUnitCode: Record<string, string> = {
  idol: "idol",
  light_sound: "light_music_club",
  street: "street",
  theme_park: "theme_park",
  school_refusal: "school_refusal",
  piapro: "vocaloid"
};

export const unitCodeByMusicTag: Record<string, string> = Object.fromEntries(
  Object.entries(musicTagByUnitCode).map(([unit, tag]) => [tag, unit])
);

export const formatUnitFallbackLabel = (unit: string): string =>
  unit
    .replaceAll("_", " ")
    .split(" ")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
