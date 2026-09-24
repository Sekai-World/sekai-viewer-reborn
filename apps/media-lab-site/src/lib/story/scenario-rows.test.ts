import { describe, expect, it } from "vitest";
import {
  buildVoiceCharacterLookup,
  flattenScenarioToRows,
  type StoryCastNameTables
} from "./scenario-rows";
import {
  CharacterLayoutMode,
  SnippetAction,
  SnippetProgressBehavior,
  SoundPlayMode,
  SpecialEffectType,
  type IScenarioData,
  type TalkData
} from "./scenario-types";

const buildTalkData = (overrides: Partial<TalkData> = {}): TalkData => ({
  TalkCharacters: [{ Character2dId: 0 }],
  WindowDisplayName: "星乃一歌",
  Body: "こんにちは",
  TalkTention: 0,
  LipSync: 1,
  MotionChangeFrom: 0,
  Motions: [],
  Voices: [],
  Speed: 0,
  FontSize: 0,
  WhenFinishCloseWindow: 0,
  RequirePlayEffect: 0,
  EffectReferenceIdx: 0,
  RequirePlaySound: 0,
  SoundReferenceIdx: 0,
  ...overrides
});

const snippet = (
  action: SnippetAction,
  referenceIndex: number,
  progressBehavior = SnippetProgressBehavior.WaitUnitilFinished
) => ({
  Action: action,
  ProgressBehavior: progressBehavior,
  ReferenceIndex: referenceIndex,
  Delay: 0
});

const names: StoryCastNameTables = {
  character2ds: [
    {
      id: 0,
      characterType: "game_character",
      characterId: 1,
      unit: "light_sound",
      assetName: "cls_01ichika"
    },
    { id: 1, characterType: "mob", characterId: 50, assetName: "cls_mob" }
  ],
  gameCharacterNames: new Map([[1, "星乃一歌"]]),
  mobCharacterNames: new Map([[50, "モブ子"]]),
  subGameCharacterNames: new Map()
};

const voiceCharacters = buildVoiceCharacterLookup(names);

const buildScenario = (overrides: Partial<IScenarioData> = {}): IScenarioData => ({
  ScenarioId: "mmj_01_00",
  AppearCharacters: [
    { Character2dId: 0, CostumeType: "v2_01ichika_school01" },
    { Character2dId: 1, CostumeType: "v2_02saki_school01" }
  ],
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

describe("buildVoiceCharacterLookup", () => {
  it("maps character2d ids to asset identity", () => {
    expect(voiceCharacters.get(0)).toEqual({
      assetName: "cls_01ichika",
      unit: "light_sound"
    });
  });
});

describe("flattenScenarioToRows", () => {
  it("emits First* background and bgm rows first", () => {
    const document_ = flattenScenarioToRows(
      buildScenario({ FirstBackground: "bg_b000603", FirstBgm: "bgm00000" }),
      names,
      voiceCharacters,
      { isCardStory: false, isActionSet: false }
    );
    expect(document_.scenarioId).toBe("mmj_01_00");
    expect(document_.rows.slice(0, 2)).toEqual([
      {
        kind: "background",
        name: "bg_b000603",
        imagePath: "scenario/background/bg_b000603/bg_b000603.webp"
      },
      { kind: "bgm", name: "bgm00000", path: "sound/scenario/bgm/bgm00000/bgm00000.mp3" }
    ]);
  });

  it("builds the cast from appear characters with name fallback", () => {
    const document_ = flattenScenarioToRows(
      buildScenario({
        AppearCharacters: [
          { Character2dId: 0, CostumeType: "v2_01ichika_school01" },
          { Character2dId: 1, CostumeType: "v2_02saki_school01" },
          { Character2dId: 9, CostumeType: "v2_unknown" }
        ]
      }),
      names,
      voiceCharacters,
      { isCardStory: false, isActionSet: false }
    );
    expect(document_.cast).toEqual([
      { character2dId: 0, name: "星乃一歌", costumeType: "v2_01ichika_school01" },
      { character2dId: 1, name: "モブ子", costumeType: "v2_02saki_school01" },
      { character2dId: 9, name: "v2_unknown", costumeType: "v2_unknown" }
    ]);
  });

  it("emits talk rows with canonical voice paths", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 0)],
      TalkData: [
        buildTalkData({
          Voices: [{ Character2dId: 0, VoiceId: "voice_a_01", Volume: 1 }]
        })
      ]
    });
    const document_ = flattenScenarioToRows(scenario, names, voiceCharacters, {
      isCardStory: false,
      isActionSet: false
    });
    expect(document_.rows).toEqual([
      {
        kind: "talk",
        name: "星乃一歌",
        body: "こんにちは",
        characterId: 1,
        voicePaths: ["sound/scenario/voice/mmj_01_00/voice_a_01.mp3"],
        monologue: false
      }
    ]);
  });

  it("resolves the speaker's game character id and leaves mob speakers without one", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 0), snippet(SnippetAction.Talk, 1)],
      TalkData: [
        buildTalkData({ Body: "いちか" }),
        buildTalkData({
          TalkCharacters: [{ Character2dId: 1 }],
          WindowDisplayName: "モブ子",
          Body: "モブ"
        })
      ]
    });
    const document_ = flattenScenarioToRows(scenario, names, voiceCharacters, {
      isCardStory: false,
      isActionSet: false
    });
    expect(document_.rows[0]).toMatchObject({ name: "星乃一歌", characterId: 1 });
    expect(document_.rows[1]).toMatchObject({ name: "モブ子", characterId: undefined });
  });

  it("marks monologues and adds part-voice fallbacks for partvoice ids", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 0), snippet(SnippetAction.Talk, 1)],
      TalkData: [
        buildTalkData({
          LipSync: 2,
          Body: "（心の声）",
          Voices: [{ Character2dId: 0, VoiceId: "partvoice_01", Volume: 1 }]
        }),
        buildTalkData({ Body: "声なし" })
      ]
    });
    const document_ = flattenScenarioToRows(scenario, names, voiceCharacters, {
      isCardStory: false,
      isActionSet: false
    });
    expect(document_.rows[0]).toMatchObject({
      monologue: true,
      voicePaths: [
        "sound/scenario/voice/mmj_01_00/partvoice_01.mp3",
        "sound/scenario/part_voice/cls_01ichika_light_sound/partvoice_01.mp3",
        "sound/scenario/voice/part_voice_cls_01ichika_light_sound/partvoice_01.mp3"
      ]
    });
    expect(document_.rows[1]).toMatchObject({ voicePaths: [] });
  });

  it("uses card and action-set voice packs per story kind", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 0)],
      TalkData: [
        buildTalkData({
          Voices: [{ Character2dId: 0, VoiceId: "voice_1", Volume: 1 }]
        })
      ]
    });
    const card = flattenScenarioToRows(scenario, names, voiceCharacters, {
      isCardStory: true,
      isActionSet: false
    });
    expect(card.rows[0]).toMatchObject({
      voicePaths: ["sound/card_scenario/voice/mmj_01_00/voice_1.mp3"]
    });

    const actionSet = flattenScenarioToRows(
      buildScenario({
        ScenarioId: "areatalk03_266",
        Snippets: [snippet(SnippetAction.Talk, 0)],
        TalkData: [
          buildTalkData({
            Voices: [{ Character2dId: 0, VoiceId: "partvoice_01", Volume: 1 }]
          })
        ]
      }),
      names,
      voiceCharacters,
      { isCardStory: false, isActionSet: true }
    );
    expect(actionSet.rows[0]).toMatchObject({
      voicePaths: ["sound/actionset/voice/areatalk03_266/partvoice_01.mp3"]
    });
  });

  it("emits background, telop, fullscreen-text, and movie special-effect rows", () => {
    const scenario = buildScenario({
      Snippets: [
        snippet(SnippetAction.SpecialEffect, 0),
        snippet(SnippetAction.SpecialEffect, 1),
        snippet(SnippetAction.SpecialEffect, 2),
        snippet(SnippetAction.SpecialEffect, 3),
        snippet(SnippetAction.SpecialEffect, 4)
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
          EffectType: SpecialEffectType.Telop,
          StringVal: "三年後",
          StringValSub: "",
          Duration: 2,
          IntVal: 0
        },
        {
          EffectType: SpecialEffectType.FullScreenText,
          StringVal: "字幕本文",
          StringValSub: "voice_fst_01",
          Duration: 3,
          IntVal: 0
        },
        {
          EffectType: SpecialEffectType.Movie,
          StringVal: "movie_01",
          StringValSub: "",
          Duration: 0,
          IntVal: 0
        },
        {
          EffectType: SpecialEffectType.BlackIn,
          StringVal: "",
          StringValSub: "",
          Duration: 1,
          IntVal: 0
        }
      ]
    });
    const document_ = flattenScenarioToRows(scenario, names, voiceCharacters, {
      isCardStory: false,
      isActionSet: false
    });
    expect(document_.rows).toEqual([
      {
        kind: "background",
        name: "bg_b000603_still",
        imagePath: "scenario/background/bg_b000603_still/bg_b000603_still.webp"
      },
      { kind: "telop", text: "三年後" },
      {
        kind: "fullscreen-text",
        text: "字幕本文",
        voicePaths: ["sound/scenario/voice/mmj_01_00/voice_fst_01.mp3"]
      },
      {
        kind: "movie",
        name: "movie_01",
        dirPath: "scenario/movie/movie_01/",
        fallbackPath: "scenario/movie/movie_01/movie_01.mp4"
      }
    ]);
  });

  it("emits bgm and se rows with loop and stop flags", () => {
    const scenario = buildScenario({
      Snippets: [
        snippet(SnippetAction.Sound, 0),
        snippet(SnippetAction.Sound, 1),
        snippet(SnippetAction.Sound, 2)
      ],
      SoundData: [
        {
          PlayMode: SoundPlayMode.CrossFade,
          Bgm: "bgm00001",
          Se: "",
          Volume: 1,
          SeBundleName: "",
          Duration: 2
        },
        {
          PlayMode: SoundPlayMode.LoopSe,
          Bgm: "",
          Se: "se00001",
          Volume: 1,
          SeBundleName: "",
          Duration: 0
        },
        {
          PlayMode: SoundPlayMode.StopSe,
          Bgm: "",
          Se: "se00002",
          Volume: 1,
          SeBundleName: "",
          Duration: 0
        }
      ]
    });
    const document_ = flattenScenarioToRows(scenario, names, voiceCharacters, {
      isCardStory: false,
      isActionSet: false
    });
    expect(document_.rows).toEqual([
      { kind: "bgm", name: "bgm00001", path: "sound/scenario/bgm/bgm00001/bgm00001.mp3" },
      {
        kind: "se",
        name: "se00001",
        paths: ["sound/scenario/se/se_pack00001/se00001.mp3"],
        loop: true,
        stop: false
      },
      {
        kind: "se",
        name: "se00002",
        paths: ["sound/scenario/se/se_pack00001/se00002.mp3"],
        loop: false,
        stop: true
      }
    ]);
  });

  it("skips snippets whose reference index is out of range", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 99)]
    });
    const document_ = flattenScenarioToRows(scenario, names, voiceCharacters, {
      isCardStory: false,
      isActionSet: false
    });
    expect(document_.rows).toEqual([]);
  });
});
