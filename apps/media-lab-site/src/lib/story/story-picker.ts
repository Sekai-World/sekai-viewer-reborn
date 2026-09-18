/**
 * The picker-side story type vocabulary: one sidebar sub-page per type.
 *
 * Deliberately narrower than `storyRouteStoryTypes` in
 * `$lib/live2d/story-route`: the `profile` type has no picker surface yet.
 */
export const pickerStoryTypes = [
  "unit",
  "event",
  "character",
  "card",
  "area-talk",
  "special"
] as const;

export type PickerStoryType = (typeof pickerStoryTypes)[number];

export const isPickerStoryType = (value: string): value is PickerStoryType =>
  (pickerStoryTypes as readonly string[]).includes(value);

/**
 * The picker list page a reader route returns to: `/story-reader/{type}`
 * for the picker-backed types, the unit list as the fallback for types
 * without a picker surface (deep-linked `profile` reads).
 */
export const readerBackPath = (storyType: string): string =>
  isPickerStoryType(storyType) ? `/story-reader/${storyType}` : "/story-reader/unit";

/** Sidebar icon for each picker story type sub-page. */
export const pickerStoryTypeIcons: Record<PickerStoryType, string> = {
  unit: "mdi:account-group-outline",
  event: "mdi:calendar-star",
  character: "mdi:account-voice",
  card: "mdi:card-multiple-outline",
  "area-talk": "mdi:map-marker-radius-outline",
  special: "mdi:auto-fix"
};

/**
 * True when `pathname` is a picker or reader route of this story type:
 * `/story-reader/{type}`, `/story-reader/{region}/{type}/{storyId}`, and the
 * Live2D player mode of the reader `/live2d/story-reader/{region}/{type}/...`.
 */
export const isActivePickerStoryTypePath = (
  pathname: string,
  storyType: PickerStoryType
): boolean => {
  const segments = pathname.split("/");
  if (segments[1] === "story-reader") {
    return segments[2] === storyType || segments[3] === storyType;
  }
  return segments[1] === "live2d" && segments[2] === "story-reader" && segments[4] === storyType;
};
