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
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) =>
      m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    );
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

  const voiceUrlFor = (
    voiceId: string,
    character2dId: number | undefined
  ): string => {
    const candidates = talkVoicePathCandidates({
      scenarioId: voiceBundleName,
      voiceId,
      isCardStory,
      isActionSet,
      character:
        character2dId !== undefined
          ? voiceCharacters.get(character2dId)
          : undefined
    });
    // The canonical path is what the mirror serves for normal voices;
    // part-voice candidates are only useful at playback time, not preload.
    return regionUrl(candidates[0]);
  };

  for (const snippet of scenarioData.Snippets) {
    switch (snippet.Action) {
      case SnippetAction.Talk: {
        const talk = scenarioData.TalkData[snippet.ReferenceIndex];
        if (!talk) break;
        for (const v of talk.Voices) {
          push({
            identifier: v.VoiceId,
            type: Live2DAssetType.Talk,
            url: voiceUrlFor(v.VoiceId, talk.TalkCharacters[0]?.Character2dId)
          });
        }
        break;
      }
      case SnippetAction.SpecialEffect: {
        const effect = scenarioData.SpecialEffectData[snippet.ReferenceIndex];
        if (!effect) break;
        switch (effect.EffectType) {
          case SpecialEffectType.ChangeBackground:
            push({
              identifier: effect.StringValSub,
              type: Live2DAssetType.BackgroundImage,
              url: regionUrl(backgroundImagePath(effect.StringValSub))
            });
            break;
          case SpecialEffectType.FullScreenText: {
            const url = regionUrl(
              scenarioVoicePath(voiceBundleName, effect.StringValSub)
            );
            push({ identifier: effect.StringValSub, type: Live2DAssetType.Talk, url });
            break;
          }
          case SpecialEffectType.Movie: {
            const dirPath = movieDirPath(effect.StringVal);
            const found = await searchVideoFile(regionBase, regionBucket, dirPath);
            const path = found ?? movieFallbackPath(effect.StringVal);
            if (!found) {
              onWarning?.(
                `Movie file not listed for ${effect.StringVal}; using default file name.`
              );
            }
            push({
              identifier: effect.StringVal,
              type: Live2DAssetType.Video,
              url: regionUrl(path)
            });
            break;
          }
          default:
            break;
        }
        break;
      }
      case SnippetAction.Sound: {
        const sound = scenarioData.SoundData[snippet.ReferenceIndex];
        if (!sound) break;
        if (sound.Bgm) {
          push({
            identifier: sound.Bgm,
            type: Live2DAssetType.BackgroundMusic,
            url: regionUrl(bgmPath(sound.Bgm))
          });
        } else if (sound.Se) {
          push({
            identifier: sound.Se,
            type: Live2DAssetType.SoundEffect,
            url: regionUrl(soundEffectPaths(sound.Se)[0])
          });
        }
        break;
      }
      default:
        break;
    }
  }
  return result;
};
