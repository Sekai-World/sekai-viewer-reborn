import { tCommon } from "$lib/i18n";

const eventTypeTextKeyMap = {
  marathon: "eventTypeValues.marathon",
  cheerful_carnival: "eventTypeValues.cheerfulCarnival",
  world_bloom: "eventTypeValues.worldLink"
} as const;

export const getEventTypeDisplay = (
  eventType: string | null,
  localeValue: string
): string | null => {
  if (!eventType) {
    return null;
  }

  const key = eventTypeTextKeyMap[eventType as keyof typeof eventTypeTextKeyMap];
  if (!key) {
    return eventType;
  }

  return tCommon(localeValue, key, eventType);
};
