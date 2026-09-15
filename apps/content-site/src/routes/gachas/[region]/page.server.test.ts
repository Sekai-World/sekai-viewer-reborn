import { beforeEach, describe, expect, it, vi } from "vitest";

const { getGachasByRegionList } = vi.hoisted(() => ({
  getGachasByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({ getGachasByRegionList }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

import { load } from "./+page.server";
import type { GachaListPage, GachaListQueryState } from "$lib/server/gacha-list";

type GachaPageLoadResult = {
  region: string;
  initialPage: Promise<{ page: GachaListPage; loadFailed: boolean }>;
  initialQuery: GachaListQueryState;
};

const emptyResponse = {
  data: {
    items: [],
    pagination: { page: 1, page_size: 20, total: 0, total_pages: 0, has_next: false }
  }
};

const runLoad = (region: string, search = "") =>
  load({
    params: { region },
    url: new URL(`http://localhost/gachas/${region}${search}`)
  } as Parameters<typeof load>[0]);

describe("gacha list page load", () => {
  beforeEach(() => {
    getGachasByRegionList.mockReset();
    getGachasByRegionList.mockResolvedValue(emptyResponse);
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
  });

  it("passes ongoing=true to the SSR request when selected", async () => {
    const result = (await runLoad(
      "tw",
      "?ongoing=true&sort_by=id&sort_order=asc&spoiler=true"
    )) as unknown as GachaPageLoadResult;

    expect(result.region).toBe("tw");
    expect(result.initialQuery).toEqual({
      sortBy: "id",
      sortOrder: "asc",
      spoiler: true,
      ongoing: true
    });
    await expect(result.initialPage).resolves.toMatchObject({ loadFailed: false });
    expect(getGachasByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "tw" },
      query: {
        page: 1,
        page_size: 20,
        spoiler: true,
        ongoing: true,
        sort_by: "id",
        sort_order: "asc"
      }
    });
  });

  it("omits ongoing for invalid query values and keeps the default request", async () => {
    const result = (await runLoad("jp", "?ongoing=1")) as unknown as GachaPageLoadResult;

    expect(result.initialQuery.ongoing).toBe(false);
    await expect(result.initialPage).resolves.toMatchObject({ loadFailed: false });
    const request = getGachasByRegionList.mock.calls[0]?.[0] as {
      query: Record<string, unknown>;
    };
    expect(request.query).toEqual({
      page: 1,
      page_size: 20,
      spoiler: false,
      sort_by: "startAt",
      sort_order: "desc"
    });
  });
});
