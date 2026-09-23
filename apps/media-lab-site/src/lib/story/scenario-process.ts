import {
  CharacterLayoutDepthType,
  CharacterLayoutMoveSpeedType,
  CharacterLayoutType,
  SnippetAction,
  SnippetProgressBehavior,
  SoundPlayMode,
  SpecialEffectType,
  type IScenarioData,
  type LayoutData,
  type Snippet,
  type SoundData,
  type SpecialEffectData
} from "./scenario-types";

/**
 * Pure scenario preprocessing for playback. Ports the legacy viewer's
 * `getProcessedScenarioDataForLive2D`: the synthetic initial background, BGM,
 * and character layouts are prepended as regular snippets so the player only
 * ever walks one flat `Snippets` array. Input is cloned; callers keep
 * ownership of the raw payload (shared with the text reader).
 */

export interface StoryIdentityLike {
  storyType: string;
  storyId: string;
}

/**
 * Fixes known broken `CostumeType` values per story. Keyed by the reborn
 * story identity (`${storyType}:${storyId}`); the map carries the legacy
 * viewer's per-story patches verbatim.
 */
const MODEL_NAME_FIX_MAP: {
  story: string;
  map: { from: string; to: string }[];
}[] = [
  {
    // these black models are lost; fall back to the non-black costume
    story: "card:2121",
    map: [
      { from: "v2_14emu_casual_black", to: "v2_14emu_casual" },
      { from: "v2_15nene_casual_black", to: "v2_15nene_casual" },
      { from: "v2_01ichika_casual_black", to: "v2_01ichika_casual" },
      { from: "v2_03honami_casual_black", to: "v2_03honami_casual" }
    ]
  },
  {
    story: "event:74-5",
    map: [{ from: "\\", to: "13tsukasa_unit" }]
  },
  {
    story: "card:2071",
    map: [{ from: "b", to: "v2_06haruka_lesson" }]
  },
  {
    story: "card:2012",
    map: [
      { from: "3", to: "v2_25meiko_normal" },
      { from: "1", to: "v2_25meiko_normal" }
    ]
  },
  {
    story: "area-talk:1838",
    map: [{ from: "v2_v2_23len_idol", to: "v2_23len_idol" }]
  },
  {
    story: "area-talk:1839",
    map: [{ from: "v2_v2_25meiko_idol", to: "v2_25meiko_idol" }]
  },
  {
    story: "area-talk:1979",
    map: [{ from: "w-happy-nod05", to: "v2_01ichika_school01" }]
  }
];

const applyModelNameFix = (identity: StoryIdentityLike, data: IScenarioData): void => {
  const fix = MODEL_NAME_FIX_MAP.find(
    (m) => m.story === `${identity.storyType}:${identity.storyId}`
  );
  if (!fix) return;
  fix.map.forEach((m) => {
    data.AppearCharacters.filter((c) => c.CostumeType === m.from).forEach(
      (c) => (c.CostumeType = m.to)
    );
    data.LayoutData.filter((l) => l.CostumeType === m.from).forEach((l) => (l.CostumeType = m.to));
    data.FirstLayout.filter((l) => l.CostumeType === m.from).forEach((l) => (l.CostumeType = m.to));
    // remove duplicate
    const uniqueCharacters = [...new Set(data.AppearCharacters.map((c) => c.CostumeType))];
    data.AppearCharacters = uniqueCharacters.map((c) =>
      data.AppearCharacters.find((ap) => ap.CostumeType === c)!
    );
  });
};

/**
 * Returns a playback-ready copy of the scenario with synthetic initial
 * background/BGM/layout snippets prepended. The input payload is not
 * mutated.
 */
export const processScenarioDataForPlayer = (
  identity: StoryIdentityLike,
  data: IScenarioData
): IScenarioData => {
  const cloned: IScenarioData = structuredClone(data);
  applyModelNameFix(identity, cloned);

  const {
    Snippets,
    SpecialEffectData,
    SoundData,
    FirstBgm,
    FirstBackground,
    FirstLayout,
    LayoutData
  } = cloned;

  if (FirstBackground) {
    const bgSnippet: Snippet = {
      Action: SnippetAction.SpecialEffect,
      ProgressBehavior: SnippetProgressBehavior.Now,
      ReferenceIndex: SpecialEffectData.length,
      Delay: 0
    };
    const spData: SpecialEffectData = {
      EffectType: SpecialEffectType.ChangeBackground,
      StringVal: FirstBackground,
      StringValSub: FirstBackground,
      Duration: 0,
      IntVal: 0
    };
    Snippets.unshift(bgSnippet);
    SpecialEffectData.push(spData);
  }
  if (FirstBgm) {
    const bgmSnippet: Snippet = {
      Action: SnippetAction.Sound,
      ProgressBehavior: SnippetProgressBehavior.Now,
      ReferenceIndex: SoundData.length,
      Delay: 0
    };
    const soundData: SoundData = {
      PlayMode: SoundPlayMode.CrossFade,
      Bgm: FirstBgm,
      Se: "",
      Volume: 1,
      SeBundleName: "",
      Duration: 2.5
    };
    Snippets.unshift(bgmSnippet);
    SoundData.push(soundData);
  }
  if (FirstLayout) {
    FirstLayout.forEach((l) => {
      const layoutSnippet: Snippet = {
        Action: SnippetAction.CharacterLayout,
        ProgressBehavior: SnippetProgressBehavior.Now,
        ReferenceIndex: LayoutData.length,
        Delay: 0
      };
      const layoutData: LayoutData = {
        Type: CharacterLayoutType.Appear,
        SideFrom: l.PositionSide,
        SideFromOffsetX: l.OffsetX,
        SideTo: l.PositionSide,
        SideToOffsetX: l.OffsetX,
        DepthType: CharacterLayoutDepthType.Top,
        Character2dId: l.Character2dId,
        CostumeType: l.CostumeType,
        MotionName: l.MotionName,
        FacialName: l.FacialName,
        MoveSpeedType: CharacterLayoutMoveSpeedType.Normal
      };
      Snippets.unshift(layoutSnippet);
      LayoutData.push(layoutData);
    });
  }
  return cloned;
};

/**
 * Basic runtime validation of a fetched scenario document. Keeps malformed
 * payloads from reaching the player with a clear failure instead of a deep
 * undefined access.
 */
export const parseScenarioData = (input: unknown): IScenarioData => {
  if (
    typeof input !== "object" ||
    input === null ||
    !Array.isArray((input as IScenarioData).Snippets) ||
    !Array.isArray((input as IScenarioData).AppearCharacters) ||
    typeof (input as IScenarioData).ScenarioId !== "string"
  ) {
    throw new Error("Scenario document is malformed");
  }
  return input as IScenarioData;
};
