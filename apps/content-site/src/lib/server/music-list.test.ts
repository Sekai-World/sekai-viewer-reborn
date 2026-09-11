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
  fetchMusicCatalog,
  fetchMusicListPage,
  parseMusicListQueryState
} from "./music-list";
import type { MusicListItem } from "./music-list";

const makeItem = (id: string, categories: string[]): Record<string, unknown> => ({
  id,
  title: `Music ${id}`,
  categories
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

const createDeferred = <T,>() => {
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

describe("buildMusicListFilterMeta", () => {
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
});
