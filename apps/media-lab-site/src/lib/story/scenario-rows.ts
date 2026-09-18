import {
  SnippetAction,
  SoundPlayMode,
  SpecialEffectType,
  type IScenarioData,
  type StoryCharacter2D
} from "./scenario-types";
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

/**
 * Text-reader (台本) flattening. Walks the RAW scenario snippets in order and
 * emits presentation-oriented rows: dialogue with voice candidates, background
 * changes, BGM/SE cues, full-screen text, telops, and movies. Pure; URL
 * resolution happens where the caller has the region context.
 */

export interface StoryCastMember {
  character2dId: number;
  /** Resolved display name; falls back to the costume type. */
  name: string;
  costumeType: string;
}

export interface StoryVoiceCharacter {
  assetName?: string;
  unit?: string;
}

export type StoryTextRow =
  | { kind: "background"; name: string; imagePath: string }
  | { kind: "bgm"; name: string; path: string }
  | {
      kind: "se";
      name: string;
      /** Ordered path candidates; the client tries them in order. */
      paths: string[];
      loop: boolean;
      stop: boolean;
    }
  | {
      kind: "talk";
      name: string;
      body: string;
      /** Game character id (1-26) of the speaker when known, for the local
       * bust thumbnail; undefined for mob/sub characters. */
      characterId?: number;
      /** Ordered voice path candidates; empty when the talk has no voice. */
      voicePaths: string[];
      monologue: boolean;
    }
  | { kind: "fullscreen-text"; text: string; voicePaths: string[] }
  | { kind: "telop"; text: string }
  | { kind: "movie"; name: string; dirPath: string; fallbackPath: string };

export interface StoryTextDocument {
  scenarioId: string;
  cast: StoryCastMember[];
  rows: StoryTextRow[];
}

const resolveCastName = (
  character2d: StoryCharacter2D | undefined,
  names: StoryCastNameTables
): string => {
  if (!character2d) return "";
  switch (character2d.characterType) {
    case "game_character":
      return names.gameCharacterNames.get(character2d.characterId) ?? "";
    case "mob":
      return names.mobCharacterNames.get(character2d.characterId) ?? "";
    case "sub_game_character":
      return names.subGameCharacterNames.get(character2d.characterId) ?? "";
    default:
      return "";
  }
};

export interface StoryCastNameTables {
  character2ds: StoryCharacter2D[];
  gameCharacterNames: Map<number, string>;
  mobCharacterNames: Map<number, string>;
  subGameCharacterNames: Map<number, string>;
}

/** Cast lookup by character2dId for part-voice fallbacks. */
export const buildVoiceCharacterLookup = (
  tables: StoryCastNameTables
): Map<number, StoryVoiceCharacter> => {
  const lookup = new Map<number, StoryVoiceCharacter>();
  for (const character2d of tables.character2ds) {
    lookup.set(character2d.id, {
      assetName: character2d.assetName,
      unit: character2d.unit
    });
  }
  return lookup;
};

const gameCharacterIdOfTalk = (
  character2dId: number | undefined,
  names: StoryCastNameTables
): number | undefined => {
  if (character2dId === undefined) return undefined;
  const character2d = names.character2ds.find((ch) => ch.id === character2dId);
  return character2d?.characterType === "game_character"
    ? character2d.characterId
    : undefined;
};

const talkVoiceCandidates = (
  scenarioId: string,
  voiceId: string,
  isCardStory: boolean,
  isActionSet: boolean,
  voiceCharacters: Map<number, StoryVoiceCharacter>,
  character2dId: number | undefined
): string[] =>
  // Pass the raw scenario id: `talkVoicePathCandidates` applies the
  // scenarioId → asset-bundle mapping itself (event-id offset must run once).
  talkVoicePathCandidates({
    scenarioId,
    voiceId,
    isCardStory,
    isActionSet,
    character: character2dId !== undefined
      ? voiceCharacters.get(character2dId)
      : undefined
  });

/**
 * Flattens a raw scenario payload into text-reader rows. `voiceCharacters`
 * provides the character2d → asset identity needed for part-voice fallback
 * paths.
 */
export const flattenScenarioToRows = (
  scenarioData: IScenarioData,
  names: StoryCastNameTables,
  voiceCharacters: Map<number, StoryVoiceCharacter>,
  options: { isCardStory: boolean; isActionSet: boolean }
): StoryTextDocument => {
  const rows: StoryTextRow[] = [];
  const { ScenarioId, AppearCharacters, Snippets, TalkData, SpecialEffectData, SoundData, FirstBgm, FirstBackground } =
    scenarioData;

  const cast: StoryCastMember[] = AppearCharacters.map((ap) => {
    const character2d = names.character2ds.find((ch) => ch.id === ap.Character2dId);
    return {
      character2dId: ap.Character2dId,
      name:
        resolveCastName(character2d, names) ||
        ap.CostumeType,
      costumeType: ap.CostumeType
    };
  });

  if (FirstBackground) {
    rows.push({
      kind: "background",
      name: FirstBackground,
      imagePath: backgroundImagePath(FirstBackground)
    });
  }
  if (FirstBgm) {
    rows.push({ kind: "bgm", name: FirstBgm, path: bgmPath(FirstBgm) });
  }

  for (const snippet of Snippets) {
    switch (snippet.Action) {
      case SnippetAction.Talk: {
        const talk = TalkData[snippet.ReferenceIndex];
        if (!talk) break;
        const voice = talk.Voices[0];
        const talkCharacter2dId = talk.TalkCharacters[0]?.Character2dId;
        rows.push({
          kind: "talk",
          name: talk.WindowDisplayName,
          body: talk.Body,
          characterId: gameCharacterIdOfTalk(talkCharacter2dId, names),
          voicePaths:
            voice && voice.VoiceId
              ? talkVoiceCandidates(
                  ScenarioId,
                  voice.VoiceId,
                  options.isCardStory,
                  options.isActionSet,
                  voiceCharacters,
                  talkCharacter2dId
                )
              : [],
          monologue: talk.LipSync === 2
        });
        break;
      }
      case SnippetAction.SpecialEffect: {
        const effect = SpecialEffectData[snippet.ReferenceIndex];
        if (!effect) break;
        switch (effect.EffectType) {
          case SpecialEffectType.ChangeBackground:
            if (effect.StringValSub) {
              rows.push({
                kind: "background",
                name: effect.StringValSub,
                imagePath: backgroundImagePath(effect.StringValSub)
              });
            }
            break;
          case SpecialEffectType.Telop:
            rows.push({ kind: "telop", text: effect.StringVal });
            break;
          case SpecialEffectType.FullScreenText:
            rows.push({
              kind: "fullscreen-text",
              text: effect.StringVal,
              voicePaths: effect.StringValSub
                ? [
                    scenarioVoicePath(
                      scenarioIdToAssetbundleName(ScenarioId),
                      effect.StringValSub
                    )
                  ]
                : []
            });
            break;
          case SpecialEffectType.Movie:
            rows.push({
              kind: "movie",
              name: effect.StringVal,
              dirPath: movieDirPath(effect.StringVal),
              fallbackPath: movieFallbackPath(effect.StringVal)
            });
            break;
          default:
            // Transitions, shakes, filters, and camera moves are visual-only;
            // a script-style reader omits them.
            break;
        }
        break;
      }
      case SnippetAction.Sound: {
        const sound = SoundData[snippet.ReferenceIndex];
        if (!sound) break;
        if (sound.Bgm) {
          rows.push({ kind: "bgm", name: sound.Bgm, path: bgmPath(sound.Bgm) });
        } else if (sound.Se) {
          rows.push({
            kind: "se",
            name: sound.Se,
            paths: soundEffectPaths(sound.Se),
            loop: sound.PlayMode === SoundPlayMode.LoopSe,
            stop: sound.PlayMode === SoundPlayMode.StopSe
          });
        }
        break;
      }
      default:
        // Character layout/motion and selection snippets are playback-only.
        break;
    }
  }

  return { scenarioId: ScenarioId, cast, rows };
};

/** Re-exported for the player's media collection. */
export { scenarioIdToAssetbundleName };
