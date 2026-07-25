import type {
  JsonValue,
  VirtualLiveTimelineCategory,
  VirtualLiveTimelineCharacter,
  VirtualLiveTimelineDocument,
  VirtualLiveTimelineEvent
} from "$lib/domain/virtual-live-timeline";

export type VirtualLiveTimelineNormalizationErrorCode =
  "MALFORMED_TIMELINE" | "EVENT_LIMIT_EXCEEDED";

export class VirtualLiveTimelineNormalizationError extends Error {
  constructor(readonly code: VirtualLiveTimelineNormalizationErrorCode) {
    super(code);
    this.name = "VirtualLiveTimelineNormalizationError";
  }
}

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const getNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toJsonValue = (value: unknown): JsonValue => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) return value.map(toJsonValue);
  const object = getObject(value);
  if (!object) return String(value);
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, toJsonValue(item)]));
};

const categoryByType: Record<string, VirtualLiveTimelineCategory> = {
  talk: "dialogue",
  comment: "annotation",
  spawn: "cast",
  unspawn: "cast",
  motion: "performance",
  lookAt: "performance",
  rotate: "performance",
  move: "performance",
  light: "stage",
  spotlight: "stage",
  audience: "audience",
  cheer: "audience",
  se: "audio"
};

const emptyCategoryCounts = (): Record<VirtualLiveTimelineCategory, number> => ({
  dialogue: 0,
  annotation: 0,
  cast: 0,
  performance: 0,
  stage: 0,
  audience: 0,
  audio: 0,
  other: 0
});

const legacyEventTypes: Record<string, { type: string; category: VirtualLiveTimelineCategory }> = {
  characterSpawnEvents: { type: "spawn", category: "cast" },
  characterUnspawnEvents: { type: "unspawn", category: "cast" },
  characterMoveEvents: { type: "move", category: "performance" },
  characterRotateEvents: { type: "rotate", category: "performance" },
  characterMotionEvents: { type: "motion", category: "performance" },
  characterTalkEvents: { type: "talk", category: "dialogue" },
  soundEvents: { type: "se", category: "audio" },
  audienceEvents: { type: "audience", category: "audience" },
  globalSpotlightEvents: { type: "spotlight", category: "stage" },
  lightEvents: { type: "light", category: "stage" }
};

export const normalizeVirtualLiveMCScenario = (
  payload: unknown,
  maxEvents = 20_000
): VirtualLiveTimelineDocument => {
  const root = getObject(payload);
  if (!root) throw new VirtualLiveTimelineNormalizationError("MALFORMED_TIMELINE");

  const collections = Object.entries(root).filter(
    ([key, value]) => key.endsWith("Events") && Array.isArray(value)
  ) as [string, unknown[]][];
  const totalEvents = collections.reduce((total, [, events]) => total + events.length, 0);
  if (totalEvents > maxEvents) {
    throw new VirtualLiveTimelineNormalizationError("EVENT_LIMIT_EXCEEDED");
  }

  const categoryCounts = emptyCategoryCounts();
  const typeCounts: Record<string, number> = {};
  const events: VirtualLiveTimelineEvent[] = [];
  let sourceIndex = 0;

  for (const [collectionName, collection] of collections) {
    const mapping = legacyEventTypes[collectionName] ?? {
      type: collectionName.slice(0, -"Events".length),
      category: "other" as const
    };
    for (const item of collection) {
      const event = getObject(item);
      if (!event) continue;
      const startSec = getNumber(event.Time);
      const durationSec = getNumber(event.Duration);
      const attributes = Object.fromEntries(
        Object.entries(event)
          .filter(
            ([key]) =>
              ![
                "Time",
                "Duration",
                "Character3dId",
                "Serif",
                "VoiceKey",
                "MotionKey",
                "FaicialKey"
              ].includes(key)
          )
          .map(([key, value]) => [key, toJsonValue(value)])
      );
      const serif = getString(event.Serif);
      const cueName = getString(event.VoiceKey);
      const motionKey = getString(event.MotionKey);
      const facialKey = getString(event.FaicialKey);
      if (serif) attributes.serif = serif;
      if (cueName) attributes.cueName = cueName;
      if (motionKey) attributes.motionKey = motionKey;
      if (facialKey) attributes.facialKey = facialKey;
      categoryCounts[mapping.category] += 1;
      typeCounts[mapping.type] = (typeCounts[mapping.type] ?? 0) + 1;
      events.push({
        sourceIndex: sourceIndex++,
        type: mapping.type,
        category: mapping.category,
        startSec,
        durationSec,
        endSec: startSec !== null && durationSec !== null ? startSec + durationSec : null,
        characterName: null,
        character3dId: getNumber(event.Character3dId),
        gameCharacterId: null,
        unit: null,
        displayName: null,
        voiceUrl: null,
        targetCharacter3dId: null,
        targetGameCharacterId: null,
        targetDisplayName: null,
        attributes
      });
    }
  }

  events.sort((left, right) => {
    if (left.startSec === null)
      return right.startSec === null ? left.sourceIndex - right.sourceIndex : 1;
    if (right.startSec === null) return -1;
    return left.startSec - right.startSec || left.sourceIndex - right.sourceIndex;
  });
  const durationSec = events.reduce<number | null>((maximum, event) => {
    const end = event.endSec ?? event.startSec;
    return end === null ? maximum : Math.max(maximum ?? end, end);
  }, null);

  return {
    schemaVersion: 1,
    timelineName: getString(root.Id) ?? getString(root.m_Name),
    declaredTotalEvents: totalEvents,
    totalEvents: events.length,
    durationSec,
    characters: [],
    categoryCounts,
    typeCounts,
    events
  };
};

const parseCharacters = (value: unknown): VirtualLiveTimelineCharacter[] =>
  (Array.isArray(value) ? value : [])
    .map((item): VirtualLiveTimelineCharacter | null => {
      const node = getObject(item);
      const name = getString(node?.name);
      if (!node || !name) return null;
      return {
        name,
        character3dId: getNumber(node.character3dId),
        gameCharacterId: null,
        unit: null,
        displayName: name
      };
    })
    .filter((item): item is VirtualLiveTimelineCharacter => item !== null);

export const normalizeVirtualLiveTimeline = (
  payload: unknown,
  maxEvents = 20_000
): VirtualLiveTimelineDocument => {
  const root = getObject(payload);
  const timeline = getObject(root?.__timelineParse);
  const meta = getObject(timeline?.meta);
  const rawEvents = timeline?.events;
  if (!root || !timeline || !Array.isArray(rawEvents)) {
    throw new VirtualLiveTimelineNormalizationError("MALFORMED_TIMELINE");
  }
  if (rawEvents.length > maxEvents) {
    throw new VirtualLiveTimelineNormalizationError("EVENT_LIMIT_EXCEEDED");
  }

  const characters = parseCharacters(meta?.characters);
  const characterIdByName = new Map(
    characters.map((character) => [character.name, character.character3dId])
  );
  const categoryCounts = emptyCategoryCounts();
  const typeCounts: Record<string, number> = {};

  const events: VirtualLiveTimelineEvent[] = [];
  let sourceIndex = 0;
  for (const item of rawEvents) {
    const event = getObject(item);
    if (!event) continue;
    const type = getString(event.type) ?? "unknown";
    const category = categoryByType[type] ?? "other";
    const startSec = getNumber(event.start);
    const durationSec = getNumber(event.duration);
    const explicitEnd = getNumber(event.end);
    const endSec =
      explicitEnd ?? (startSec !== null && durationSec !== null ? startSec + durationSec : null);
    const characterName = getString(event.character);
    const character3dId =
      getNumber(event.character3dId) ??
      (characterName ? (characterIdByName.get(characterName) ?? null) : null);
    const consumed = new Set(["type", "start", "duration", "end", "character", "character3dId"]);
    const attributes = Object.fromEntries(
      Object.entries(event)
        .filter(([key]) => !consumed.has(key))
        .map(([key, value]) => [key, toJsonValue(value)])
    );
    categoryCounts[category] += 1;
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    const targetCharacter3dId = type === "lookAt" ? getNumber(attributes.targetCharacterId) : null;
    events.push({
      sourceIndex: sourceIndex++,
      type,
      category,
      startSec,
      durationSec,
      endSec,
      characterName,
      character3dId,
      gameCharacterId: null,
      unit: null,
      displayName: characterName,
      voiceUrl: null,
      targetCharacter3dId,
      targetGameCharacterId: null,
      targetDisplayName: null,
      attributes
    });
  }

  events.sort((left, right) => {
    if (left.startSec === null)
      return right.startSec === null ? left.sourceIndex - right.sourceIndex : 1;
    if (right.startSec === null) return -1;
    return left.startSec - right.startSec || left.sourceIndex - right.sourceIndex;
  });

  const durationCandidates = events.flatMap((event) => {
    if (event.endSec !== null) return [event.endSec];
    if (event.startSec !== null && event.durationSec !== null)
      return [event.startSec + event.durationSec];
    return event.startSec === null ? [] : [event.startSec];
  });

  return {
    schemaVersion: 1,
    timelineName: getString(meta?.timelineName) ?? getString(root.m_Name),
    declaredTotalEvents: getNumber(meta?.totalEvents) ?? getNumber(meta?.eventCount),
    totalEvents: events.length,
    durationSec: durationCandidates.length > 0 ? Math.max(...durationCandidates) : null,
    characters,
    categoryCounts,
    typeCounts,
    events
  };
};
