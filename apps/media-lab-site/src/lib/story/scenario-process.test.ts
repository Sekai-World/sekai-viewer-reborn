import { describe, expect, it } from "vitest";
import {
  parseScenarioData,
  processScenarioDataForPlayer
} from "./scenario-process";
import {
  CharacterLayoutDepthType,
  CharacterLayoutMode,
  CharacterLayoutMoveSpeedType,
  CharacterLayoutPosition,
  CharacterLayoutType,
  SnippetAction,
  SnippetProgressBehavior,
  SpecialEffectType,
  type IScenarioData,
  type LayoutData
} from "./scenario-types";

const layoutData = (overrides: Partial<LayoutData>): LayoutData => ({
  Type: CharacterLayoutType.Appear,
  SideFrom: CharacterLayoutPosition.Unspecified,
  SideFromOffsetX: 0,
  SideTo: CharacterLayoutPosition.Unspecified,
  SideToOffsetX: 0,
  DepthType: CharacterLayoutDepthType.Top,
  Character2dId: 0,
  CostumeType: "",
  MotionName: "",
  FacialName: "",
  MoveSpeedType: CharacterLayoutMoveSpeedType.Normal,
  ...overrides
});

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
  Snippets: [
    {
      Action: SnippetAction.Talk,
      ProgressBehavior: SnippetProgressBehavior.Now,
      ReferenceIndex: 0,
      Delay: 0
    }
  ],
  TalkData: [],
  LayoutData: [],
  SpecialEffectData: [],
  SoundData: [],
  NeedBundleNames: [],
  IncludeSoundDataBundleNames: [],
  ScenarioSnippetCharacterLayoutModes: [],
  ...overrides
});

describe("parseScenarioData", () => {
  it("accepts a well-formed scenario document", () => {
    const scenario = buildScenario();
    expect(parseScenarioData(scenario)).toBe(scenario);
  });

  it("rejects malformed payloads", () => {
    expect(() => parseScenarioData(null)).toThrow(/malformed/);
    expect(() => parseScenarioData({})).toThrow(/malformed/);
    expect(() => parseScenarioData({ ScenarioId: 1 })).toThrow(/malformed/);
    expect(() =>
      parseScenarioData(buildScenario({ Snippets: undefined as never }))
    ).toThrow(/malformed/);
  });
});

describe("processScenarioDataForPlayer", () => {
  it("does not mutate the input payload", () => {
    const scenario = buildScenario({
      FirstBackground: "bg_b000603",
      FirstBgm: "bgm00000"
    });
    const snapshot = structuredClone(scenario);
    processScenarioDataForPlayer({ storyType: "unit", storyId: "idol-1-1" }, scenario);
    expect(scenario).toEqual(snapshot);
  });

  it("prepends synthetic background, bgm, and layout snippets", () => {
    const scenario = buildScenario({
      FirstBackground: "bg_b000603",
      FirstBgm: "bgm00000",
      FirstLayout: [
        {
          Character2dId: 0,
          CostumeType: "v2_01ichika_school01",
          PositionSide: 1,
          OffsetX: 0,
          MotionName: "motion_01",
          FacialName: "facial_01"
        },
        {
          Character2dId: 1,
          CostumeType: "v2_02saki_school01",
          PositionSide: 2,
          OffsetX: 0,
          MotionName: "",
          FacialName: ""
        }
      ]
    });

    const processed = processScenarioDataForPlayer(
      { storyType: "unit", storyId: "idol-1-1" },
      scenario
    );

    // Each synthetic snippet is unshifted, so the last added wins the front.
    expect(processed.Snippets.map((s) => s.Action)).toEqual([
      SnippetAction.CharacterLayout,
      SnippetAction.CharacterLayout,
      SnippetAction.Sound,
      SnippetAction.SpecialEffect,
      SnippetAction.Talk
    ]);
    for (const synthetic of processed.Snippets.slice(0, 4)) {
      expect(synthetic.ProgressBehavior).toBe(SnippetProgressBehavior.Now);
      expect(synthetic.Delay).toBe(0);
    }

    // ReferenceIndex points at the appended data entries.
    const layoutSnippet = processed.Snippets[1];
    const layoutData = processed.LayoutData[layoutSnippet.ReferenceIndex];
    expect(layoutData).toMatchObject({
      Type: CharacterLayoutType.Appear,
      Character2dId: 0,
      CostumeType: "v2_01ichika_school01",
      MotionName: "motion_01",
      FacialName: "facial_01"
    });

    const bgmSnippet = processed.Snippets[2];
    expect(processed.SoundData[bgmSnippet.ReferenceIndex]).toMatchObject({
      Bgm: "bgm00000",
      PlayMode: 0,
      Duration: 2.5
    });

    const backgroundSnippet = processed.Snippets[3];
    expect(processed.SpecialEffectData[backgroundSnippet.ReferenceIndex]).toMatchObject({
      EffectType: SpecialEffectType.ChangeBackground,
      StringVal: "bg_b000603"
    });
  });

  it("leaves scenarios without First* fields untouched", () => {
    const scenario = buildScenario();
    const processed = processScenarioDataForPlayer(
      { storyType: "unit", storyId: "idol-1-1" },
      scenario
    );
    expect(processed.Snippets).toHaveLength(scenario.Snippets.length);
    expect(processed.SpecialEffectData).toHaveLength(0);
  });

  it("applies the per-story costume fixes and dedupes appear characters", () => {
    const scenario = buildScenario({
      AppearCharacters: [
        { Character2dId: 0, CostumeType: "v2_v2_23len_idol" },
        { Character2dId: 1, CostumeType: "v2_23len_idol" }
      ],
      LayoutData: [
        layoutData({
          Character2dId: 0,
          CostumeType: "v2_v2_23len_idol"
        })
      ]
    });

    const processed = processScenarioDataForPlayer(
      { storyType: "area-talk", storyId: "1838" },
      scenario
    );

    expect(
      processed.AppearCharacters.map((c) => c.CostumeType)
    ).toEqual(["v2_23len_idol"]);
    expect(processed.LayoutData[0].CostumeType).toBe("v2_23len_idol");
  });

  it("does not apply costume fixes of other stories", () => {
    const scenario = buildScenario({
      AppearCharacters: [{ Character2dId: 0, CostumeType: "v2_v2_23len_idol" }]
    });
    const processed = processScenarioDataForPlayer(
      { storyType: "area-talk", storyId: "1839" },
      scenario
    );
    expect(processed.AppearCharacters[0].CostumeType).toBe("v2_v2_23len_idol");
  });
});
