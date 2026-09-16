import { describe, expect, it } from "vitest";
import {
  areaTalkScenarioPath,
  backgroundImagePath,
  bgmPath,
  cardStoryScenarioPath,
  createStoryRegionAssetUrls,
  eventStoryScenarioPath,
  movieDirPath,
  movieFallbackPath,
  partVoicePathVariants,
  scenarioIdToAssetbundleName,
  scenarioVoicePath,
  soundEffectPaths,
  specialStoryScenarioPath,
  talkVoicePathCandidates,
  unitStoryScenarioPath
} from "./story-urls";

describe("createStoryRegionAssetUrls", () => {
  it("falls back to the public asset origin", () => {
    const urls = createStoryRegionAssetUrls(() => undefined, "jp");
    expect(urls.region("scenario/a.asset")).toBe(
      "https://storage.sekai.best/sekai-jp-assets/scenario/a.asset"
    );
    expect(urls.live2d("model/x.model3.json")).toBe(
      "https://storage.sekai.best/sekai-live2d-assets/model/x.model3.json"
    );
  });

  it("uses the configured origin and strips trailing slashes", () => {
    const urls = createStoryRegionAssetUrls(() => "https://cdn.test///", "en");
    expect(urls.region("a/b.mp3")).toBe("https://cdn.test/sekai-en-assets/a/b.mp3");
  });

  it.each([
    ["jp", "sekai-jp-assets"],
    ["en", "sekai-en-assets"],
    ["tw", "sekai-tc-assets"],
    ["kr", "sekai-kr-assets"],
    ["cn", "sekai-cn-assets"]
  ] as const)("picks the region bucket for %s", (region, bucket) => {
    const urls = createStoryRegionAssetUrls(() => "https://cdn.test", region);
    expect(urls.region("x")).toBe(`https://cdn.test/${bucket}/x`);
  });

  it("rejects unsafe paths", () => {
    const urls = createStoryRegionAssetUrls(() => undefined, "jp");
    expect(() => urls.region("../secret")).toThrow(/Unsafe story asset path/);
    expect(() => urls.region("")).toThrow(/Unsafe story asset path/);
    expect(() => urls.region(" model/file.moc3")).toThrow(/Unsafe story asset path/);
    expect(() => urls.region("model/file.moc3 ")).toThrow(/Unsafe story asset path/);
    expect(() => urls.region("model/file\tname.moc3")).toThrow(/Unsafe story asset path/);
  });

  it("percent-encodes interior spaces, which real motion data contains", () => {
    const urls = createStoryRegionAssetUrls(() => undefined, "jp");
    expect(
      urls.live2d(
        "motion/v1/main/02_saki/02saki_motion_base/facial/face_ worry_01.motion3.json"
      )
    ).toBe(
      "https://storage.sekai.best/sekai-live2d-assets/motion/v1/main/02_saki/02saki_motion_base/facial/face_%20worry_01.motion3.json"
    );
  });
});

describe("scenario path builders", () => {
  it("builds unit and event scenario paths", () => {
    expect(unitStoryScenarioPath("idol-story-chapter", "mmj_01_00")).toBe(
      "scenario/unitstory/idol-story-chapter/mmj_01_00.asset"
    );
    expect(eventStoryScenarioPath("event_01", "event_01_1")).toBe(
      "event_story/event_01/scenario/event_01_1.asset"
    );
  });

  it("uses member_scenario only on the en region for card stories", () => {
    expect(cardStoryScenarioPath("01400101", "card_101", "jp")).toBe(
      "character/member/01400101/card_101.asset"
    );
    expect(cardStoryScenarioPath("01400101", "card_101", "en")).toBe(
      "character/member_scenario/01400101/card_101.asset"
    );
  });

  it("groups action sets by floor(id / 100)", () => {
    expect(areaTalkScenarioPath(1838, "areatalk03_266")).toBe(
      "scenario/actionset/group18/areatalk03_266.asset"
    );
    expect(areaTalkScenarioPath(99, "x")).toBe("scenario/actionset/group0/x.asset");
  });

  it("puts special-story openings in the group bundle and other episodes in the episode bundle", () => {
    expect(specialStoryScenarioPath("op_01", "ep_01", "op_01_01")).toBe(
      "scenario/special/op_01/op_01_01.asset"
    );
    expect(specialStoryScenarioPath("op_01", "ep_01", "ep_01_01")).toBe(
      "scenario/special/ep_01/ep_01_01.asset"
    );
  });
});

describe("media path builders", () => {
  it("builds background, bgm, and voice paths", () => {
    expect(backgroundImagePath("bg_b000603")).toBe(
      "scenario/background/bg_b000603/bg_b000603.webp"
    );
    expect(bgmPath("bgm00000")).toBe("sound/scenario/bgm/bgm00000/bgm00000.mp3");
    expect(scenarioVoicePath("mmj_01_00", "voice_a_01")).toBe(
      "sound/scenario/voice/mmj_01_00/voice_a_01.mp3"
    );
  });

  it("builds movie directory and fallback paths", () => {
    expect(movieDirPath("opening_01")).toBe("movie/opening_01/");
    expect(movieDirPath("movie_01")).toBe("scenario/movie/movie_01/");
    expect(movieFallbackPath("opening_01")).toBe("movie/opening_01/opening_01.mp4");
    expect(movieFallbackPath("movie_01")).toBe(
      "scenario/movie/movie_01/movie_01.mp4"
    );
  });
});

describe("partVoicePathVariants", () => {
  it("keeps v2_ characters in the voice-layout pack only", () => {
    expect(partVoicePathVariants("v2_01ichika", "light_sound", "pv_01")).toEqual([
      "sound/scenario/voice/part_voice_v2_01ichika_light_sound/pv_01.mp3"
    ]);
  });

  it("keeps clb characters in the voice-layout pack only", () => {
    expect(partVoicePathVariants("clb_01ichika", undefined, "pv_01")).toEqual([
      "sound/scenario/voice/part_voice_clb_01ichika_/pv_01.mp3"
    ]);
  });

  it("offers both pack layouts for other characters", () => {
    expect(partVoicePathVariants("cls_01ichika", "light_sound", "pv_01")).toEqual([
      "sound/scenario/part_voice/cls_01ichika_light_sound/pv_01.mp3",
      "sound/scenario/voice/part_voice_cls_01ichika_light_sound/pv_01.mp3"
    ]);
  });
});

describe("soundEffectPaths", () => {
  it("uses the base pack for default SEs up to 528", () => {
    expect(soundEffectPaths("se00001")).toEqual([
      "sound/scenario/se/se_pack00001/se00001.mp3"
    ]);
    expect(soundEffectPaths("se00528")).toEqual([
      "sound/scenario/se/se_pack00001/se00528.mp3"
    ]);
  });

  it("uses the b pack for later default SEs", () => {
    expect(soundEffectPaths("se00529")).toEqual([
      "sound/scenario/se/se_pack00001_b/se00529.mp3"
    ]);
    expect(soundEffectPaths("se90001")).toEqual([
      "sound/scenario/se/se_pack00001_b/se90001.mp3"
    ]);
  });

  it("puts event SEs next to the event story", () => {
    expect(soundEffectPaths("se_event_01_bgm")).toEqual([
      "event_story/event_01/scenario_se/se_event_01_bgm.mp3"
    ]);
  });
});

describe("scenarioIdToAssetbundleName", () => {
  it("shifts event ids in the 167..176 window by one", () => {
    expect(scenarioIdToAssetbundleName("story_event_167_1")).toBe(
      "story_event_168_1"
    );
    expect(scenarioIdToAssetbundleName("story_event_176_1")).toBe(
      "story_event_177_1"
    );
    expect(scenarioIdToAssetbundleName("story_event_166_1")).toBe(
      "story_event_166_1"
    );
    expect(scenarioIdToAssetbundleName("story_event_177_1")).toBe(
      "story_event_177_1"
    );
  });

  it("applies the known broken-id fixes verbatim", () => {
    expect(scenarioIdToAssetbundleName("areatalk03_266(20230607修正)")).toBe(
      "areatalk03_266"
    );
    expect(scenarioIdToAssetbundleName("★4冬弥・泉_前半")).toBe("012043_touya01");
    expect(scenarioIdToAssetbundleName("connect_live_01_band")).toBe(
      "connect_live_01_lon_01"
    );
  });

  it("leaves ordinary ids untouched", () => {
    expect(scenarioIdToAssetbundleName("mmj_01_00")).toBe("mmj_01_00");
  });
});

describe("talkVoicePathCandidates", () => {
  it("builds the canonical scenario voice path", () => {
    expect(
      talkVoicePathCandidates({
        scenarioId: "mmj_01_00",
        voiceId: "voice_op_idol0_05a_158",
        isCardStory: false,
        isActionSet: false
      })
    ).toEqual(["sound/scenario/voice/mmj_01_00/voice_op_idol0_05a_158.mp3"]);
  });

  it("routes card stories to the card pack", () => {
    expect(
      talkVoicePathCandidates({
        scenarioId: "card_101",
        voiceId: "voice_1",
        isCardStory: true,
        isActionSet: false
      })
    ).toEqual(["sound/card_scenario/voice/card_101/voice_1.mp3"]);
  });

  it("routes action sets to the actionset pack without part-voice fallback", () => {
    expect(
      talkVoicePathCandidates({
        scenarioId: "areatalk03_266",
        voiceId: "partvoice_01",
        isCardStory: false,
        isActionSet: true,
        character: { assetName: "v2_01ichika", unit: "light_sound" }
      })
    ).toEqual(["sound/actionset/voice/areatalk03_266/partvoice_01.mp3"]);
  });

  it("appends part-voice fallbacks for partvoice ids with a known character", () => {
    expect(
      talkVoicePathCandidates({
        scenarioId: "mmj_01_00",
        voiceId: "partvoice_01",
        isCardStory: false,
        isActionSet: false,
        character: { assetName: "cls_01ichika", unit: "light_sound" }
      })
    ).toEqual([
      "sound/scenario/voice/mmj_01_00/partvoice_01.mp3",
      "sound/scenario/part_voice/cls_01ichika_light_sound/partvoice_01.mp3",
      "sound/scenario/voice/part_voice_cls_01ichika_light_sound/partvoice_01.mp3"
    ]);
  });

  it("applies the scenario-id mapping exactly once", () => {
    expect(
      talkVoicePathCandidates({
        scenarioId: "story_event_167_1",
        voiceId: "voice_1",
        isCardStory: false,
        isActionSet: false
      })
    ).toEqual(["sound/scenario/voice/story_event_168_1/voice_1.mp3"]);
  });
});
