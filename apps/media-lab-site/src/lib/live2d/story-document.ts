/**
 * Draft StoryDocument contract for the media-lab Live2D StoryReader.
 *
 * DRAFT (issue #256): normalized from the legacy scenario/asset URL rules
 * documented in `docs/media-lab/api-contract-audit.md`. Do not build player
 * code against these types before #258 finalizes the shapes.
 */

export type StoryRegion = "jp" | "en" | "tw" | "kr" | "cn";

export type StoryType =
  "unit" | "event" | "character" | "card" | "area-talk" | "special" | "profile";

export interface StoryIdentity {
  region: StoryRegion;
  storyType: StoryType;
  storyId: string;
}

/** Reference to a scenario JSON document on the configured asset mirror. */
export interface ScenarioSource {
  scenarioId: string;
  /** Absolute URL, or mirror-relative path resolved with an explicit region. */
  url: string;
  /** Bundle/asset name when the story type requires one (unit/event/character/special). */
  assetbundleName?: string;
  /** Action-set group number (area-talk / action-set stories). */
  group?: number;
}

export type MediaAssetKind = "background" | "bgm" | "se" | "voice" | "movie";

export interface MediaAssetReference {
  kind: MediaAssetKind;
  /** Mirror-relative logical path, before region/bucket resolution. */
  path: string;
  /** Absolute URL after region/bucket resolution, when resolvable ahead of playback. */
  url?: string;
  /** Voice binding from scenario character2d data, used for part_voice fallback. */
  character2dAssetName?: string;
  character2dUnit?: string;
}

export interface StoryModelReference {
  /** Live2D model identity as referenced by the scenario data. */
  assetName?: string;
  unit?: string;
}

export interface StoryDocument {
  identity: StoryIdentity;
  scenario: ScenarioSource;
  /** Raw scenario payload as delivered by the mirror; action/effect shape stays game-data-owned. */
  scenarioData: unknown;
  /** Synthetic initial media derived from FirstBackground/FirstBgm during pure preprocessing. */
  initialMedia: MediaAssetReference[];
  /** Normalized media references discovered in the scenario payload. */
  media: MediaAssetReference[];
  models: StoryModelReference[];
  /**
   * Translation/text source policy. The translation service stays app-owned;
   * the player only receives resolved text through its adapter.
   */
  text?: {
    translationSource?: "official" | "llm" | "none";
  };
}
