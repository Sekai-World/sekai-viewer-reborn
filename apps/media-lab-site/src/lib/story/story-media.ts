import type { ILive2DAssetUrl, IScenarioData } from "@platform/live2d-story-player";
import { Live2DAssetType, SnippetAction, SpecialEffectType } from "@platform/live2d-story-player";
import {
  backgroundImagePath,
  bgmPath,
  movieDirPath,
  movieFallbackPath,
  scenarioIdToAssetbundleName,
  scenarioVoicePath,
  soundEffectPaths,
  talkVoicePathCandidates
} from "./story-urls";
import type { StoryVoiceCharacter } from "./scenario-rows";

/**
 * Client-side collection of every media URL a scenario playback needs.
 * Ports the legacy viewer's media scan; the movie file name is discovered
 * through the bucket's S3 listing with a deterministic fallback.
 */

const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|avi)$/i;

const XML_ENTITY_DECODINGS: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">"
};

/** Single-pass XML entity decode; nested entities stay escaped after one pass. */
const decodeXmlEntities = (value: string): string =>
  value.replace(/&(amp|lt|gt);/g, (_, entity: string) => XML_ENTITY_DECODINGS[entity] ?? entity);

const MAX_LISTING_PAGES = 10;

/**
 * Lists every object key directly under a bucket prefix via S3 listing,
 * following continuation tokens. Returns null when the listing is
 * unavailable or incomplete, so callers never treat "unknown" as "absent".
 */
const listBucketKeys = async (
  regionBase: string,
  regionBucket: string,
  dirPath: string,
  fetchFn: typeof fetch,
  signal?: AbortSignal
): Promise<string[] | null> => {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  try {
    for (let page = 0; page < MAX_LISTING_PAGES; page += 1) {
      const continuation = continuationToken
        ? `&continuation-token=${encodeURIComponent(continuationToken)}`
        : "";
      const url = `${regionBase}/${regionBucket}/?delimiter=/&list-type=2&max-keys=1000&prefix=${encodeURIComponent(dirPath)}${continuation}`;
      const response = await fetchFn(url, signal ? { signal } : undefined);
      if (!response.ok) return null;
      const xml = await response.text();
      keys.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => decodeXmlEntities(m[1])));
      const next = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml);
      if (!xml.includes("<IsTruncated>true</IsTruncated>")) return keys;
      // A truncated page without a token cannot be continued: incomplete.
      if (!next) return null;
      continuationToken = decodeXmlEntities(next[1]);
    }
    return null;
  } catch {
    return null;
  }
};

/** Finds the first video file under a bucket prefix via S3 listing. */
const searchVideoFile = async (
  regionBase: string,
  regionBucket: string,
  dirPath: string,
  fetchFn: typeof fetch,
  signal?: AbortSignal
): Promise<string | null> => {
  const keys = await listBucketKeys(regionBase, regionBucket, dirPath, fetchFn, signal);
  return keys?.find((key) => VIDEO_FILE_PATTERN.test(key)) ?? null;
};

export interface CollectStoryMediaOptions {
  scenarioData: IScenarioData;
  isCardStory: boolean;
  isActionSet: boolean;
  regionBucket: string;
  /** Absolute origin of the remote asset host, no trailing slash. */
  regionBase: string;
  /** Builds an absolute URL for a bucket-relative path. */
  regionUrl: (path: string) => string;
  /** character2dId → asset identity for part-voice fallback paths. */
  voiceCharacters: Map<number, StoryVoiceCharacter>;
  /** Injected for tests and cancellation; defaults to the browser fetch. */
  fetch?: typeof fetch;
  signal?: AbortSignal;
  onWarning?: (reason: string) => void;
}

export interface CollectedStoryMediaAsset {
  identifier: string;
  type: ILive2DAssetUrl["type"];
  path: string;
  url: string;
  character2dId?: number;
  character2dAssetName?: string;
  character2dUnit?: string;
}

interface MediaCollectContext {
  push: (asset: Omit<CollectedStoryMediaAsset, "url">) => void;
  voiceBundleName: string;
  regionBase: string;
  regionBucket: string;
  regionUrl: (path: string) => string;
  fetch: typeof fetch;
  signal?: AbortSignal;
  voiceCharacters: Map<number, StoryVoiceCharacter>;
  onWarning?: (reason: string) => void;
  /** Bucket directory → its object keys (null when the listing failed). */
  directoryListings: Map<string, Promise<ReadonlySet<string> | null>>;
}

const listDirectory = (
  context: MediaCollectContext,
  dirPath: string
): Promise<ReadonlySet<string> | null> => {
  const cached = context.directoryListings.get(dirPath);
  if (cached) return cached;
  const listing = listBucketKeys(
    context.regionBase,
    context.regionBucket,
    dirPath,
    context.fetch,
    context.signal
  ).then((keys) => (keys ? new Set(keys) : null));
  context.directoryListings.set(dirPath, listing);
  return listing;
};

/**
 * Picks the first voice candidate that exists in the bucket. Only called for
 * part voices, which live outside the story's own voice bundle. When no
 * listing confirms any candidate, the canonical path is kept so a genuinely
 * missing file still fails loudly instead of being hidden.
 */
const resolveExistingVoicePath = async (
  candidates: string[],
  context: MediaCollectContext
): Promise<string> => {
  const [canonical] = candidates;
  for (const candidate of candidates) {
    const files = await listDirectory(context, candidate.slice(0, candidate.lastIndexOf("/") + 1));
    if (files?.has(candidate)) return candidate;
  }
  return canonical;
};

const collectTalkVoices = async (
  talk: IScenarioData["TalkData"][number] | undefined,
  voicePathFor: (voiceId: string, character2dId: number | undefined) => Promise<string>,
  context: MediaCollectContext
): Promise<void> => {
  if (!talk) return;
  const character2dId = talk.TalkCharacters[0]?.Character2dId;
  const character =
    character2dId === undefined ? undefined : context.voiceCharacters.get(character2dId);
  for (const v of talk.Voices) {
    context.push({
      identifier: v.VoiceId,
      type: Live2DAssetType.Talk,
      path: await voicePathFor(v.VoiceId, character2dId),
      ...(character2dId !== undefined ? { character2dId } : {}),
      ...(character?.assetName ? { character2dAssetName: character.assetName } : {}),
      ...(character?.unit ? { character2dUnit: character.unit } : {})
    });
  }
};

const collectSpecialEffectMedia = async (
  effect: IScenarioData["SpecialEffectData"][number] | undefined,
  context: MediaCollectContext
): Promise<void> => {
  if (!effect) return;
  const { push } = context;
  switch (effect.EffectType) {
    case SpecialEffectType.ChangeBackground:
      push({
        identifier: effect.StringValSub,
        type: Live2DAssetType.BackgroundImage,
        path: backgroundImagePath(effect.StringValSub)
      });
      return;
    case SpecialEffectType.FullScreenText: {
      const path = scenarioVoicePath(context.voiceBundleName, effect.StringValSub);
      push({ identifier: effect.StringValSub, type: Live2DAssetType.Talk, path });
      return;
    }
    case SpecialEffectType.Movie: {
      const dirPath = movieDirPath(effect.StringVal);
      const found = await searchVideoFile(
        context.regionBase,
        context.regionBucket,
        dirPath,
        context.fetch,
        context.signal
      );
      const path = found ?? movieFallbackPath(effect.StringVal);
      if (!found) {
        context.onWarning?.(
          `Movie file not listed for ${effect.StringVal}; using default file name.`
        );
      }
      push({
        identifier: effect.StringVal,
        type: Live2DAssetType.Video,
        path
      });
      return;
    }
    default:
      return;
  }
};

const collectSoundMedia = (
  sound: IScenarioData["SoundData"][number] | undefined,
  context: MediaCollectContext
): void => {
  if (!sound) return;
  if (sound.Bgm) {
    context.push({
      identifier: sound.Bgm,
      type: Live2DAssetType.BackgroundMusic,
      path: bgmPath(sound.Bgm)
    });
  } else if (sound.Se) {
    context.push({
      identifier: sound.Se,
      type: Live2DAssetType.SoundEffect,
      path: soundEffectPaths(sound.Se)[0]
    });
  }
};

/**
 * Walks the PROCESSED scenario snippets (call after
 * `processScenarioDataForPlayer`) and resolves every media URL the player
 * will preload, including the UI assets appended by the loader.
 */
export const collectStoryMediaAssets = async (
  options: CollectStoryMediaOptions
): Promise<CollectedStoryMediaAsset[]> => {
  const {
    scenarioData,
    isCardStory,
    isActionSet,
    regionBucket,
    regionBase,
    regionUrl,
    voiceCharacters,
    fetch: fetchFn = fetch,
    signal,
    onWarning
  } = options;
  const result: CollectedStoryMediaAsset[] = [];
  const push = (asset: Omit<CollectedStoryMediaAsset, "url">): void => {
    const url = regionUrl(asset.path);
    if (!result.some((existing) => existing.url === url && existing.type === asset.type)) {
      result.push({ ...asset, url });
    }
  };

  const voiceBundleName = scenarioIdToAssetbundleName(scenarioData.ScenarioId);

  const voicePathFor = async (
    voiceId: string,
    character2dId: number | undefined
  ): Promise<string> => {
    const candidates = talkVoicePathCandidates({
      scenarioId: voiceBundleName,
      voiceId,
      isCardStory,
      isActionSet,
      character: character2dId !== undefined ? voiceCharacters.get(character2dId) : undefined
    });
    // Normal voices are served from the canonical bundle with no probing;
    // only part-voice ids carry fallback candidates that need a listing.
    return candidates.length > 1
      ? await resolveExistingVoicePath(candidates, context)
      : candidates[0];
  };

  const context: MediaCollectContext = {
    push,
    voiceBundleName,
    regionBase,
    regionBucket,
    regionUrl,
    fetch: fetchFn,
    signal,
    voiceCharacters,
    onWarning,
    directoryListings: new Map()
  };

  for (const snippet of scenarioData.Snippets) {
    if (signal?.aborted) {
      const error = new Error("Story media collection was aborted");
      error.name = "AbortError";
      throw error;
    }
    switch (snippet.Action) {
      case SnippetAction.Talk:
        await collectTalkVoices(
          scenarioData.TalkData[snippet.ReferenceIndex],
          voicePathFor,
          context
        );
        break;
      case SnippetAction.SpecialEffect:
        await collectSpecialEffectMedia(
          scenarioData.SpecialEffectData[snippet.ReferenceIndex],
          context
        );
        break;
      case SnippetAction.Sound:
        collectSoundMedia(scenarioData.SoundData[snippet.ReferenceIndex], context);
        break;
      default:
        break;
    }
  }
  if (signal?.aborted) {
    const error = new Error("Story media collection was aborted");
    error.name = "AbortError";
    throw error;
  }
  return result;
};

/** Compatibility projection consumed by the existing player runtime. */
export const collectStoryMediaUrls = async (
  options: CollectStoryMediaOptions
): Promise<ILive2DAssetUrl[]> =>
  (await collectStoryMediaAssets(options)).map(({ identifier, type, url }) => ({
    identifier,
    type,
    url
  }));
