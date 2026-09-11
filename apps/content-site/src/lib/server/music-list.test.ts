import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMusicsByRegionList } = vi.hoisted(() => ({
  getMusicsByRegionList: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getMusicsByRegionList
}));

import {
  buildMusicListFilterMeta,
  canUsePaginatedMusicList,
  createMusicListPage,
  getDefaultMusicListFilterMeta,
  fetchMusicCatalog,
  fetchMusicListPage,
  hasMusicListFilters,
  parseMusicCategories,
  parseMusicListItem,
  parseMusicListPage,
  parseMusicListQueryState
} from "./music-list";
import type { MusicListItem, MusicListQueryState } from "./music-list";

const makeItem = (id: string, categories: string[]): Record<string, unknown> => ({
  id,
  title: `Music ${id}`,
  categories
});

const makeListItem = (overrides: Partial<MusicListItem> = {}): MusicListItem => ({
  id: "1",
  title: "Music 1",
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
  publishedAt: null,
  ...overrides
});

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

const mockSinglePage = (items: Record<string, unknown>[]): void => {
  getMusicsByRegionList.mockResolvedValue({
    data: { items, pagination: { has_next: false, total: items.length } }
  });
};

type MockMusicResponse = {
  data: {
    items: Record<string, unknown>[];
    pagination: { has_next: boolean; total: number };
  };
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

describe("fetchMusicCatalog category propagation", () => {
  beforeEach(() => {
    getMusicsByRegionList.mockReset();
  });

  it("passes a comma-separated category query to the SDK", async () => {
    mockSinglePage([makeItem("1", ["vivid"]), makeItem("2", ["street"])]);

    await fetchMusicCatalog("https://a.test", "jp", false, false, ["vivid", "street"], [], "");

    expect(getMusicsByRegionList).toHaveBeenCalledTimes(1);
    const query = getMusicsByRegionList.mock.calls[0][0].query;
    expect(query.category).toBe("vivid,street");
    expect(query.tag).toBeUndefined();
  });

  it("omits the category query when no categories are requested", async () => {
    mockSinglePage([makeItem("1", ["vivid"])]);

    await fetchMusicCatalog("https://b.test", "jp", false, false, [], [], "");

    const query = getMusicsByRegionList.mock.calls[0][0].query;
    expect(query.category).toBeUndefined();
  });

  it("dedupes and trims category values before building the query", async () => {
    mockSinglePage([makeItem("1", ["vivid"])]);

    await fetchMusicCatalog(
      "https://c.test",
      "jp",
      false,
      false,
      ["vivid", " vivid", "street", "vivid"],
      [],
      ""
    );

    const query = getMusicsByRegionList.mock.calls[0][0].query;
    expect(query.category).toBe("vivid,street");
  });

  it("requests distinct catalogs for distinct category sets (independent cache keys)", async () => {
    mockSinglePage([makeItem("1", ["vivid"])]);
    await fetchMusicCatalog("https://d.test", "jp", false, false, ["vivid"], [], "");

    mockSinglePage([makeItem("2", ["street"])]);
    await fetchMusicCatalog("https://d.test", "jp", false, false, ["street"], [], "");

    expect(getMusicsByRegionList).toHaveBeenCalledTimes(2);
    expect(getMusicsByRegionList.mock.calls[0][0].query.category).toBe("vivid");
    expect(getMusicsByRegionList.mock.calls[1][0].query.category).toBe("street");
  });

  it("reuses a cached catalog when the same category set is requested again", async () => {
    mockSinglePage([makeItem("1", ["vivid"])]);
    await fetchMusicCatalog("https://e.test", "jp", false, false, ["vivid"], [], "");
    await fetchMusicCatalog("https://e.test", "jp", false, false, ["vivid"], [], "");

    expect(getMusicsByRegionList).toHaveBeenCalledTimes(1);
  });

  it("combines category and tag queries independently", async () => {
    mockSinglePage([makeItem("1", ["vivid"])]);

    await fetchMusicCatalog("https://f.test", "jp", false, false, ["vivid"], ["original"], "");

    const query = getMusicsByRegionList.mock.calls[0][0].query;
    expect(query.category).toBe("vivid");
    expect(query.tag).toBe("original");
  });

  it("propagates spoiler, append, tag, and level options to the catalog request", async () => {
    mockSinglePage([makeItem("1", ["vivid"])]);

    await fetchMusicCatalog(
      "https://options.test",
      "en",
      true,
      true,
      [" vivid "],
      ["original"],
      " 30 "
    );

    expect(getMusicsByRegionList.mock.calls[0][0]).toMatchObject({
      baseUrl: "https://options.test",
      path: { region: "en" },
      query: {
        page: 1,
        page_size: 1000,
        spoiler: true,
        category: "vivid",
        tag: "original",
        playLevel: "30",
        hasAppend: true,
        sort_by: "publishedAt",
        sort_order: "desc"
      }
    });
  });

  it("throws when the catalog API returns an error", async () => {
    getMusicsByRegionList.mockResolvedValueOnce({ error: { status: 503 } });

    await expect(
      fetchMusicCatalog("https://catalog-error.test", "jp", false, false, [], [], "")
    ).rejects.toThrow("Failed to load music catalog.");
  });

  it("returns an empty catalog for a response without data", async () => {
    getMusicsByRegionList.mockResolvedValueOnce({});

    await expect(
      fetchMusicCatalog("https://catalog-empty.test", "jp", false, false, [], [], "")
    ).resolves.toEqual([]);
  });

  it("reloads a catalog after its cache entry expires", async () => {
    vi.useFakeTimers();
    try {
      getMusicsByRegionList
        .mockResolvedValueOnce({
          data: { items: [makeItem("1", [])], pagination: { has_next: false, total: 1 } }
        })
        .mockResolvedValueOnce({
          data: { items: [makeItem("2", [])], pagination: { has_next: false, total: 1 } }
        });

      const first = await fetchMusicCatalog(
        "https://catalog-expiry.test",
        "jp",
        false,
        false,
        [],
        [],
        ""
      );
      vi.advanceTimersByTime(60_001);
      const second = await fetchMusicCatalog(
        "https://catalog-expiry.test",
        "jp",
        false,
        false,
        [],
        [],
        ""
      );

      expect(first.map((item) => item.id)).toEqual(["1"]);
      expect(second.map((item) => item.id)).toEqual(["2"]);
      expect(getMusicsByRegionList).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("music list parsing", () => {
  it("normalizes canonical categories and discards malformed values", () => {
    expect(parseMusicCategories(["vivid", "vivid", "", "  ", null, 42, {}])).toEqual(["vivid"]);
    expect(parseMusicCategories(undefined)).toEqual([]);
    expect(parseMusicCategories("vivid")).toEqual([]);
  });

  it("parses aliases and nested list values into a stable list item", () => {
    expect(parseMusicListItem(null)).toBeNull();
    expect(parseMusicListItem({ title: "Missing id" })).toBeNull();
    expect(parseMusicListItem({ id: "missing title" })).toBeNull();

    expect(
      parseMusicListItem({
        musicId: 42,
        name: "Alias title",
        assetBundleName: "alias_bundle",
        categories: ["vivid", "vivid"],
        composer: "Composer",
        arranger: "Arranger",
        lyricist: "Lyricist",
        vocalCharacters: [1, { characterId: 2 }, null, {}],
        music_tag: "original, commissioned, original",
        musicDifficulties: [
          { difficulty: "EXPERT", level: 30 },
          { musicDifficulty: "MASTER", musicLevel: "append" },
          { difficulty: "" },
          {},
          null
        ],
        published_at: 123
      })
    ).toEqual({
      id: "42",
      title: "Alias title",
      assetBundleName: "alias_bundle",
      categories: ["vivid"],
      composer: "Composer",
      arranger: "Arranger",
      lyricist: "Lyricist",
      vocalCharacters: ["1", "2"],
      tags: ["original", "commissioned"],
      difficulties: ["expert", "master"],
      difficultyLevels: [
        { difficulty: "expert", level: "30" },
        { difficulty: "master", level: "append" }
      ],
      levels: ["30", "append"],
      publishedAt: 123
    });
  });

  it("supports scalar and object list aliases and date aliases", () => {
    expect(
      parseMusicListItem({
        id: "7",
        title: "Scalar values",
        vocalCharacterIds: "1, 2, 1",
        tags: [{ tag: "original" }, "original", 3],
        levels: [5, "5"],
        publishedAt: "2026-01-01"
      })
    ).toMatchObject({
      id: "7",
      vocalCharacters: ["1", "2"],
      tags: ["original", "3"],
      difficulties: [],
      difficultyLevels: [],
      levels: ["5"],
      publishedAt: "2026-01-01"
    });
  });

  it("parses explicit and fallback pagination while filtering invalid items", () => {
    const page = parseMusicListPage(
      {
        items: [makeItem("1", ["vivid"]), { id: "invalid" }, null],
        pagination: {
          page: 2,
          page_size: 2,
          has_next: true,
          total: 5,
          total_pages: 3
        }
      },
      1,
      24
    );

    expect(page.items.map((item) => item.id)).toEqual(["1"]);
    expect(page.pagination).toEqual({
      page: 2,
      pageSize: 2,
      hasNext: true,
      total: 5,
      totalPages: 3
    });

    expect(parseMusicListPage({ items: [makeItem("2", [])] }, 2, 2).pagination).toEqual({
      page: 2,
      pageSize: 2,
      hasNext: false,
      total: 1,
      totalPages: 1
    });

    expect(
      parseMusicListPage(
        {
          items: [makeItem("3", []), makeItem("4", [])],
          pagination: {
            page: "invalid",
            page_size: "invalid",
            total: "invalid",
            total_pages: 0,
            has_next: "invalid"
          }
        },
        3,
        2
      ).pagination
    ).toEqual({
      page: 3,
      pageSize: 2,
      hasNext: true,
      total: 2,
      totalPages: 0
    });

    expect(
      parseMusicListPage({ items: [], pagination: { total_pages: 0, has_next: null } }, 1, 2)
        .pagination.hasNext
    ).toBe(false);
  });
});

describe("music list query state", () => {
  it("trims, deduplicates, and normalizes all supported query values", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("sort_by", "id");
    searchParams.set("sort_order", "asc");
    searchParams.set("name", "  world  ");
    searchParams.append("category", " vivid ");
    searchParams.append("category", "vivid");
    searchParams.set("composer", " Composer ");
    searchParams.set("arranger", " Arranger ");
    searchParams.set("lyricist", " Lyricist ");
    searchParams.append("vocal_character", " 1 ");
    searchParams.append("vocal_character", "1");
    searchParams.append("music_tag", "original");
    searchParams.append("vocal_unit", "light_sound");
    searchParams.append("vocal_unit", "light_sound");
    searchParams.set("has_append", "true");
    searchParams.append("difficulty", "append");
    searchParams.set("playLevel", " 30 ");
    searchParams.set("level", "29");
    searchParams.set("spoiler", "true");

    expect(parseMusicListQueryState(searchParams)).toEqual({
      sortBy: "id",
      sortOrder: "asc",
      name: "world",
      categories: ["vivid"],
      composer: "Composer",
      arranger: "Arranger",
      lyricist: "Lyricist",
      vocalCharacter: ["1"],
      tags: ["original", "light_music_club"],
      hasAppend: true,
      level: "30",
      spoiler: true
    });
  });

  it("uses safe defaults and the all-tag reset while preserving unknown legacy values", () => {
    const state = parseMusicListQueryState(
      new URLSearchParams(
        "sort_by=unknown&sort_order=unknown&music_tag=all&music_tag=original&vocal_unit=unknown&level=  "
      )
    );

    expect(state).toMatchObject({
      sortBy: "publishedAt",
      sortOrder: "desc",
      tags: [],
      level: ""
    });
    expect(parseMusicListQueryState(new URLSearchParams("vocal_unit=unknown")).tags).toEqual([
      "unknown"
    ]);
  });

  it.each([
    ["hasAppend=true", true],
    ["has_append=true", true],
    ["difficulty=append", true],
    ["difficulty=expert", false]
  ])("parses append query variant %s", (query, expected) => {
    expect(parseMusicListQueryState(new URLSearchParams(query)).hasAppend).toBe(expected);
  });

  it("detects each local filter and permits only the default paginated sort", () => {
    expect(hasMusicListFilters(makeQueryState())).toBe(false);
    for (const override of [
      { name: "world" },
      { categories: ["vivid"] },
      { composer: "Composer" },
      { arranger: "Arranger" },
      { lyricist: "Lyricist" },
      { vocalCharacter: ["1"] },
      { tags: ["original"] },
      { hasAppend: true },
      { level: "30" }
    ]) {
      expect(hasMusicListFilters(makeQueryState(override))).toBe(true);
    }

    expect(canUsePaginatedMusicList(makeQueryState())).toBe(true);
    expect(canUsePaginatedMusicList(makeQueryState({ sortOrder: "asc" }))).toBe(false);
    expect(canUsePaginatedMusicList(makeQueryState({ spoiler: true }))).toBe(true);
  });
});

describe("fetchMusicCatalog single-flight behavior", () => {
  beforeEach(() => {
    getMusicsByRegionList.mockReset();
  });

  it("shares one in-flight request for concurrent callers with the same key", async () => {
    const deferred = createDeferred<MockMusicResponse>();
    getMusicsByRegionList.mockReturnValue(deferred.promise);

    const first = fetchMusicCatalog("https://single-flight.test", "jp", false, false, [], [], "");
    const second = fetchMusicCatalog("https://single-flight.test", "jp", false, false, [], [], "");

    expect(getMusicsByRegionList).toHaveBeenCalledTimes(1);

    deferred.resolve({
      data: {
        items: [makeItem("1", ["vivid"])],
        pagination: { has_next: false, total: 1 }
      }
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      [expect.objectContaining({ id: "1" })],
      [expect.objectContaining({ id: "1" })]
    ]);

    await fetchMusicCatalog("https://single-flight.test", "jp", false, false, [], [], "");
    expect(getMusicsByRegionList).toHaveBeenCalledTimes(1);
  });

  it("clears a failed in-flight request so the same key can be retried", async () => {
    getMusicsByRegionList.mockRejectedValueOnce(new Error("temporary failure"));

    await expect(
      fetchMusicCatalog("https://retry.test", "jp", false, false, [], [], "")
    ).rejects.toThrow("temporary failure");

    mockSinglePage([makeItem("2", ["street"])]);
    await expect(
      fetchMusicCatalog("https://retry.test", "jp", false, false, [], [], "")
    ).resolves.toEqual([expect.objectContaining({ id: "2" })]);

    expect(getMusicsByRegionList).toHaveBeenCalledTimes(2);
  });

  it("keeps concurrent requests for different keys independent", async () => {
    const firstDeferred = createDeferred<MockMusicResponse>();
    const secondDeferred = createDeferred<MockMusicResponse>();
    getMusicsByRegionList
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);

    const first = fetchMusicCatalog("https://key-a.test", "jp", false, false, [], [], "");
    const second = fetchMusicCatalog("https://key-b.test", "jp", false, false, [], [], "");

    expect(getMusicsByRegionList).toHaveBeenCalledTimes(2);

    firstDeferred.resolve({
      data: {
        items: [makeItem("a", ["vivid"])],
        pagination: { has_next: false, total: 1 }
      }
    });
    secondDeferred.resolve({
      data: {
        items: [makeItem("b", ["street"])],
        pagination: { has_next: false, total: 1 }
      }
    });

    const [firstItems, secondItems] = await Promise.all([first, second]);
    expect(firstItems.map((item) => item.id)).toEqual(["a"]);
    expect(secondItems.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("paginated music list helper", () => {
  beforeEach(() => {
    getMusicsByRegionList.mockReset();
  });

  it("requests and parses the default first page without local filtering", async () => {
    mockSinglePage([makeItem("1", ["vivid"])]);
    const queryState = parseMusicListQueryState(new URLSearchParams());

    const page = await fetchMusicListPage("https://page.test", "jp", queryState);
    const query = getMusicsByRegionList.mock.calls[0][0].query;

    expect(query.page).toBe(1);
    expect(query.page_size).toBe(24);
    expect(query.sort_by).toBe("publishedAt");
    expect(query.sort_order).toBe("desc");
    expect(page.items.map((item) => item.id)).toEqual(["1"]);
    expect(page.pagination).toEqual({
      page: 1,
      pageSize: 24,
      hasNext: false,
      total: 1,
      totalPages: 1
    });
  });

  it("uses API pagination for page one and page two", async () => {
    const queryState = parseMusicListQueryState(new URLSearchParams());
    getMusicsByRegionList
      .mockResolvedValueOnce({
        data: {
          items: [makeItem("1", ["vivid"])],
          pagination: { page: 1, page_size: 24, has_next: true, total: 2, total_pages: 2 }
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [makeItem("2", ["street"])],
          pagination: { page: 2, page_size: 24, has_next: false, total: 2, total_pages: 2 }
        }
      });

    const firstPage = await fetchMusicListPage("https://pagination.test", "jp", queryState, 1);
    const secondPage = await fetchMusicListPage("https://pagination.test", "jp", queryState, 2);

    expect(getMusicsByRegionList).toHaveBeenCalledTimes(2);
    expect(getMusicsByRegionList.mock.calls[0][0].query.page).toBe(1);
    expect(getMusicsByRegionList.mock.calls[1][0].query.page).toBe(2);
    expect(firstPage.pagination).toMatchObject({ page: 1, pageSize: 24, hasNext: true });
    expect(secondPage.pagination).toMatchObject({ page: 2, pageSize: 24, hasNext: false });
    expect(firstPage.items.map((item) => item.id)).toEqual(["1"]);
    expect(secondPage.items.map((item) => item.id)).toEqual(["2"]);
  });

  it("normalizes all request query fields for a filtered page", async () => {
    mockSinglePage([makeItem("1", ["vivid"])]);
    const queryState = parseMusicListQueryState(
      new URLSearchParams(
        "category=%20vivid%20&music_tag=original&playLevel=%2030%20&hasAppend=true&spoiler=true&sort_by=id&sort_order=asc"
      )
    );

    await fetchMusicListPage("https://page-options.test", "tw", queryState, 3, 12);

    expect(getMusicsByRegionList.mock.calls[0][0]).toMatchObject({
      baseUrl: "https://page-options.test",
      path: { region: "tw" },
      query: {
        page: 3,
        page_size: 12,
        spoiler: true,
        category: "vivid",
        tag: "original",
        playLevel: "30",
        hasAppend: true,
        sort_by: "id",
        sort_order: "asc"
      }
    });
  });

  it("throws when a paginated page request returns an error", async () => {
    getMusicsByRegionList.mockResolvedValueOnce({ error: { status: 500 } });

    await expect(
      fetchMusicListPage("https://page-error.test", "jp", makeQueryState())
    ).rejects.toThrow("Failed to load music list page.");
  });

  it("follows all pages when the full-catalog fallback is used", async () => {
    getMusicsByRegionList
      .mockResolvedValueOnce({
        data: {
          items: [makeItem("1", ["vivid"])],
          pagination: { page: 1, page_size: 1000, has_next: true, total: 2, total_pages: 2 }
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [makeItem("2", ["street"])],
          pagination: { page: 2, page_size: 1000, has_next: false, total: 2, total_pages: 2 }
        }
      });

    const catalog = await fetchMusicCatalog(
      "https://catalog-pages.test",
      "jp",
      false,
      false,
      [],
      [],
      ""
    );

    expect(getMusicsByRegionList).toHaveBeenCalledTimes(2);
    expect(getMusicsByRegionList.mock.calls.map((call) => call[0].query.page)).toEqual([1, 2]);
    expect(catalog.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("keeps locally filtered or non-default-sorted queries on the catalog path", () => {
    expect(canUsePaginatedMusicList(parseMusicListQueryState(new URLSearchParams()))).toBe(true);
    expect(
      canUsePaginatedMusicList(parseMusicListQueryState(new URLSearchParams("name=world")))
    ).toBe(false);
    expect(
      canUsePaginatedMusicList(parseMusicListQueryState(new URLSearchParams("vocal_character=1")))
    ).toBe(false);
    expect(
      canUsePaginatedMusicList(parseMusicListQueryState(new URLSearchParams("category=vivid")))
    ).toBe(false);
    expect(
      canUsePaginatedMusicList(parseMusicListQueryState(new URLSearchParams("music_tag=original")))
    ).toBe(false);
    expect(
      canUsePaginatedMusicList(parseMusicListQueryState(new URLSearchParams("hasAppend=true")))
    ).toBe(false);
    expect(
      canUsePaginatedMusicList(parseMusicListQueryState(new URLSearchParams("playLevel=30")))
    ).toBe(false);
    expect(
      canUsePaginatedMusicList(parseMusicListQueryState(new URLSearchParams("sort_by=id")))
    ).toBe(false);
  });
});

describe("createMusicListPage multi-category semantics", () => {
  const catalog = [
    makeItem("1", ["vivid", "street"]) as never,
    makeItem("2", ["vivid"]) as never,
    makeItem("3", ["street", "light_music_club"]) as never
  ];

  it("keeps an item only when it matches every requested category (AND semantics)", () => {
    const page = createMusicListPage(
      catalog,
      {
        sortBy: "id",
        sortOrder: "asc",
        name: "",
        categories: ["vivid", "street"],
        composer: "",
        arranger: "",
        lyricist: "",
        vocalCharacter: [],
        tags: [],
        hasAppend: false,
        level: "",
        spoiler: false
      },
      1
    );

    expect(page.items.map((item) => item.id)).toEqual(["1"]);
  });
});

describe("createMusicListPage filtering and sorting", () => {
  const catalog = [
    makeListItem({
      id: "10",
      title: "The World",
      categories: ["vivid", "street"],
      composer: "Composer",
      arranger: "Arranger",
      lyricist: "Lyricist",
      vocalCharacters: ["1", "2"],
      levels: ["30"],
      publishedAt: 100
    }),
    makeListItem({
      id: "2",
      title: "Another Song",
      categories: ["vivid"],
      composer: "Other composer",
      arranger: "Other arranger",
      lyricist: "Other lyricist",
      vocalCharacters: ["3"],
      levels: ["10"],
      publishedAt: 300
    }),
    makeListItem({
      id: "1",
      title: "Street Light",
      categories: ["street"],
      composer: "Third composer",
      arranger: "Third arranger",
      lyricist: "Third lyricist",
      vocalCharacters: ["4"],
      levels: ["master"],
      publishedAt: null
    })
  ];

  it("applies name, creator, vocal-character, and level filters", () => {
    const page = createMusicListPage(
      catalog,
      makeQueryState({
        name: " world ".trim(),
        categories: ["vivid", "street"],
        composer: "Composer",
        arranger: "Arranger",
        lyricist: "Lyricist",
        vocalCharacter: ["9", "2"],
        level: "30",
        sortBy: "id",
        sortOrder: "asc"
      }),
      1
    );

    expect(page.items.map((item) => item.id)).toEqual(["10"]);
  });

  it("rejects items that fail each local filter", () => {
    const matchingItem = catalog[0];
    const cases: [string, Partial<MusicListQueryState>][] = [
      ["name", { name: "missing" }],
      ["categories", { categories: ["missing"] }],
      ["composer", { composer: "missing" }],
      ["arranger", { arranger: "missing" }],
      ["lyricist", { lyricist: "missing" }],
      ["vocal character", { vocalCharacter: ["missing"] }],
      ["level", { level: "99" }]
    ];

    for (const [label, override] of cases) {
      expect(createMusicListPage([matchingItem], makeQueryState(override), 1).items, label).toEqual(
        []
      );
    }
  });

  it.each([
    ["", ["10", "2", "1", "invalid"]],
    ["10", ["10", "2"]],
    ["8-12", ["10", "2"]],
    ["12-8", ["10", "2"]],
    [">10", []],
    [">=10", ["10", "2"]],
    ["<10", []],
    ["<=10", ["10", "2"]],
    ["master", ["1"]]
  ])("supports level condition %s", (level, expectedIds) => {
    const levelCatalog = [
      makeListItem({ id: "10", levels: ["10"] }),
      makeListItem({ id: "2", levels: ["10"] }),
      makeListItem({ id: "1", levels: ["master"] }),
      makeListItem({ id: "invalid", levels: ["not-a-number"] })
    ];

    const page = createMusicListPage(levelCatalog, makeQueryState({ level }), 1, 20);

    expect(page.items.map((item) => item.id)).toEqual(expectedIds);
  });

  it("sorts by id or published time in both directions and paginates the result", () => {
    const ascById = createMusicListPage(
      catalog,
      makeQueryState({ sortBy: "id", sortOrder: "asc" }),
      1,
      2
    );
    expect(ascById.items.map((item) => item.id)).toEqual(["1", "2"]);
    expect(ascById.pagination).toMatchObject({ hasNext: true, total: 3, totalPages: 2 });

    const descById = createMusicListPage(catalog, makeQueryState({ sortBy: "id" }), 2, 2);
    expect(descById.items.map((item) => item.id)).toEqual(["1"]);

    const ascByPublishedAt = createMusicListPage(
      catalog,
      makeQueryState({ sortBy: "publishedAt", sortOrder: "asc" }),
      1,
      3
    );
    expect(ascByPublishedAt.items.map((item) => item.id)).toEqual(["1", "10", "2"]);
  });
});

describe("buildMusicListFilterMeta", () => {
  it("returns empty metadata by default", () => {
    expect(getDefaultMusicListFilterMeta()).toEqual({
      categories: [],
      composers: [],
      arrangers: [],
      lyricists: [],
      vocalCharacters: [],
      tags: [],
      difficulties: [],
      levels: []
    });
  });

  it("sorts string filter values alphabetically", () => {
    const item: MusicListItem = {
      id: "1",
      title: "Music 1",
      assetBundleName: null,
      categories: ["zeta", "alpha"],
      composer: "zeta",
      arranger: "alpha",
      lyricist: "zeta",
      vocalCharacters: ["zeta", "alpha"],
      tags: ["zeta", "alpha"],
      difficulties: ["expert", "easy"],
      difficultyLevels: [],
      levels: [],
      publishedAt: null
    };

    expect(buildMusicListFilterMeta([item])).toEqual({
      categories: ["alpha", "zeta"],
      composers: ["zeta"],
      arrangers: ["alpha"],
      lyricists: ["zeta"],
      vocalCharacters: ["alpha", "zeta"],
      tags: ["alpha", "zeta"],
      difficulties: ["easy", "expert"],
      levels: []
    });
  });

  it("deduplicates all filter values and sorts numeric levels numerically", () => {
    const first = makeListItem({
      categories: ["zeta", "alpha", "zeta"],
      composer: "Composer",
      arranger: "Arranger",
      lyricist: "Lyricist",
      vocalCharacters: ["2", "1"],
      tags: ["original", "original"],
      difficulties: ["master", "easy"],
      levels: ["10", "2", "10"]
    });
    const second = makeListItem({
      id: "2",
      categories: ["beta"],
      composer: "Another composer",
      vocalCharacters: ["1"],
      tags: ["commissioned"],
      difficulties: ["easy"],
      levels: ["3"]
    });

    expect(buildMusicListFilterMeta([first, second])).toEqual({
      categories: ["alpha", "beta", "zeta"],
      composers: ["Another composer", "Composer"],
      arrangers: ["Arranger"],
      lyricists: ["Lyricist"],
      vocalCharacters: ["1", "2"],
      tags: ["commissioned", "original"],
      difficulties: ["easy", "master"],
      levels: ["2", "3", "10"]
    });

    expect(buildMusicListFilterMeta([makeListItem({ levels: ["zeta", "alpha"] })]).levels).toEqual([
      "alpha",
      "zeta"
    ]);
  });
});
