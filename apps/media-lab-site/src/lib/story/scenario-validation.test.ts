import { describe, expect, it } from "vitest";
import { parseScenarioData } from "./scenario-validation";
import { SnippetAction, SnippetProgressBehavior, SpecialEffectType } from "./scenario-types";

const makeSnippet = (Action: number, ReferenceIndex = 0) => ({
  Action,
  ProgressBehavior: SnippetProgressBehavior.Now,
  ReferenceIndex,
  Delay: 0
});

const validFirstLayout = {
  Character2dId: 1,
  CostumeType: "01ichika_normal",
  MotionName: "idle",
  FacialName: "normal",
  OffsetX: 0,
  PositionSide: 4
};

const validLayout = {
  Character2dId: 1,
  CostumeType: "01ichika_normal",
  MotionName: "idle",
  FacialName: "normal"
};

const validTalk = {
  TalkCharacters: [{ Character2dId: 1 }],
  Motions: [{ Character2dId: 1, MotionName: "idle", FacialName: "normal", TimingSyncValue: 0 }],
  Voices: [{ Character2dId: 1, VoiceId: "voice_01", Volume: 1 }]
};

const createValidScenario = () => ({
  ScenarioId: "unit_01_01",
  AppearCharacters: [{ Character2dId: 1, CostumeType: "01ichika_normal" }],
  FirstLayout: [validFirstLayout],
  FirstBgm: "",
  FirstBackground: "",
  FirstCharacterLayoutMode: 0,
  Snippets: [
    makeSnippet(SnippetAction.Talk),
    makeSnippet(SnippetAction.CharacterLayout),
    makeSnippet(SnippetAction.CharacterMotion),
    makeSnippet(SnippetAction.SpecialEffect),
    makeSnippet(SnippetAction.Sound),
    makeSnippet(SnippetAction.CharacterLayoutMode),
    makeSnippet(SnippetAction.None),
    makeSnippet(SnippetAction.InputName),
    makeSnippet(SnippetAction.Selectable),
    makeSnippet(99, 99)
  ],
  TalkData: [validTalk],
  LayoutData: [validLayout],
  SpecialEffectData: [
    {
      EffectType: SpecialEffectType.None,
      StringVal: "",
      StringValSub: ""
    }
  ],
  SoundData: [{ Bgm: "", Se: "" }],
  NeedBundleNames: [],
  IncludeSoundDataBundleNames: [],
  ScenarioSnippetCharacterLayoutModes: [{ CharacterLayoutMode: 0 }]
});

describe("parseScenarioData", () => {
  it("accepts each supported snippet reference and preserves unknown future actions", () => {
    const scenario = createValidScenario();

    expect(parseScenarioData(scenario)).toBe(scenario);
  });

  it.each([
    ["null root", null, "root"],
    ["array root", [], "root"],
    ["empty scenario id", { ...createValidScenario(), ScenarioId: "" }, "ScenarioId"],
    ["non-string scenario id", { ...createValidScenario(), ScenarioId: 1 }, "ScenarioId"],
    [
      "invalid initial media or layout values",
      { ...createValidScenario(), FirstBackground: 1 },
      "initial layout or media fields"
    ],
    [
      "non-finite initial layout mode",
      { ...createValidScenario(), FirstCharacterLayoutMode: Number.NaN },
      "initial layout or media fields"
    ],
    [
      "missing top-level array",
      { ...createValidScenario(), NeedBundleNames: null },
      "top-level arrays"
    ]
  ])("rejects %s", (_label, input, expectedField) => {
    expect(() => parseScenarioData(input)).toThrow(
      `Scenario document is malformed: ${expectedField}`
    );
  });

  it.each([
    ["non-record character", "AppearCharacters", null],
    ["character id", "AppearCharacters", { Character2dId: "1", CostumeType: "01ichika_normal" }],
    ["character costume", "AppearCharacters", { Character2dId: 1, CostumeType: 1 }],
    ["first-layout character id", "FirstLayout", { ...validFirstLayout, Character2dId: Infinity }],
    ["first-layout costume", "FirstLayout", { ...validFirstLayout, CostumeType: 1 }],
    ["first-layout motion", "FirstLayout", { ...validFirstLayout, MotionName: 1 }],
    ["first-layout facial", "FirstLayout", { ...validFirstLayout, FacialName: 1 }],
    ["first-layout offset", "FirstLayout", { ...validFirstLayout, OffsetX: Infinity }],
    ["first-layout position", "FirstLayout", { ...validFirstLayout, PositionSide: "4" }],
    ["layout character id", "LayoutData", { ...validLayout, Character2dId: NaN }],
    ["layout costume", "LayoutData", { ...validLayout, CostumeType: 1 }],
    ["layout motion", "LayoutData", { ...validLayout, MotionName: 1 }],
    ["layout facial", "LayoutData", { ...validLayout, FacialName: 1 }],
    ["talk character id", "TalkData", { ...validTalk, TalkCharacters: [{ Character2dId: "1" }] }],
    [
      "motion character id",
      "TalkData",
      { ...validTalk, Motions: [{ ...validTalk.Motions[0], Character2dId: "1" }] }
    ],
    [
      "motion name",
      "TalkData",
      { ...validTalk, Motions: [{ ...validTalk.Motions[0], MotionName: 1 }] }
    ],
    [
      "motion facial",
      "TalkData",
      { ...validTalk, Motions: [{ ...validTalk.Motions[0], FacialName: 1 }] }
    ],
    [
      "motion timing",
      "TalkData",
      { ...validTalk, Motions: [{ ...validTalk.Motions[0], TimingSyncValue: Infinity }] }
    ],
    ["voice id", "TalkData", { ...validTalk, Voices: [{ VoiceId: 1 }] }],
    ["snippet action", "Snippets", makeSnippet(1.5)],
    [
      "snippet progress behavior",
      "Snippets",
      { ...makeSnippet(SnippetAction.Talk), ProgressBehavior: 0.5 }
    ],
    [
      "snippet reference index",
      "Snippets",
      { ...makeSnippet(SnippetAction.Talk), ReferenceIndex: 0.5 }
    ],
    ["snippet delay", "Snippets", { ...makeSnippet(SnippetAction.Talk), Delay: Infinity }],
    ["effect type", "SpecialEffectData", { EffectType: Infinity, StringVal: "", StringValSub: "" }],
    ["effect string value", "SpecialEffectData", { EffectType: 0, StringVal: 1, StringValSub: "" }],
    [
      "effect secondary string",
      "SpecialEffectData",
      { EffectType: 0, StringVal: "", StringValSub: 1 }
    ],
    ["sound BGM", "SoundData", { Bgm: 1, Se: "" }],
    ["sound effect", "SoundData", { Bgm: "", Se: 1 }],
    ["snippet layout mode", "ScenarioSnippetCharacterLayoutModes", { CharacterLayoutMode: "0" }]
  ])("rejects malformed %s rows", (_label, field, row) => {
    const input = { ...createValidScenario(), [field]: [row] };

    expect(() => parseScenarioData(input)).toThrow(`Scenario document is malformed: ${field}`);
  });

  it.each([
    ["negative talk reference", SnippetAction.Talk, -1],
    ["past-end layout reference", SnippetAction.CharacterLayout, 1],
    ["past-end motion reference", SnippetAction.CharacterMotion, 1],
    ["past-end effect reference", SnippetAction.SpecialEffect, 1],
    ["past-end sound reference", SnippetAction.Sound, 1],
    ["past-end layout-mode reference", SnippetAction.CharacterLayoutMode, 1]
  ])("rejects a %s", (_label, action, ReferenceIndex) => {
    const input = {
      ...createValidScenario(),
      Snippets: [makeSnippet(action, ReferenceIndex)]
    };

    expect(() => parseScenarioData(input)).toThrow(
      "Scenario document is malformed: Snippets[0].ReferenceIndex"
    );
  });
});
