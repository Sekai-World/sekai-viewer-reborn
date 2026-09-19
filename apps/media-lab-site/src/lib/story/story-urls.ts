import type { StoryRouteRegion } from "$lib/live2d/story-route";

/**
 * Sekai story asset URL rules.
 *
 * Logical object-path patterns ported from the legacy sekai-viewer story
 * reader and cross-verified against the pjsk-apk-reverse bundle-mapping
 * report (2026-09). All builders return bucket-relative paths; combine with
 * `createStoryAssetUrls` to get absolute URLs for a region.
 *
 * Verified against storage.sekai.best on 2026-09-14:
 * - scenario JSON: `scenario/unitstory/idol-story-chapter/mmj_01_00.asset` (200)
 * - background: `scenario/background/bg_b000603/bg_b000603.webp` (200)
 * - voice: `sound/scenario/voice/mmj_01_00/voice_op_idol0_05a_158.mp3` (200)
 * - bgm: `sound/scenario/bgm/bgm00000/bgm00000.mp3` (200)
 */

export type StoryAssetRegion = StoryRouteRegion;

/** Region bucket names on the configured remote asset origin. */
export const storyRegionBuckets: Record<StoryAssetRegion, string> = {
  jp: "sekai-jp-assets",
  en: "sekai-en-assets",
  tw: "sekai-tc-assets",
  kr: "sekai-kr-assets",
  cn: "sekai-cn-assets"
};

export const LIVE2D_BUCKET = "sekai-live2d-assets";

const SAFE_PATH_PATTERN = /^[A-Za-z0-9_\-./()[\] ]+$/;

/**
 * Guards hand-built object paths before they are combined with a base URL,
 * returning the URL-ready path. Interior spaces are legal: real game data
 * carries motion files with spaces in their names (e.g.
 * `face_ worry_01.motion3.json`) mirrored verbatim on the bucket; they are
 * percent-encoded here so the built URL is valid everywhere. Leading or
 * trailing whitespace stays rejected, matching the relay-side validation.
 */
const toSafeEncodedPath = (path: string): string => {
  if (
    !path ||
    path !== path.trim() ||
    !SAFE_PATH_PATTERN.test(path) ||
    path.includes("..")
  ) {
    throw new Error(`Unsafe story asset path: ${path}`);
  }
  return path.replaceAll(" ", "%20");
};

export interface StoryAssetUrls {
  /** Absolute URL for a path on the story region bucket. */
  region: (path: string) => string;
  /** Absolute URL for a path on the independent Live2D bucket. */
  live2d: (path: string) => string;
}

/** Removes all trailing slashes. Equivalent to `.replace(/\/+$/, "")` but without regex backtracking. */
const stripTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
};

const resolveAssetOrigin = (
  getRemoteAssetBase: () => string | undefined
): string => {
  const base = getRemoteAssetBase();
  const configured = base === undefined ? undefined : stripTrailingSlashes(base);
  return configured && configured.length > 0
    ? configured
    : "https://storage.sekai.best";
};

/**
 * Builds asset URL helpers bound to a specific story region. Falls back to
 * the public asset origin when `PUBLIC_REMOTE_ASSET_BASE_URL` is not
 * configured (development defaults to direct bucket access, which is how the
 * legacy viewer works too).
 */
export const createStoryRegionAssetUrls = (
  getRemoteAssetBase: () => string | undefined,
  region: StoryAssetRegion
): StoryAssetUrls => {
  const origin = resolveAssetOrigin(getRemoteAssetBase);
  return {
    region: (path) => `${origin}/${storyRegionBuckets[region]}/${toSafeEncodedPath(path)}`,
    live2d: (path) => `${origin}/${LIVE2D_BUCKET}/${toSafeEncodedPath(path)}`
  };
};

// ---------------------------------------------------------------------------
// Logical path builders (bucket-relative)
// ---------------------------------------------------------------------------

/** Scenario JSON document path for a unit story episode. */
export const unitStoryScenarioPath = (
  chapterAssetbundleName: string,
  scenarioId: string
): string => `scenario/unitstory/${chapterAssetbundleName}/${scenarioId}.asset`;

/** Scenario JSON document path for an event story episode. */
export const eventStoryScenarioPath = (
  eventAssetbundleName: string,
  scenarioId: string
): string => `event_story/${eventAssetbundleName}/scenario/${scenarioId}.asset`;

/** Scenario JSON document path for a character profile story. */
export const characterProfileScenarioPath = (scenarioId: string): string =>
  `scenario/profile/${scenarioId}.asset`;

/** Scenario JSON document path for a card episode story. */
export const cardStoryScenarioPath = (
  assetbundleName: string,
  scenarioId: string,
  region: StoryAssetRegion
): string =>
  region === "en"
    ? `character/member_scenario/${assetbundleName}/${scenarioId}.asset`
    : `character/member/${assetbundleName}/${scenarioId}.asset`;

/** Scenario JSON document path for an action-set (area talk). */
export const areaTalkScenarioPath = (
  actionSetId: number,
  scenarioId: string
): string => `scenario/actionset/group${Math.floor(actionSetId / 100)}/${scenarioId}.asset`;

/** Scenario JSON document path for a special story episode. */
export const specialStoryScenarioPath = (
  groupAssetbundleName: string,
  episodeAssetbundleName: string,
  scenarioId: string
): string =>
  scenarioId.startsWith("op")
    ? `scenario/special/${groupAssetbundleName}/${scenarioId}.asset`
    : `scenario/special/${episodeAssetbundleName}/${scenarioId}.asset`;

export const backgroundImagePath = (name: string): string =>
  `scenario/background/${name}/${name}.webp`;

/** Event banner on the region bucket (`home/banner/{bundle}/{bundle}.webp`). */
export const eventBannerImagePath = (assetBundleName: string): string =>
  `home/banner/${assetBundleName}/${assetBundleName}.webp`;

/**
 * World-map area thumbnails used by the area-talk picker. Path rules ported
 * from the legacy sekai-viewer `AreaTalk` selector and re-verified against
 * storage.sekai.best on 2026-09-14:
 * - reality_world areas map to shared world-map sheets
 *   `worldmap/contents/normal/worldmap_area{NN}.webp` via their position in
 *   `areas.json` (only the first seven reality areas have a sheet).
 * - other areas use `worldmap/contents/normal/img_worldmap_areas{NN}.webp`
 *   (exists for area ids 5/7/8/9/10/27 on JP; other ids 404 and fall back to
 *   a generic tile in the UI).
 * - collaboration areas (rows carrying a `label`) live under
 *   `worldmap/contents/collaboration/{assetBundleName}/img_worldmap_areas{NN}.webp`.
 */

/** Reality-area sequence (1-based, `areas.json` order) -> world-map sheet. */
const REALITY_AREA_WORLDMAP_SHEETS: Record<number, number> = {
  1: 3,
  2: 1,
  3: 4,
  4: 5,
  5: 2,
  6: 7,
  7: 6
};

/** Bucket-relative thumbnail for the Nth reality area; null when no sheet. */
export const realityWorldmapAreaImagePath = (realitySeq: number): string | null => {
  const sheet = REALITY_AREA_WORLDMAP_SHEETS[realitySeq];
  return sheet
    ? `worldmap/contents/normal/worldmap_area${String(sheet).padStart(2, "0")}.webp`
    : null;
};

/** Bucket-relative thumbnail for a non-collaboration area id. */
export const spiritWorldmapAreaImagePath = (areaId: number): string =>
  `worldmap/contents/normal/img_worldmap_areas${String(areaId).padStart(2, "0")}.webp`;

/** Bucket-relative thumbnail for a collaboration area. */
export const collaborationWorldmapAreaImagePath = (
  assetBundleName: string,
  areaId: number
): string =>
  `worldmap/contents/collaboration/${assetBundleName}/img_worldmap_areas${String(areaId).padStart(2, "0")}.webp`;

export const bgmPath = (name: string): string =>
  `sound/scenario/bgm/${name}/${name}.mp3`;

export const scenarioVoicePath = (
  voiceBundleName: string,
  voiceId: string
): string => `sound/scenario/voice/${voiceBundleName}/${voiceId}.mp3`;

export const cardScenarioVoicePath = (
  voiceBundleName: string,
  voiceId: string
): string => `sound/card_scenario/voice/${voiceBundleName}/${voiceId}.mp3`;

export const actionSetVoicePath = (
  voiceBundleName: string,
  voiceId: string
): string => `sound/actionset/voice/${voiceBundleName}/${voiceId}.mp3`;

export const partVoicePathVariants = (
  characterAssetName: string,
  characterUnit: string | undefined,
  voiceId: string
): string[] => {
  const chara = `${characterAssetName}_${characterUnit ?? ""}`;
  if (chara.startsWith("v2_") || chara.startsWith("clb")) {
    return [`sound/scenario/voice/part_voice_${chara}/${voiceId}.mp3`];
  }
  return [
    `sound/scenario/part_voice/${chara}/${voiceId}.mp3`,
    `sound/scenario/voice/part_voice_${chara}/${voiceId}.mp3`
  ];
};

/**
 * Sound-effect path candidates. Legacy serves default-pack SEs from two
 * complementary packs; event SEs live next to the event story.
 */
export const soundEffectPaths = (se: string): string[] => {
  if (se.startsWith("se_event")) {
    const eventDir = se.split("_").slice(1, -1).join("_");
    return [`event_story/${eventDir}/scenario_se/${se}.mp3`];
  }
  const seBundleName =
    /^se\d{5}$/.test(se) && parseInt(se.substring(2)) <= 528
      ? "se_pack00001"
      : "se_pack00001_b";
  return [`sound/scenario/se/${seBundleName}/${se}.mp3`];
};

/** Directory that contains the movie for a scenario Movie effect. */
export const movieDirPath = (movie: string): string =>
  `${movie.includes("opening") ? "movie" : "scenario/movie"}/${movie}/`;

/** Deterministic movie fallback path (used when bucket listing fails). */
export const movieFallbackPath = (movie: string): string =>
  movie.includes("opening")
    ? `movie/${movie}/${movie}.mp4`
    : `scenario/movie/${movie}/${movie}.mp4`;

/**
 * Maps a scenario's own `ScenarioId` to the voice bundle name. Some scenario
 * ids are known to be wrong in the data; the map carries the legacy fixes.
 */
export const scenarioIdToAssetbundleName = (scenarioId: string): string => {
  let result = scenarioId;

  // Handle event number offset: if contains "event_" and number between 166
  // and 177, increment by 1
  const eventMatch = result.match(/event_(\d+)/);
  if (eventMatch) {
    const eventNumber = parseInt(eventMatch[1]);
    if (eventNumber > 166 && eventNumber < 177) {
      result = result.replace(/event_(\d+)/, `event_${eventNumber + 1}`);
    }
  }

  const map: Record<string, string> = {
    "areatalk03_266(20230607修正)": "areatalk03_266",
    "★4冬弥・泉_前半": "012043_touya01",
    "★4司・千秋_前半": "013042_tsukasa01",
    "★4類・夏目_後半": "016042_rui02",
    connect_live_collaboration_ensta_story: "collaboration_es_prequel_01",
    "ログインストーリー（OP）": "collaboration_es_op_01",
    "ログインストーリー（ED）": "collaboration_es_ed_01",
    connect_live_01_band: "connect_live_01_lon_01",
    connect_live_01_idol: "connect_live_01_mmj_01",
    connect_live_01_night: "connect_live_01_nig_01",
    story_connect_live_thanksgiving_4th_anv:
      "story_connect_live_4th_anniversary_01"
  };

  return map[result] || result;
};

/**
 * Builds the candidate voice paths for a talk, in priority order. The first
 * entry is the canonical path; the remaining ones are part-voice fallbacks
 * for voices whose canonical asset does not exist.
 */
export const talkVoicePathCandidates = ({
  scenarioId,
  voiceId,
  isCardStory,
  isActionSet,
  character
}: {
  scenarioId: string;
  voiceId: string;
  isCardStory: boolean;
  isActionSet: boolean;
  character?: { assetName?: string; unit?: string };
}): string[] => {
  const bundleName = scenarioIdToAssetbundleName(scenarioId);
  const canonical = `sound/${isCardStory ? "card_" : ""}${
    isActionSet ? "actionset" : "scenario"
  }/voice/${bundleName}/${voiceId}.mp3`;
  const candidates = [canonical];
  if (voiceId.startsWith("partvoice") && !isActionSet && character?.assetName) {
    candidates.push(
      ...partVoicePathVariants(character.assetName, character.unit, voiceId)
    );
  }
  return candidates;
};
