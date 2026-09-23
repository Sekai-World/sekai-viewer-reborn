import type { IScenarioData } from "./scenario-types";
import { SnippetAction, SpecialEffectType } from "./scenario-types";
import type { ILive2DAssetUrl } from "./player/player-types";
import { Live2DAssetType } from "./player/player-types";
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

/** Finds the first video file under a bucket prefix via S3 listing. */
const searchVideoFile = async (
  regionBase: string,
  regionBucket: string,
  dirPath: string
): Promise<string | null> => {
  try {
    const url = `${regionBase}/${regionBucket}/?delimiter=/&list-type=2&max-keys=500&prefix=${encodeURIComponent(dirPath)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const xml = await response.text();
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => decodeXmlEntities(m[1]));
    const videoFile = keys.find((key) => VIDEO_FILE_PATTERN.test(key));
    return videoFile ?? null;
  } catch {
    return null;
  }
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
  onWarning?: (reason: string) => void;
}

interface MediaCollectContext {
  push: (asset: ILive2DAssetUrl) => void;
  voiceBundleName: string;
  regionUrl: (path: string) => string;
  regionBase: string;
  regionBucket: string;
  onWarning?: (reason: string) => void;
}

const collectTalkVoices = (
  talk: IScenarioData["TalkData"][number] | undefined,
  voiceUrlFor: (voiceId: string, character2dId: number | undefined) => string,
  context: MediaCollectContext
): void => {
  if (!talk) return;
  for (const v of talk.Voices) {
    context.push({
      identifier: v.VoiceId,
      type: Live2DAssetType.Talk,
      url: voiceUrlFor(v.VoiceId, talk.TalkCharacters[0]?.Character2dId)
    });
  }
};

const collectSpecialEffectMedia = async (
  effect: IScenarioData["SpecialEffectData"][number] | undefined,
  context: MediaCollectContext
): Promise<void> => {
  if (!effect) return;
  const { push, regionUrl } = context;
  switch (effect.EffectType) {
    case SpecialEffectType.ChangeBackground:
      push({
        identifier: effect.StringValSub,
        type: Live2DAssetType.BackgroundImage,
        url: regionUrl(backgroundImagePath(effect.StringValSub))
      });
      return;
    case SpecialEffectType.FullScreenText: {
      const url = regionUrl(scenarioVoicePath(context.voiceBundleName, effect.StringValSub));
      push({ identifier: effect.StringValSub, type: Live2DAssetType.Talk, url });
      return;
    }
    case SpecialEffectType.Movie: {
      const dirPath = movieDirPath(effect.StringVal);
      const found = await searchVideoFile(context.regionBase, context.regionBucket, dirPath);
      const path = found ?? movieFallbackPath(effect.StringVal);
      if (!found) {
        context.onWarning?.(
          `Movie file not listed for ${effect.StringVal}; using default file name.`
        );
      }
      push({
        identifier: effect.StringVal,
        type: Live2DAssetType.Video,
        url: regionUrl(path)
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
      url: context.regionUrl(bgmPath(sound.Bgm))
    });
  } else if (sound.Se) {
    context.push({
      identifier: sound.Se,
      type: Live2DAssetType.SoundEffect,
      url: context.regionUrl(soundEffectPaths(sound.Se)[0])
    });
  }
};

/**
 * Walks the PROCESSED scenario snippets (call after
 * `processScenarioDataForPlayer`) and resolves every media URL the player
 * will preload, including the UI assets appended by the loader.
 */
export const collectStoryMediaUrls = async (
  options: CollectStoryMediaOptions
): Promise<ILive2DAssetUrl[]> => {
  const {
    scenarioData,
    isCardStory,
    isActionSet,
    regionBucket,
    regionBase,
    regionUrl,
    voiceCharacters,
    onWarning
  } = options;
  const result: ILive2DAssetUrl[] = [];
  const push = (asset: ILive2DAssetUrl): void => {
    if (!result.some((r) => r.url === asset.url && r.type === asset.type)) {
      result.push(asset);
    }
  };

  const voiceBundleName = scenarioIdToAssetbundleName(scenarioData.ScenarioId);

  const voiceUrlFor = (voiceId: string, character2dId: number | undefined): string => {
    const candidates = talkVoicePathCandidates({
      scenarioId: voiceBundleName,
      voiceId,
      isCardStory,
      isActionSet,
      character: character2dId !== undefined ? voiceCharacters.get(character2dId) : undefined
    });
    // The canonical path is what the mirror serves for normal voices;
    // part-voice candidates are only useful at playback time, not preload.
    return regionUrl(candidates[0]);
  };

  const context: MediaCollectContext = {
    push,
    voiceBundleName,
    regionUrl,
    regionBase,
    regionBucket,
    onWarning
  };

  for (const snippet of scenarioData.Snippets) {
    switch (snippet.Action) {
      case SnippetAction.Talk:
        collectTalkVoices(scenarioData.TalkData[snippet.ReferenceIndex], voiceUrlFor, context);
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
  return result;
};
