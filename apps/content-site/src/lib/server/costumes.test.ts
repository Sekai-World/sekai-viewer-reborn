import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  getCostume3dOutfitsByRegionList: vi.fn(),
  getCostume3dOutfitsByRegionById: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => sdk);

import {
  COSTUME_PAGE_SIZE,
  createCostumeListRequestQuery,
  fetchCostumeListPage,
  fetchCostumeOutfitDetail
} from "./costumes";

const baseUrl = "https://master-api.test";
const defaults = { name: "", rarity: null, characterId: null, sortOrder: "asc" } as const;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createCostumeListRequestQuery", () => {
  it("sends only the filters in use", () => {
    expect(createCostumeListRequestQuery(defaults, 2)).toEqual({
      page: 2,
      page_size: COSTUME_PAGE_SIZE,
      sort_by: "id",
      sort_order: "asc"
    });
    expect(
      createCostumeListRequestQuery(
        { name: "star", rarity: "rare", characterId: 21, sortOrder: "desc" },
        1
      )
    ).toEqual({
      page: 1,
      page_size: COSTUME_PAGE_SIZE,
      sort_by: "id",
      sort_order: "desc",
      name: "star",
      rarity: "rare",
      character_id: "21"
    });
  });
});

describe("fetchCostumeListPage", () => {
  it("returns the page and its pagination", async () => {
    sdk.getCostume3dOutfitsByRegionList.mockResolvedValueOnce({
      data: {
        items: [{ id: 11 }],
        pagination: { page: 1, page_size: 48, total: 49, total_pages: 2, has_next: true }
      }
    });

    const page = await fetchCostumeListPage(baseUrl, "tw", defaults);

    expect(page.items).toEqual([{ id: 11 }]);
    expect(page.pagination.hasNext).toBe(true);
    expect(sdk.getCostume3dOutfitsByRegionList).toHaveBeenCalledWith(
      expect.objectContaining({ path: { region: "tw" } })
    );
  });

  it("treats a missing item list as empty", async () => {
    sdk.getCostume3dOutfitsByRegionList.mockResolvedValueOnce({ data: {} });

    await expect(fetchCostumeListPage(baseUrl, "jp", defaults)).resolves.toMatchObject({
      items: []
    });
  });

  it("throws when the API fails", async () => {
    sdk.getCostume3dOutfitsByRegionList.mockResolvedValueOnce({ error: { code: "X" } });

    await expect(fetchCostumeListPage(baseUrl, "jp", defaults)).rejects.toThrow();
  });
});

describe("fetchCostumeOutfitDetail", () => {
  it("returns the outfit", async () => {
    sdk.getCostume3dOutfitsByRegionById.mockResolvedValueOnce({ data: { id: 11 } });

    await expect(fetchCostumeOutfitDetail(baseUrl, "jp", 11)).resolves.toEqual({ id: 11 });
    expect(sdk.getCostume3dOutfitsByRegionById).toHaveBeenCalledWith(
      expect.objectContaining({ path: { region: "jp", id: 11 } })
    );
  });

  it("returns null for an unknown outfit", async () => {
    sdk.getCostume3dOutfitsByRegionById.mockResolvedValueOnce({
      error: { code: "NOT_FOUND" },
      response: { status: 404 }
    });

    await expect(fetchCostumeOutfitDetail(baseUrl, "jp", 12)).resolves.toBeNull();
  });

  it("throws on other failures", async () => {
    sdk.getCostume3dOutfitsByRegionById.mockResolvedValueOnce({
      error: { code: "X" },
      response: { status: 500 }
    });

    await expect(fetchCostumeOutfitDetail(baseUrl, "jp", 11)).rejects.toThrow();
  });
});
