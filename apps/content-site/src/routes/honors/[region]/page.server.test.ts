import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHonorGroupsByRegionList } = vi.hoisted(() => ({
  getHonorGroupsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({ getHonorGroupsByRegionList }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

import { load } from "./+page.server";
import type { HonorGroup } from "$lib/domain/honor";

type HonorPageLoadResult = {
  region: string;
  query: { page: number };
  catalogue: Promise<{
    items: HonorGroup[];
    loadFailed: boolean;
    pagination: {
      page: number;
      pageSize: number;
      hasNext: boolean;
      total: number | null;
      totalPages: number | null;
    };
  }>;
};

const PAGE_SIZE = 12;

const runLoad = (region: string, search = "") =>
  load({
    params: { region },
    url: new URL(`http://localhost/honors/${region}${search}`)
  } as Parameters<typeof load>[0]);

const createHonorGroup = (id: number) => ({
  id,
  name: `Honor group ${id}`,
  honorType: "character",
  backgroundAssetbundleName: `honor_group_${id}`,
  frameName: `frame_${id}`,
  honors: [
    {
      id: id * 100 + 2,
      name: `Honor ${id * 100 + 2}`,
      assetbundleName: `honor_${id * 100 + 2}`,
      groupId: id,
      levels: [
        {
          honorId: id * 100 + 2,
          level: 2,
          description: "Second level"
        },
        {
          honorId: id * 100 + 2,
          level: 1,
          description: "First level"
        }
      ]
    },
    {
      id: id * 100 + 1,
      name: `Honor ${id * 100 + 1}`,
      assetbundleName: `honor_${id * 100 + 1}`,
      levels: [
        {
          honorId: id * 100 + 1,
          level: 1,
          description: "Only level"
        }
      ]
    }
  ]
});

const createHonorGroupResponse = (page: number, total: number) => {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startIndex = (page - 1) * PAGE_SIZE;
  const itemCount = Math.max(0, Math.min(PAGE_SIZE, total - startIndex));

  return {
    data: {
      items: Array.from({ length: itemCount }, (_, index) =>
        createHonorGroup(startIndex + index + 1)
      ),
      pagination: {
        page,
        page_size: PAGE_SIZE,
        total,
        total_pages: totalPages,
        has_next: page < totalPages
      }
    }
  };
};

describe("honor catalogue page load", () => {
  beforeEach(() => {
    getHonorGroupsByRegionList.mockReset();
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
  });

  it("fetches group-level pages and keeps each group's honors and levels in API order", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createHonorGroupResponse(2, PAGE_SIZE * 55));

    const result = (await runLoad("invalid", "?page=2")) as unknown as HonorPageLoadResult;
    const catalogue = await result.catalogue;

    expect(result.region).toBe("jp");
    expect(result.query).toEqual({ page: 2 });
    expect(catalogue).toMatchObject({
      loadFailed: false,
      pagination: {
        page: 2,
        pageSize: 12,
        hasNext: true,
        total: PAGE_SIZE * 55,
        totalPages: 55
      }
    });
    expect(catalogue.items).toHaveLength(PAGE_SIZE);
    expect(catalogue.items[0]).toMatchObject({
      id: 13,
      name: "Honor group 13",
      backgroundAssetBundleName: "honor_group_13",
      honors: [
        {
          id: 1302,
          name: "Honor 1302",
          group: { id: 13, name: "Honor group 13" },
          groupId: 13,
          levels: [
            { level: 2, description: "Second level" },
            { level: 1, description: "First level" }
          ]
        },
        {
          id: 1301,
          name: "Honor 1301",
          groupId: 13,
          levels: [{ level: 1, description: "Only level" }]
        }
      ]
    });
    expect(getHonorGroupsByRegionList).toHaveBeenCalledTimes(1);
    expect(getHonorGroupsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "jp" },
      query: { page: 2, page_size: 12 }
    });
  });

  it("defaults invalid page values and accepts a positive integer", async () => {
    getHonorGroupsByRegionList.mockImplementation(({ query }: { query: { page?: number } }) =>
      Promise.resolve(createHonorGroupResponse(query.page ?? 1, 12))
    );

    const invalidResult = (await runLoad("tw", "?page=2.5")) as unknown as HonorPageLoadResult;
    expect(invalidResult.query.page).toBe(1);
    await expect(invalidResult.catalogue).resolves.toMatchObject({
      loadFailed: false,
      pagination: { page: 1 }
    });
    expect(getHonorGroupsByRegionList.mock.calls[0]?.[0].query).toEqual({ page: 1, page_size: 12 });

    getHonorGroupsByRegionList.mockReset();
    getHonorGroupsByRegionList.mockResolvedValue(createHonorGroupResponse(3, 36));
    const positiveResult = (await runLoad("tw", "?page=003")) as unknown as HonorPageLoadResult;
    expect(positiveResult.query.page).toBe(3);
    await expect(positiveResult.catalogue).resolves.toMatchObject({
      loadFailed: false,
      pagination: { page: 3, total: 36, totalPages: 3, hasNext: false }
    });
    expect(getHonorGroupsByRegionList.mock.calls[0]?.[0].query).toEqual({ page: 3, page_size: 12 });
    expect(getHonorGroupsByRegionList).toHaveBeenCalledTimes(1);
  });

  it("accepts the first page of an empty catalogue but rejects later pages", async () => {
    getHonorGroupsByRegionList.mockResolvedValueOnce(createHonorGroupResponse(1, 0));

    const firstPageResult = (await runLoad("jp")) as unknown as HonorPageLoadResult;

    await expect(firstPageResult.catalogue).resolves.toEqual({
      items: [],
      pagination: { page: 1, pageSize: 12, hasNext: false, total: 0, totalPages: 0 },
      loadFailed: false
    });

    getHonorGroupsByRegionList.mockResolvedValueOnce(createHonorGroupResponse(2, 0));

    const laterPageResult = (await runLoad("jp", "?page=2")) as unknown as HonorPageLoadResult;

    await expect(laterPageResult.catalogue).resolves.toEqual({
      items: [],
      pagination: { page: 2, pageSize: 12, hasNext: false, total: null, totalPages: null },
      loadFailed: true
    });
  });

  it("returns a failed empty page when the API reports an error", async () => {
    getHonorGroupsByRegionList.mockResolvedValue({ error: new Error("master api unavailable") });

    const result = (await runLoad("tw", "?page=4")) as unknown as HonorPageLoadResult;

    await expect(result.catalogue).resolves.toEqual({
      items: [],
      pagination: { page: 4, pageSize: 12, hasNext: false, total: null, totalPages: null },
      loadFailed: true
    });
    expect(getHonorGroupsByRegionList).toHaveBeenCalledTimes(1);
  });

  it("returns a failed empty page when the API request throws", async () => {
    getHonorGroupsByRegionList.mockRejectedValue(new Error("master api unavailable"));

    const result = (await runLoad("tw")) as unknown as HonorPageLoadResult;

    await expect(result.catalogue).resolves.toMatchObject({ items: [], loadFailed: true });
    expect(getHonorGroupsByRegionList).toHaveBeenCalledTimes(1);
  });

  it("fails instead of accepting stale or inconsistent API pagination", async () => {
    getHonorGroupsByRegionList.mockResolvedValue({
      data: {
        items: Array.from({ length: PAGE_SIZE }, (_, index) => createHonorGroup(index + 1)),
        pagination: { page: 1, page_size: PAGE_SIZE, total: 48, total_pages: 2, has_next: true }
      }
    });

    const staleResult = (await runLoad("jp", "?page=2")) as unknown as HonorPageLoadResult;
    await expect(staleResult.catalogue).resolves.toMatchObject({ items: [], loadFailed: true });

    getHonorGroupsByRegionList.mockReset();
    getHonorGroupsByRegionList.mockResolvedValue({
      data: {
        items: Array.from({ length: PAGE_SIZE }, (_, index) => createHonorGroup(index + 1)),
        pagination: { page: 1, page_size: PAGE_SIZE, total: 48, total_pages: 2, has_next: false }
      }
    });

    const inconsistentResult = (await runLoad("jp")) as unknown as HonorPageLoadResult;
    await expect(inconsistentResult.catalogue).resolves.toMatchObject({
      items: [],
      loadFailed: true
    });
  });

  it("fails safely for an out-of-range page without fetching a replacement page", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(createHonorGroupResponse(56, 660));

    const result = (await runLoad("jp", "?page=56")) as unknown as HonorPageLoadResult;

    await expect(result.catalogue).resolves.toEqual({
      items: [],
      pagination: { page: 56, pageSize: 12, hasNext: false, total: null, totalPages: null },
      loadFailed: true
    });
    expect(getHonorGroupsByRegionList).toHaveBeenCalledTimes(1);
    expect(getHonorGroupsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "jp" },
      query: { page: 56, page_size: 12 }
    });
  });
});
