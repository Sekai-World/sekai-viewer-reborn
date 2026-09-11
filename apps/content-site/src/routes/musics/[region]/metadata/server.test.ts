import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const {
  buildMusicListFilterMeta,
  fetchMusicCatalog,
  getDefaultMusicListFilterMeta,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
} = vi.hoisted(() => ({
  buildMusicListFilterMeta: vi.fn(),
  fetchMusicCatalog: vi.fn(),
  getDefaultMusicListFilterMeta: vi.fn(),
  hasMusicListFilters: vi.fn(),
  logMusicListFilterDebug: vi.fn(),
  parseMusicListQueryState: vi.fn()
}));
vi.mock("$lib/server/music-list", () => ({
  buildMusicListFilterMeta,
  fetchMusicCatalog,
  getDefaultMusicListFilterMeta,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
}));

import { GET } from "./+server";
import type {
  MusicListFilterMeta,
  MusicListItem,
  MusicListQueryState
} from "$lib/server/music-list";

const makeQueryState = (overrides: Partial<MusicListQueryState> = {}): MusicListQueryState => ({
  sortBy: "publishedAt",
  sortOrder: "desc",
  name: "",
  categories: [],
  composer: "",
  arranger: "",
  lyricist: "",
  vocalCharacter: [],
  tags: [],
  hasAppend: false,
  level: "",
  spoiler: false,
  ...overrides
});

const makeItem = (id: string): MusicListItem => ({
  id,
  title: `Music ${id}`,
  assetBundleName: null,
  categories: [],
  composer: null,
  arranger: null,
  lyricist: null,
  vocalCharacters: [],
  tags: [],
  difficulties: [],
  difficultyLevels: [],
  levels: [],
  publishedAt: null
});

const runGet = (region: string, search = "") =>
  GET({
    params: { region },
    url: new URL(`http://localhost/musics/${region}/metadata${search}`)
  } as Parameters<typeof GET>[0]);

describe("music list metadata endpoint", () => {
  const defaultFilterMeta: MusicListFilterMeta = {
    categories: [],
    composers: [],
    arrangers: [],
    lyricists: [],
    vocalCharacters: [],
    tags: [],
    difficulties: [],
    levels: []
  };

  beforeEach(() => {
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    buildMusicListFilterMeta.mockReset();
    fetchMusicCatalog.mockReset();
    getDefaultMusicListFilterMeta.mockReset();
    getDefaultMusicListFilterMeta.mockReturnValue(defaultFilterMeta);
    hasMusicListFilters.mockReset();
    hasMusicListFilters.mockReturnValue(false);
    logMusicListFilterDebug.mockReset();
    parseMusicListQueryState.mockReset();
    parseMusicListQueryState.mockReturnValue(makeQueryState());
  });

  it("returns filter metadata for the requested catalog", async () => {
    const queryState = makeQueryState({ categories: ["vivid"], spoiler: true });
    const catalog = [makeItem("1")];
    const filterMeta: MusicListFilterMeta = {
      ...defaultFilterMeta,
      categories: ["vivid"]
    };
    parseMusicListQueryState.mockReturnValue(queryState);
    hasMusicListFilters.mockReturnValue(true);
    fetchMusicCatalog.mockResolvedValue(catalog);
    buildMusicListFilterMeta.mockReturnValue(filterMeta);

    const response = await runGet("tw", "?category=vivid&spoiler=true");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ filterMeta, loadFailed: false });
    expect(fetchMusicCatalog).toHaveBeenCalledWith(
      "https://master-api.test",
      "tw",
      true,
      false,
      ["vivid"],
      [],
      ""
    );
    expect(buildMusicListFilterMeta).toHaveBeenCalledWith(catalog);
  });

  it("normalizes an invalid region and returns default metadata on failure", async () => {
    const queryState = makeQueryState({ level: "30" });
    parseMusicListQueryState.mockReturnValue(queryState);
    hasMusicListFilters.mockReturnValue(true);
    fetchMusicCatalog.mockRejectedValueOnce(new Error("catalog unavailable"));

    const response = await runGet("invalid", "?level=30");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      filterMeta: defaultFilterMeta,
      loadFailed: true
    });
    expect(fetchMusicCatalog).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      false,
      false,
      [],
      [],
      "30"
    );
    expect(buildMusicListFilterMeta).not.toHaveBeenCalled();
  });
});
