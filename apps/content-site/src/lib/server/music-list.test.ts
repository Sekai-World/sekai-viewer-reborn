import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMusicsByRegionList } = vi.hoisted(() => ({
  getMusicsByRegionList: vi.fn()
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getMusicsByRegionList
}));

import { buildMusicListFilterMeta, createMusicListPage, fetchMusicCatalog } from "./music-list";
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
