import { describe, expect, it } from "vitest";
import { gatherStoryMotion } from "./motions";
import {
  CharacterLayoutDepthType,
  CharacterLayoutMode,
  CharacterLayoutMoveSpeedType,
  CharacterLayoutPosition,
  CharacterLayoutType,
  SnippetAction,
  SnippetProgressBehavior,
  type IScenarioData,
  type LayoutData,
  type TalkData
} from "../scenario-types";

const snippet = (action: SnippetAction, referenceIndex: number) => ({
  Action: action,
  ProgressBehavior: SnippetProgressBehavior.Now,
  ReferenceIndex: referenceIndex,
  Delay: 0
});

const layoutData = (overrides: Partial<LayoutData> = {}): LayoutData => ({
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

const talkData = (motions: TalkData["Motions"]): TalkData => ({
  TalkCharacters: [],
  WindowDisplayName: "",
  Body: "",
  TalkTention: 0,
  LipSync: 0,
  MotionChangeFrom: 0,
  Motions: motions,
  Voices: [],
  Speed: 0,
  FontSize: 0,
  WhenFinishCloseWindow: 0,
  RequirePlayEffect: 0,
  EffectReferenceIdx: 0,
  RequirePlaySound: 0,
  SoundReferenceIdx: 0
});

const buildScenario = (overrides: Partial<IScenarioData> = {}): IScenarioData => ({
  ScenarioId: "test",
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

describe("gatherStoryMotion", () => {
  it("collects layout motions when the costume is on the layout", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.CharacterLayout, 0)],
      LayoutData: [
        layoutData({
          CostumeType: "v2_01ichika_school01",
          MotionName: "motion_01",
          FacialName: "facial_01"
        })
      ]
    });
    expect(gatherStoryMotion(scenario)).toEqual([
      { costume: "v2_01ichika_school01", motion: "motion_01", type: "motion" },
      { costume: "v2_01ichika_school01", motion: "facial_01", type: "expression" }
    ]);
  });

  it("falls back to appear characters when the layout costume is empty", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.CharacterMotion, 0)],
      AppearCharacters: [
        { Character2dId: 3, CostumeType: "v2_02saki_school01" },
        { Character2dId: 4, CostumeType: "v2_03honami_school01" }
      ],
      LayoutData: [
        layoutData({ Character2dId: 3, MotionName: "motion_02", FacialName: "" })
      ]
    });
    expect(gatherStoryMotion(scenario)).toEqual([
      { costume: "v2_02saki_school01", motion: "motion_02", type: "motion" }
    ]);
  });

  it("collects talk motions per appear character and trims spaces", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.Talk, 0)],
      AppearCharacters: [
        { Character2dId: 0, CostumeType: "v2_01ichika_school01" },
        { Character2dId: 1, CostumeType: "v2_02saki_school01" }
      ],
      TalkData: [
        talkData([
          {
            Character2dId: 0,
            MotionName: "talk_a 01",
            FacialName: "talk_face 01",
            TimingSyncValue: 0
          },
          {
            Character2dId: 1,
            MotionName: "",
            FacialName: "talk_face 02",
            TimingSyncValue: 0
          }
        ])
      ]
    });
    expect(gatherStoryMotion(scenario)).toEqual([
      { costume: "v2_01ichika_school01", motion: "talk_a01", type: "motion" },
      { costume: "v2_01ichika_school01", motion: "talk_face01", type: "expression" },
      { costume: "v2_02saki_school01", motion: "talk_face02", type: "expression" }
    ]);
  });

  it("ignores empty layout motion and facial names with a costume set", () => {
    const scenario = buildScenario({
      Snippets: [snippet(SnippetAction.CharacterLayout, 0)],
      LayoutData: [layoutData({ CostumeType: "v2_01ichika_school01" })]
    });
    expect(gatherStoryMotion(scenario)).toEqual([]);
  });
});
