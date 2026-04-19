export const eventTypeDisplayMap = {
  marathon: "Marathon",
  cheerful_carnival: "Cheerful Carnival",
  world_bloom: "World Link"
} as const;

export const getEventTypeDisplay = (eventType: string | null): string | null => {
  if (!eventType) {
    return null;
  }

  return eventTypeDisplayMap[eventType as keyof typeof eventTypeDisplayMap] ?? eventType;
};
