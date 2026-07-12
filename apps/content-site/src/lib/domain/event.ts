import type { ContentSiteTranslator } from "$lib/i18n/runtime";

const eventTypeTextKeyMap = {
  marathon: "eventTypeValues.marathon",
  cheerful_carnival: "eventTypeValues.cheerfulCarnival",
  world_bloom: "eventTypeValues.worldLink"
} as const;

export const getEventTypeDisplay = (
  eventType: string | null,
  translate: ContentSiteTranslator
): string | null => {
  if (!eventType) {
    return null;
  }

  const key = eventTypeTextKeyMap[eventType as keyof typeof eventTypeTextKeyMap];
  if (!key) {
    return eventType;
  }

  return translate(key, eventType);
};
