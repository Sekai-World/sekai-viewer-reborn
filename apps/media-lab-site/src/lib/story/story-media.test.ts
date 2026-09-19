import { afterEach, describe, expect, it, vi } from "vitest";
import { collectStoryMediaUrls } from "./story-media";
import { buildVoiceCharacterLookup, type StoryCastNameTables } from "./scenario-rows";
import {
  CharacterLayoutMode,
  SnippetAction,
  SnippetProgressBehavior,
  SoundPlayMode,
  SpecialEffectType,
  type IScenarioData
} from "./scenario-types";
import { Live2DAssetType } from "./player/player-types";

const buildScenario = (overrides: Partial<IScenarioData> = {}): IScenarioData => ({
  ScenarioId: "mmj_01_00",
  AppearCharacters: [],
  FirstLayout: [],
  FirstBgm: "",
  FirstBackground: "",
  FirstCharacterLayoutMode: CharacterLayoutMode.Normal,
  Snippets: [],
  TalkData: [],
  LayoutData: [],
  SpecialEffectData: [],
  SoundData: [],
  NeedBundleNames: [],
  IncludeSoundDataBundleNames: [],
  ScenarioSnippetCharacterLayoutModes: [],
  ...overrides
});

const snippet = (
  action: SnippetAction,
  referenceIndex: number
) => ({ Action: action, ProgressBehavior: SnippetProgressBehavior.WaitUnitilFinished, ReferenceIndex: referenceIndex, Delay: 0 });

const names: StoryCastNameTables = {
  character2ds: [
    { id: 0, characterType: "game_character", characterId: 1, unit: "light_sound", assetName: "cls_01ichika" }
  ],
  gameCharacterNames: new Map([[1, "星乃一歌"]]),
  mobCharacterNames: new Map(),
  subGameCharacterNames: new Map()
};

const voiceCharacters = buildVoiceCharacterLookup(names);

const buildOptions = (
  overrides: Partial<Parameters<typeof collectStoryMediaUrls>[0]> = {}
) => ({
  scenarioData: buildScenario(),
  isCardStory: false,
  isActionSet: false,
  regionBucket: "sekai-jp-assets",
  regionBase: "https://assets.example",
  regionUrl: (path: string) => `https://assets.example/${path}`,
  voiceCharacters,
  ...overrides
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collectStoryMediaUrls", () => {
  it("resolves canonical talk voice URLs", async () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 0)],
      TalkData: [
        {
          TalkCharacters: [{ Character2dId: 0 }],
          WindowDisplayName: "星乃一歌",
          Body: "こんにちは",
          TalkTention: 0,
          LipSync: 1,
          MotionChangeFrom: 0,
          Motions: [],
          Voices: [{ Character2dId: 0, VoiceId: "voice_a_01", Volume: 1 }],
          Speed: 0,
          FontSize: 0,
          WhenFinishCloseWindow: 0,
          RequirePlayEffect: 0,
          EffectReferenceIdx: 0,
          RequirePlaySound: 0,
          SoundReferenceIdx: 0
        }
      ]
    });
    const assets = await collectStoryMediaUrls(buildOptions({ scenarioData: scenario }));
    expect(assets).toEqual([
      {
        identifier: "voice_a_01",
        type: Live2DAssetType.Talk,
        url: "https://assets.example/sound/scenario/voice/mmj_01_00/voice_a_01.mp3"
      }
    ]);
  });

  it("uses card voice packs for card stories", async () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 0)],
      TalkData: [
        {
          TalkCharacters: [{ Character2dId: 0 }],
          WindowDisplayName: "星乃一歌",
          Body: "こんにちは",
          TalkTention: 0,
          LipSync: 1,
          MotionChangeFrom: 0,
          Motions: [],
          Voices: [{ Character2dId: 0, VoiceId: "voice_1", Volume: 1 }],
          Speed: 0,
          FontSize: 0,
          WhenFinishCloseWindow: 0,
          RequirePlayEffect: 0,
          EffectReferenceIdx: 0,
          RequirePlaySound: 0,
          SoundReferenceIdx: 0
        }
      ]
    });
    const assets = await collectStoryMediaUrls(
      buildOptions({ scenarioData: scenario, isCardStory: true })
    );
    expect(assets[0].url).toBe(
      "https://assets.example/sound/card_scenario/voice/mmj_01_00/voice_1.mp3"
    );
  });

  it("dedupes assets by url and type", async () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 0), snippet(SnippetAction.Talk, 1)],
      TalkData: [
        {
          TalkCharacters: [{ Character2dId: 0 }],
          WindowDisplayName: "星乃一歌",
          Body: "こんにちは",
          TalkTention: 0,
          LipSync: 1,
          MotionChangeFrom: 0,
          Motions: [],
          Voices: [{ Character2dId: 0, VoiceId: "voice_a_01", Volume: 1 }],
          Speed: 0,
          FontSize: 0,
          WhenFinishCloseWindow: 0,
          RequirePlayEffect: 0,
          EffectReferenceIdx: 0,
          RequirePlaySound: 0,
          SoundReferenceIdx: 0
        },
        {
          TalkCharacters: [{ Character2dId: 0 }],
          WindowDisplayName: "星乃一歌",
          Body: "こんばんは",
          TalkTention: 0,
          LipSync: 1,
          MotionChangeFrom: 0,
          Motions: [],
          Voices: [{ Character2dId: 0, VoiceId: "voice_a_01", Volume: 1 }],
          Speed: 0,
          FontSize: 0,
          WhenFinishCloseWindow: 0,
          RequirePlayEffect: 0,
          EffectReferenceIdx: 0,
          RequirePlaySound: 0,
          SoundReferenceIdx: 0
        }
      ]
    });
    const assets = await collectStoryMediaUrls(buildOptions({ scenarioData: scenario }));
    expect(assets).toHaveLength(1);
  });

  it("collects background and fullscreen-text voice media from special effects", async () => {
    const scenario = buildScenario({
      Snippets: [
        snippet(SnippetAction.SpecialEffect, 0),
        snippet(SnippetAction.SpecialEffect, 1),
        snippet(SnippetAction.SpecialEffect, 2)
      ],
      SpecialEffectData: [
        {
          EffectType: SpecialEffectType.ChangeBackground,
          StringVal: "bg_b000603",
          StringValSub: "bg_b000603_still",
          Duration: 1,
          IntVal: 0
        },
        {
          EffectType: SpecialEffectType.FullScreenText,
          StringVal: "字幕本文",
          StringValSub: "voice_fst_01",
          Duration: 3,
          IntVal: 0
        },
        { EffectType: SpecialEffectType.BlackIn, StringVal: "", StringValSub: "", Duration: 1, IntVal: 0 }
      ]
    });
    const assets = await collectStoryMediaUrls(buildOptions({ scenarioData: scenario }));
    expect(assets).toEqual([
      {
        identifier: "bg_b000603_still",
        type: Live2DAssetType.BackgroundImage,
        url: "https://assets.example/scenario/background/bg_b000603_still/bg_b000603_still.webp"
      },
      {
        identifier: "voice_fst_01",
        type: Live2DAssetType.Talk,
        url: "https://assets.example/sound/scenario/voice/mmj_01_00/voice_fst_01.mp3"
      }
    ]);
  });

  it("lists the movie directory via S3 and uses the found file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "<Key>scenario/movie/movie_01/movie_01_alt.webm</Key>"
      }))
    );
    const onWarning = vi.fn();
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.SpecialEffect, 0)],
      SpecialEffectData: [
        { EffectType: SpecialEffectType.Movie, StringVal: "movie_01", StringValSub: "", Duration: 0, IntVal: 0 }
      ]
    });
    const assets = await collectStoryMediaUrls(
      buildOptions({ scenarioData: scenario, onWarning })
    );
    expect(assets).toEqual([
      {
        identifier: "movie_01",
        type: Live2DAssetType.Video,
        url: "https://assets.example/scenario/movie/movie_01/movie_01_alt.webm"
      }
    ]);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it("falls back to the default movie file name when the listing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, text: async () => "" }))
    );
    const onWarning = vi.fn();
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.SpecialEffect, 0)],
      SpecialEffectData: [
        { EffectType: SpecialEffectType.Movie, StringVal: "movie_01", StringValSub: "", Duration: 0, IntVal: 0 }
      ]
    });
    const assets = await collectStoryMediaUrls(
      buildOptions({ scenarioData: scenario, onWarning })
    );
    expect(assets[0].url).toBe(
      "https://assets.example/scenario/movie/movie_01/movie_01.mp4"
    );
    expect(onWarning).toHaveBeenCalledWith(
      "Movie file not listed for movie_01; using default file name."
    );
  });

  it("collects bgm and se assets from sound snippets", async () => {
    const scenario = buildScenario({
      Snippets: [
        snippet(SnippetAction.Sound, 0),
        snippet(SnippetAction.Sound, 1),
        snippet(SnippetAction.Sound, 2)
      ],
      SoundData: [
        { PlayMode: SoundPlayMode.CrossFade, Bgm: "bgm00001", Se: "", Volume: 1, SeBundleName: "", Duration: 2 },
        { PlayMode: SoundPlayMode.LoopSe, Bgm: "", Se: "se00001", Volume: 1, SeBundleName: "", Duration: 0 },
        { PlayMode: SoundPlayMode.StopSe, Bgm: "", Se: "", Volume: 1, SeBundleName: "", Duration: 0 }
      ]
    });
    const assets = await collectStoryMediaUrls(buildOptions({ scenarioData: scenario }));
    expect(assets).toEqual([
      {
        identifier: "bgm00001",
        type: Live2DAssetType.BackgroundMusic,
        url: "https://assets.example/sound/scenario/bgm/bgm00001/bgm00001.mp3"
      },
      {
        identifier: "se00001",
        type: Live2DAssetType.SoundEffect,
        url: "https://assets.example/sound/scenario/se/se_pack00001/se00001.mp3"
      }
    ]);
  });

  it("skips snippets whose reference index is out of range", async () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 99), snippet(SnippetAction.Sound, 99)]
    });
    const assets = await collectStoryMediaUrls(buildOptions({ scenarioData: scenario }));
    expect(assets).toEqual([]);
  });
});
