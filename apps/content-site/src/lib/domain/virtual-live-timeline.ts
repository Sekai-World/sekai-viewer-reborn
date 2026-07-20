import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type VirtualLiveTimelineCategory =
  | "dialogue"
  | "annotation"
  | "cast"
  | "performance"
  | "stage"
  | "audience"
  | "audio"
  | "other";

export type VirtualLiveTimelineCharacter = {
  name: string;
  character3dId: number | null;
  gameCharacterId: number | null;
  unit: string | null;
  displayName: string | null;
};

export type VirtualLiveTimelineEvent = {
  sourceIndex: number;
  type: string;
  category: VirtualLiveTimelineCategory;
  startSec: number | null;
  durationSec: number | null;
  endSec: number | null;
  characterName: string | null;
  character3dId: number | null;
  gameCharacterId: number | null;
  unit: string | null;
  displayName: string | null;
  voiceUrl: string | null;
  targetCharacter3dId: number | null;
  targetGameCharacterId: number | null;
  targetDisplayName: string | null;
  attributes: Record<string, JsonValue>;
};

export type VirtualLiveTimelineDocument = {
  schemaVersion: 1;
  timelineName: string | null;
  declaredTotalEvents: number | null;
  totalEvents: number;
  durationSec: number | null;
  characters: VirtualLiveTimelineCharacter[];
  categoryCounts: Record<VirtualLiveTimelineCategory, number>;
  typeCounts: Record<string, number>;
  events: VirtualLiveTimelineEvent[];
};

export const isSupportedVirtualLiveRegion = (region: string): region is SupportedRegion =>
  (supportedRegions as readonly string[]).includes(region);

export const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
