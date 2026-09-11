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
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
} = vi.hoisted(() => ({
  canUsePaginatedMusicList: vi.fn(),
  createMusicListPage: vi.fn(),
  fetchMusicCatalog: vi.fn(),
  fetchMusicListPage: vi.fn(),
  hasMusicListFilters: vi.fn(),
  logMusicListFilterDebug: vi.fn(),
  parseMusicListQueryState: vi.fn()
}));
vi.mock("$lib/server/music-list", () => ({
  canUsePaginatedMusicList,
  createMusicListPage,
  fetchMusicCatalog,
  fetchMusicListPage,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
}));

import { GET } from "./+server";
import type { MusicListItem, MusicListPage, MusicListQueryState } from "$lib/server/music-list";

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
    page: 2,
    pageSize: 24,
    hasNext: false,
    total: 1,
    totalPages: 1
  }
});

const runGet = (region: string, search = "") =>
  GET({
    params: { region },
    url: new URL(`http://localhost/musics/${region}/data${search}`)
  } as Parameters<typeof GET>[0]);

describe("music list data endpoint", () => {
  beforeEach(() => {
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    canUsePaginatedMusicList.mockReset();
    createMusicListPage.mockReset();
    fetchMusicCatalog.mockReset();
    fetchMusicListPage.mockReset();
    hasMusicListFilters.mockReset();
    hasMusicListFilters.mockReturnValue(false);
    logMusicListFilterDebug.mockReset();
    parseMusicListQueryState.mockReset();
    parseMusicListQueryState.mockReturnValue(makeQueryState());
  });

  it("returns a paginated page for the default query", async () => {
    const queryState = makeQueryState();
    const page = makePage("paginated");
    parseMusicListQueryState.mockReturnValue(queryState);
    canUsePaginatedMusicList.mockReturnValue(true);
    fetchMusicListPage.mockResolvedValue(page);

    const response = await runGet("tw", "?page=2");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(page);
    expect(fetchMusicListPage).toHaveBeenCalledWith("https://master-api.test", "tw", queryState, 2);
    expect(fetchMusicCatalog).not.toHaveBeenCalled();
  });

  it.each([
    ["", 1],
    ["?page=0", 1],
    ["?page=-2", 1],
    ["?page=not-a-number", 1],
    ["?page=3.5", 3]
  ])("normalizes page query %s", async (search, expectedPage) => {
    const page = makePage("normalized");
    canUsePaginatedMusicList.mockReturnValue(true);
    fetchMusicListPage.mockResolvedValue(page);

    const response = await runGet("jp", search);

    expect(response.status).toBe(200);
    expect(fetchMusicListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      expect.any(Object),
      expectedPage
    );
  });

  it("uses the catalog path for filtered requests and returns its locally paged result", async () => {
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

    const response = await runGet("invalid", "?page=3&category=vivid");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(page);
    expect(fetchMusicCatalog).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      true,
      true,
      ["vivid"],
      ["original"],
      "30"
    );
    expect(createMusicListPage).toHaveBeenCalledWith(catalog, queryState, 3);
    expect(fetchMusicListPage).not.toHaveBeenCalled();
  });

  it("returns a server error when a paginated request fails", async () => {
    canUsePaginatedMusicList.mockReturnValue(true);
    fetchMusicListPage.mockRejectedValueOnce(new Error("upstream unavailable"));

    const response = await runGet("jp");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: true });
  });

  it("returns a server error when the catalog request fails", async () => {
    canUsePaginatedMusicList.mockReturnValue(false);
    fetchMusicCatalog.mockRejectedValueOnce(new Error("upstream unavailable"));

    const response = await runGet("jp", "?name=missing");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: true });
  });
});
