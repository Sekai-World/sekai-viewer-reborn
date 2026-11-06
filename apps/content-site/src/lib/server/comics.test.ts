import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ getComicsByRegionList: vi.fn() }));
vi.mock("@platform/sekai-master-api-sdk", () => sdk);

import { fetchComics } from "./comics";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchComics", () => {
  it("reads every page from the v1 API in order", async () => {
    sdk.getComicsByRegionList
      .mockResolvedValueOnce({ data: { items: [{ id: 1041 }], pagination: { has_next: true } } })
      .mockResolvedValueOnce({ data: { items: [{ id: 1042 }] } });

    const comics = await fetchComics("https://api.example.test", "tw");

    expect(comics.map((comic) => comic.id)).toEqual([1041, 1042]);
    expect(sdk.getComicsByRegionList).toHaveBeenNthCalledWith(1, {
      baseUrl: "https://api.example.test/api/v1",
      path: { region: "tw" },
      query: { page: 1, page_size: 100 }
    });
    expect(sdk.getComicsByRegionList).toHaveBeenCalledTimes(2);
  });

  it("throws when a page fails", async () => {
    sdk.getComicsByRegionList.mockResolvedValueOnce({ error: { code: "x" } });

    await expect(fetchComics("https://api.example.test", "tw")).rejects.toThrow();
  });
});
