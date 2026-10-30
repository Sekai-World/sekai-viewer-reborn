/**
 * Small synthetic master-data rows and scenario documents for the StoryReader
 * browser tests. Nothing here is copied game data: every id, name and line of
 * dialogue is made up so the fixtures stay stable and safe to commit.
 */

export const storyCases = [
  {
    storyType: "unit",
    storyId: "testunit-1-1",
    scenarioPath: "scenario/unitstory/testunit_chapter/testunit_01_01.asset",
    line: "Unit story line for the browser test."
  },
  {
    storyType: "event",
    storyId: "1-1",
    scenarioPath: "event_story/test_event/scenario/test_event_01.asset",
    line: "Event story line for the browser test."
  },
  {
    storyType: "character",
    storyId: "1",
    scenarioPath: "scenario/profile/test_profile_01.asset",
    line: "Character story line for the browser test."
  },
  {
    storyType: "card",
    storyId: "1",
    scenarioPath: "character/member/test_card_bundle/test_card_01.asset",
    line: "Card story line for the browser test."
  },
  {
    storyType: "area-talk",
    storyId: "101",
    scenarioPath: "scenario/actionset/group1/test_area_01.asset",
    line: "Area talk line for the browser test."
  },
  {
    storyType: "special",
    storyId: "1-1",
    scenarioPath: "scenario/special/test_special_ep/test_special_01.asset",
    line: "Special story line for the browser test."
  }
] as const;

export type StoryCase = (typeof storyCases)[number];

/** A valid scenario document with a single spoken line. */
export const buildScenario = (scenarioId: string, line: string): Record<string, unknown> => ({
  ScenarioId: scenarioId,
  AppearCharacters: [{ Character2dId: 1, CostumeType: "test_costume" }],
  FirstLayout: [],
  FirstBgm: "",
  FirstBackground: "",
  FirstCharacterLayoutMode: 0,
  Snippets: [{ Action: 1, ProgressBehavior: 1, ReferenceIndex: 0, Delay: 0 }],
  TalkData: [
    {
      TalkCharacters: [{ Character2dId: 1 }],
      WindowDisplayName: "Test Hero",
      Body: line,
      TalkTention: 0,
      LipSync: 0,
      MotionChangeFrom: 0,
      Motions: [],
      Voices: [],
      Speed: 0,
      FontSize: 0,
      WhenFinishCloseWindow: 0,
      RequirePlayEffect: 0,
      EffectReferenceIdx: 0,
      RequirePlaySound: 0,
      SoundReferenceIdx: 0
    }
  ],
  LayoutData: [],
  SpecialEffectData: [],
  SoundData: [],
  NeedBundleNames: [],
  IncludeSoundDataBundleNames: [],
  ScenarioSnippetCharacterLayoutModes: []
});

/** Master-data list rows keyed by the API collection path segment. */
export const masterRows: Record<string, unknown[]> = {
  unitStories: [
    {
      unit: "testunit",
      seq: 1,
      chapters: [
        {
          id: 1,
          unit: "testunit",
          chapterNo: 1,
          title: "Test Chapter",
          assetbundleName: "testunit_chapter",
          episodes: [
            {
              id: 1,
              chapterNo: 1,
              episodeNo: 1,
              title: "Test Unit Episode",
              assetbundleName: "testunit_ep",
              scenarioId: "testunit_01_01"
            }
          ]
        }
      ]
    }
  ],
  unitProfiles: [{ unit: "testunit", unitName: "Test Unit", seq: 1 }],
  unitStoryEpisodeGroups: [],
  eventStories: [
    {
      id: 1,
      eventId: 1,
      assetbundleName: "test_event",
      eventStoryEpisodes: [
        {
          id: 1,
          eventStoryId: 1,
          episodeNo: 1,
          title: "Test Event Episode",
          assetbundleName: "test_event_ep",
          scenarioId: "test_event_01"
        }
      ]
    }
  ],
  events: [{ id: 1, name: "Test Event", assetbundleName: "test_event" }],
  characterProfiles: [
    { characterId: 1, scenarioId: "test_profile_01" },
    // Resolves from master data, but the asset host has no scenario file for it.
    { characterId: 2, scenarioId: "test_profile_missing" }
  ],
  cardEpisodes: [
    {
      id: 1,
      cardId: 1,
      title: "Test Card Episode",
      scenarioId: "test_card_01",
      assetbundleName: "test_card_bundle"
    }
  ],
  cards: [{ id: 1, prefix: "Test Card", assetbundleName: "test_card_bundle" }],
  actionSets: [
    {
      id: 101,
      areaId: 1,
      scriptId: "test_area_script",
      scenarioId: "test_area_01",
      characterIds: [1]
    }
  ],
  areas: [{ id: 1, name: "Test Area" }],
  specialStories: [
    {
      id: 1,
      title: "Test Special",
      assetbundleName: "test_special",
      episodes: [
        {
          id: 1,
          episodeNo: 1,
          title: "Test Special Episode",
          assetbundleName: "test_special_ep",
          scenarioId: "test_special_01"
        }
      ]
    }
  ],
  character2ds: [
    {
      id: 1,
      characterType: "game_character",
      characterId: 1,
      unit: "testunit",
      assetName: "test_hero"
    }
  ],
  gameCharacters: [{ id: 1, firstName: "Test", givenName: "Hero" }],
  mobCharacters: [],
  subGameCharacters: []
};
