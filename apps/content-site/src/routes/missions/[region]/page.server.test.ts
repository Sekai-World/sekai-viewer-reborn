import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMissionsByRegionList } = vi.hoisted(() => ({
  getMissionsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({ getMissionsByRegionList }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

import { load } from "./+page.server";
import { missionFamilies, type Mission, type MissionFamily } from "$lib/domain/mission";

type MissionPageLoadResult = {
  region: string;
  query: { family: MissionFamily | null };
  catalogue: Promise<{
    items: Mission[];
    familySummaries?: { family: MissionFamily; items: Mission[]; total: number | null }[];
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

type MissionRequest = {
  baseUrl: string;
  path: { region: string };
  query: {
    family: MissionFamily;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: string;
  };
};

const FAMILY_PAGE_SIZE = 8;

const runLoad = (region: string, search = "") =>
  load({
    params: { region },
    url: new URL(`http://localhost/missions/${region}${search}`)
  } as Parameters<typeof load>[0]);

const createMissionResponse = (family: MissionFamily, page: number, total: number) => {
  const pageCount = Math.ceil(total / FAMILY_PAGE_SIZE);
  const startIndex = (page - 1) * FAMILY_PAGE_SIZE;
  const itemCount = Math.max(0, Math.min(FAMILY_PAGE_SIZE, total - startIndex));
  const familyOffset = (missionFamilies.indexOf(family) + 1) * 100_000;

  return {
    data: {
      items: Array.from({ length: itemCount }, (_, index) => ({
        id: familyOffset + startIndex + index + 1
      })),
      pagination: {
        page,
        page_size: FAMILY_PAGE_SIZE,
        total,
        total_pages: pageCount,
        has_next: page < pageCount
      }
    }
  };
};

describe("mission catalogue page load", () => {
  beforeEach(() => {
    getMissionsByRegionList.mockReset();
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
  });

  it("loads one page for every default family and combines high-page metadata", async () => {
    const totals: Record<MissionFamily, number> = {
      storyMissions: 1600,
      characterMissionV2s: 1200,
      normalMissions: 272
    };
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      Promise.resolve(createMissionResponse(query.family, query.page ?? 1, totals[query.family]))
    );

    const result = (await runLoad("invalid")) as unknown as MissionPageLoadResult;
    const catalogue = await result.catalogue;

    expect(result.region).toBe("jp");
    expect(result.query).toEqual({ family: null });
    expect(catalogue).toMatchObject({
      loadFailed: false,
      pagination: {
        page: 1,
        pageSize: 24,
        hasNext: true,
        total: 3072,
        totalPages: 200
      }
    });
    expect(catalogue.items).toHaveLength(24);
    expect(catalogue.familySummaries).toEqual(
      missionFamilies.map((family) => ({ family, items: expect.any(Array), total: totals[family] }))
    );
    expect(catalogue.familySummaries?.every(({ items }) => items.length <= FAMILY_PAGE_SIZE)).toBe(
      true
    );
    expect(catalogue.items.map((mission) => mission.family)).toEqual(
      missionFamilies.flatMap((family) => Array.from({ length: FAMILY_PAGE_SIZE }, () => family))
    );

    expect(getMissionsByRegionList).toHaveBeenCalledTimes(3);
    expect(getMissionsByRegionList.mock.calls.map(([request]) => request)).toEqual(
      missionFamilies.map((family) => ({
        baseUrl: "https://master-api.test/api/v1",
        path: { region: "jp" },
        query: {
          family,
          page: 1,
          page_size: 8,
          sort_by: "seq",
          sort_order: "asc"
        }
      }))
    );
  });

  it("preserves one selected family from legacy query values and always starts at page one", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      Promise.resolve(createMissionResponse(query.family, query.page ?? 1, 20))
    );

    const result = (await runLoad(
      "tw",
      "?family=normalMissions,invalid&family=storyMissions,normalMissions&page=2"
    )) as unknown as MissionPageLoadResult;
    const catalogue = await result.catalogue;

    expect(result.query).toEqual({ family: "normalMissions" });
    expect(catalogue).toMatchObject({
      loadFailed: false,
      pagination: { page: 1, pageSize: 24, hasNext: true, total: 20, totalPages: 3 }
    });
    expect(catalogue.items).toHaveLength(8);
    expect(getMissionsByRegionList).toHaveBeenCalledTimes(1);
    expect(getMissionsByRegionList.mock.calls.map(([request]) => request.query)).toEqual([
      {
        family: "normalMissions",
        page: 1,
        page_size: 8,
        sort_by: "seq",
        sort_order: "asc"
      }
    ]);
  });

  it("ignores a legacy page query on the SSR route", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      Promise.resolve(createMissionResponse(query.family, query.page ?? 1, 8))
    );

    const result = (await runLoad(
      "jp",
      "?family=normalMissions&page=900"
    )) as unknown as MissionPageLoadResult;

    expect(result.query).toEqual({ family: "normalMissions" });
    await expect(result.catalogue).resolves.toMatchObject({
      loadFailed: false,
      pagination: { page: 1 }
    });
    expect(getMissionsByRegionList.mock.calls[0]?.[0].query.page).toBe(1);
  });

  it("deduplicates repeated missions within a selected family page", async () => {
    const response = createMissionResponse("normalMissions", 1, 8);
    response.data.items[1] = response.data.items[0];
    getMissionsByRegionList.mockResolvedValue(response);

    const result = (await runLoad(
      "jp",
      "?family=normalMissions"
    )) as unknown as MissionPageLoadResult;
    const catalogue = await result.catalogue;

    expect(catalogue.items).toHaveLength(7);
    expect(new Set(catalogue.items.map((mission) => mission.id)).size).toBe(7);
  });

  it("combines has-next with any family and total-pages with the largest family", async () => {
    const totals: Record<MissionFamily, number> = {
      storyMissions: 8,
      characterMissionV2s: 40,
      normalMissions: 18
    };
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      Promise.resolve(createMissionResponse(query.family, query.page ?? 1, totals[query.family]))
    );

    const result = (await runLoad("jp")) as unknown as MissionPageLoadResult;
    const catalogue = await result.catalogue;

    expect(catalogue.items).toHaveLength(24);
    expect(catalogue).toMatchObject({
      loadFailed: false,
      pagination: { page: 1, pageSize: 24, hasNext: true, total: 66, totalPages: 5 }
    });
    expect(catalogue.familySummaries?.map(({ total }) => total)).toEqual([8, 40, 18]);
  });

  it("keeps the combined total nullable when a family total cannot be derived", async () => {
    getMissionsByRegionList.mockImplementation(() =>
      Promise.resolve({
        data: {
          items: Array.from({ length: FAMILY_PAGE_SIZE }, (_, index) => ({ id: index + 1 })),
          pagination: { page: 1, page_size: 8, total_pages: 4, has_next: true }
        }
      })
    );

    const result = (await runLoad("jp")) as unknown as MissionPageLoadResult;

    await expect(result.catalogue).resolves.toMatchObject({
      loadFailed: false,
      pagination: { page: 1, pageSize: 24, hasNext: true, total: null, totalPages: 4 }
    });
    await expect(result.catalogue).resolves.toMatchObject({
      familySummaries: missionFamilies.map((family) => ({
        family,
        total: null
      }))
    });
  });

  it("fails the whole page when any selected family returns an API error", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      query.family === "characterMissionV2s"
        ? Promise.resolve({ error: new Error("family unavailable") })
        : Promise.resolve(createMissionResponse(query.family, 1, 8))
    );

    const result = (await runLoad("jp")) as unknown as MissionPageLoadResult;

    await expect(result.catalogue).resolves.toEqual({
      ...{
        items: [],
        familySummaries: [],
        pagination: { page: 1, pageSize: 24, hasNext: false, total: null, totalPages: null }
      },
      loadFailed: true
    });
    expect(getMissionsByRegionList).toHaveBeenCalledTimes(3);
  });

  it("fails the whole page when a selected family throws", async () => {
    getMissionsByRegionList.mockRejectedValue(new Error("master api unavailable"));

    const result = (await runLoad(
      "jp",
      "?family=normalMissions"
    )) as unknown as MissionPageLoadResult;

    await expect(result.catalogue).resolves.toMatchObject({ items: [], loadFailed: true });
    expect(getMissionsByRegionList).toHaveBeenCalledTimes(1);
  });

  it("fails instead of accepting inconsistent API pagination", async () => {
    getMissionsByRegionList.mockResolvedValue({
      data: {
        items: Array.from({ length: FAMILY_PAGE_SIZE }, (_, index) => ({ id: index + 1 })),
        pagination: { page: 1, page_size: 8, total: 24, total_pages: 3, has_next: false }
      }
    });

    const inconsistentResult = (await runLoad(
      "jp",
      "?family=normalMissions"
    )) as unknown as MissionPageLoadResult;
    await expect(inconsistentResult.catalogue).resolves.toMatchObject({
      items: [],
      loadFailed: true
    });
  });
});
