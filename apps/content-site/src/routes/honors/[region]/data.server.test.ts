import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHonorGroupsByRegionList } = vi.hoisted(() => ({
  getHonorGroupsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({ getHonorGroupsByRegionList }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

import { GET } from "./data/+server";

const response = {
  data: {
    items: [],
    availableHonorTypes: ["event"],
    pagination: { page: 2, page_size: 12, total: 12, total_pages: 2, has_next: false }
  }
};

describe("honor catalogue data endpoint", () => {
  beforeEach(() => {
    getHonorGroupsByRegionList.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
  });

  it("passes page, search, category, and ID order to the group endpoint", async () => {
    getHonorGroupsByRegionList.mockResolvedValue(response);

    const result = await GET({
      params: { region: "invalid" },
      url: new URL(
        "http://localhost/honors/invalid/data?page=2&name=%20Stage%20&honor_type=event&sort_by=id&sort_order=desc"
      )
    } as Parameters<typeof GET>[0]);

    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      items: [],
      pagination: { page: 2, hasNext: false }
    });
    expect(getHonorGroupsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "jp" },
      query: {
        page: 2,
        page_size: 12,
        name: "Stage",
        honor_type: "event",
        sort_by: "id",
        sort_order: "desc"
      }
    });
  });

  it("returns a generic server error when the upstream request fails", async () => {
    getHonorGroupsByRegionList.mockRejectedValue(new Error("unavailable"));

    const result = await GET({
      params: { region: "jp" },
      url: new URL("http://localhost/honors/jp/data?page=3")
    } as Parameters<typeof GET>[0]);

    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ error: true });
  });
});
