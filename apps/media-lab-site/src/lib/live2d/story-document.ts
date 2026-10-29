import type { IScenarioData } from "#lib/story/scenario-types.js";
import type { StoryRouteIdentity } from "./story-route";

/** The route region is always explicit; it is never inferred from asset paths. */
export type StoryRegion = StoryRouteIdentity["region"];
export type StoryType = StoryRouteIdentity["storyType"];
export type StoryIdentity = StoryRouteIdentity;

/** A scenario document on the selected region's scenario bucket. */
export interface ScenarioSource {
  scenarioId: string;
  /** Bucket-relative object path, as resolved from the story master data. */
  path: string;
  /** Configured asset-base URL for this path and the explicit story region. */
  url: string;
  assetbundleName?: string;
  group?: number;
}

export interface StoryDisplayMetadata {
  scenarioId: string;
  chapterTitle?: string;
  episodeTitle?: string;
  bannerUrl?: string;
}

export interface StoryVoiceCharacterReference {
  character2dId: number;
  assetName?: string;
  unit?: string;
}

/** Serializable route data; large scenario and media payloads are loaded later in the browser. */
export interface StoryDocumentReference {
  identity: StoryIdentity;
  story: StoryDisplayMetadata;
  scenario: ScenarioSource;
  /** The same configured origin used to resolve scenario and media URLs. */
  assetBase: string;
  isCardStory: boolean;
  isActionSet: boolean;
  voiceCharacters: StoryVoiceCharacterReference[];
}

export type MediaAssetKind = "background" | "bgm" | "se" | "voice" | "movie";

/** A normalized region-bound media object. All fields are JSON-serializable. */
export interface MediaAssetReference {
  kind: MediaAssetKind;
  identifier: string;
  /** Bucket-relative logical path, before URL encoding. */
  path: string;
  /** Resolved against the region explicitly carried by the document identity. */
  url: string;
  character2dId?: number;
  character2dAssetName?: string;
  character2dUnit?: string;
}

export interface StoryModelReference {
  character2dId: number;
  /** Scenario `CostumeType`, which matches the legacy catalog's `modelBase`. */
  assetName: string;
  /** Character2D identity retained for the existing story voice/model adapter. */
  unit?: string;
}

export interface StoryTextReference {
  scenarioId: string;
  /** No translation endpoint is currently part of the confirmed story contract. */
  translationSource: "official" | "llm" | "none";
}

/**
 * Fully normalized playback descriptor. It contains data and references only:
 * no browser factories, Maps, DOM objects, or player lifecycle handles.
 */
export interface StoryDocument extends StoryDocumentReference {
  scenarioData: IScenarioData;
  text: StoryTextReference;
  initialMedia: MediaAssetReference[];
  media: MediaAssetReference[];
  models: StoryModelReference[];
}
