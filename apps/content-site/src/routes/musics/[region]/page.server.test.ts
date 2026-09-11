import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const {
  canUsePaginatedMusicList,
  createMusicListPage,
  fetchMusicCatalog,
  fetchMusicListPage,
  getDefaultMusicListFilterMeta,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
} = vi.hoisted(() => ({
  canUsePaginatedMusicList: vi.fn(),
  createMusicListPage: vi.fn(),
  fetchMusicCatalog: vi.fn(),
  fetchMusicListPage: vi.fn(),
  getDefaultMusicListFilterMeta: vi.fn(),
  hasMusicListFilters: vi.fn(),
  logMusicListFilterDebug: vi.fn(),
  parseMusicListQueryState: vi.fn()
}));
vi.mock("$lib/server/music-list", () => ({
  canUsePaginatedMusicList,
  createMusicListPage,
  DEFAULT_MUSIC_LIST_PAGE_SIZE: 24,
  fetchMusicCatalog,
  fetchMusicListPage,
  getDefaultMusicListFilterMeta,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
}));

const { fetchUnitProfiles, toUnitProfileMap } = vi.hoisted(() => ({
  fetchUnitProfiles: vi.fn(),
  toUnitProfileMap: vi.fn()
}));
vi.mock("$lib/server/unit-profiles", () => ({ fetchUnitProfiles, toUnitProfileMap }));

import { load } from "./+page.server";
import type {
  MusicListFilterMeta,
  MusicListItem,
  MusicListPage,
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

const makePage = (id: string): MusicListPage => ({
  items: [makeItem(id)],
  pagination: {
    page: 1,
    pageSize: 24,
    hasNext: false,
    total: 1,
    totalPages: 1
  }
});

const makeLoadEvent = (region: string, search = "") => ({
  params: { region },
  url: new URL(`http://localhost/musics/${region}${search}`)
});

const runLoad = (region: string, search = "") =>
  load(makeLoadEvent(region, search) as Parameters<typeof load>[0]);

type MusicPageLoadResult = {
  region: string;
  initialPage: Promise<{ page: MusicListPage; loadFailed: boolean }>;
  initialQuery: MusicListQueryState;
  filterMeta: MusicListFilterMeta;
  unitProfiles: Promise<unknown>;
};

describe("music list page load", () => {
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
    canUsePaginatedMusicList.mockReset();
    createMusicListPage.mockReset();
    fetchMusicCatalog.mockReset();
    fetchMusicListPage.mockReset();
    getDefaultMusicListFilterMeta.mockReset();
    getDefaultMusicListFilterMeta.mockReturnValue(defaultFilterMeta);
    hasMusicListFilters.mockReset();
    hasMusicListFilters.mockReturnValue(false);
    logMusicListFilterDebug.mockReset();
    parseMusicListQueryState.mockReset();
    parseMusicListQueryState.mockReturnValue(makeQueryState());
    fetchUnitProfiles.mockReset();
    fetchUnitProfiles.mockResolvedValue([{ unit: "street", unitName: "Street" }]);
    toUnitProfileMap.mockReset();
    toUnitProfileMap.mockReturnValue({ street: "Street" });
  });

  it("loads the default route through the paginated first-screen path", async () => {
    const queryState = makeQueryState();
    const page = makePage("paginated");
    parseMusicListQueryState.mockReturnValue(queryState);
    canUsePaginatedMusicList.mockReturnValue(true);
    fetchMusicListPage.mockResolvedValue(page);

    const result = (await runLoad("tw")) as unknown as MusicPageLoadResult;

    expect(result.region).toBe("tw");
    expect(result.initialQuery).toBe(queryState);
    expect(result.filterMeta).toBe(defaultFilterMeta);
    await expect(result.initialPage).resolves.toEqual({ page, loadFailed: false });
    await expect(result.unitProfiles).resolves.toEqual({ street: "Street" });
    expect(fetchMusicListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "tw",
      queryState,
      1,
      24
    );
    expect(fetchMusicCatalog).not.toHaveBeenCalled();
    expect(fetchUnitProfiles).toHaveBeenCalledWith("https://master-api.test", "tw");
  });

  it("loads filtered queries through the full-catalog path with normalized regions", async () => {
    const queryState = makeQueryState({
      categories: ["vivid"],
      tags: ["original"],
      hasAppend: true,
      level: "30",
      spoiler: true
    });
    const catalog = [makeItem("catalog")];
    const page = makePage("filtered");
    parseMusicListQueryState.mockReturnValue(queryState);
    hasMusicListFilters.mockReturnValue(true);
    canUsePaginatedMusicList.mockReturnValue(false);
    fetchMusicCatalog.mockResolvedValue(catalog);
    createMusicListPage.mockReturnValue(page);

    const result = (await runLoad("invalid", "?category=vivid")) as unknown as MusicPageLoadResult;

    expect(result.region).toBe("jp");
    await expect(result.initialPage).resolves.toEqual({ page, loadFailed: false });
    expect(fetchMusicCatalog).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      true,
      true,
      ["vivid"],
      ["original"],
      "30"
    );
    expect(createMusicListPage).toHaveBeenCalledWith(catalog, queryState, 1);
    expect(fetchMusicListPage).not.toHaveBeenCalled();
  });

  it("returns an empty failed page when the initial list request rejects", async () => {
    const queryState = makeQueryState({ name: "missing" });
    const emptyPage = makePage("empty");
    parseMusicListQueryState.mockReturnValue(queryState);
    hasMusicListFilters.mockReturnValue(true);
    canUsePaginatedMusicList.mockReturnValue(true);
    fetchMusicListPage.mockRejectedValueOnce(new Error("master api unavailable"));
    createMusicListPage.mockReturnValue(emptyPage);

    const result = (await runLoad("jp")) as unknown as MusicPageLoadResult;

    await expect(result.initialPage).resolves.toEqual({ page: emptyPage, loadFailed: true });
    expect(createMusicListPage).toHaveBeenCalledWith([], queryState, 1);
  });

  it("falls back to an empty unit-profile map when profile loading rejects", async () => {
    const page = makePage("profiles");
    fetchUnitProfiles.mockRejectedValueOnce(new Error("profile service unavailable"));
    canUsePaginatedMusicList.mockReturnValue(true);
    fetchMusicListPage.mockResolvedValue(page);

    const result = (await runLoad("jp")) as unknown as MusicPageLoadResult;

    await expect(result.initialPage).resolves.toEqual({ page, loadFailed: false });
    await expect(result.unitProfiles).resolves.toEqual({});
  });
});
