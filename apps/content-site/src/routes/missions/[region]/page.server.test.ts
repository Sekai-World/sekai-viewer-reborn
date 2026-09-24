import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMissionsByRegionList } = vi.hoisted(() => ({
  getMissionsByRegionList: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({ getMissionsByRegionList }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { fetchMissionCharacterOptions } = vi.hoisted(() => ({
  fetchMissionCharacterOptions: vi.fn()
}));
vi.mock("$lib/server/mission-characters", () => ({ fetchMissionCharacterOptions }));

import { load } from "./+page.server";
import { missionFamilies, type Mission, type MissionFamily } from "$lib/domain/mission";

type CatalogueResult = {
  items: Mission[];
  loadFailed: boolean;
  pagination: {
    page: number;
    pageSize: number;
    hasNext: boolean;
    total: number | null;
    totalPages: number | null;
  };
};

type MissionPageLoadResult = {
  region: string;
  query: { family: MissionFamily | null; character: number | null };
  catalogue: Promise<CatalogueResult> | null;
  familyOverviews: {
    family: MissionFamily;
    summary: Promise<{ items: Mission[]; total: number | null; loadFailed: boolean }>;
  }[];
  storyMissions: Promise<{ items: Mission[]; loadFailed: boolean }> | null;
  characterOptions: Promise<{
    items: { id: number; name: string; unit: string | null; unitName: string | null }[];
    loadFailed: boolean;
  }> | null;
};

const resolveCatalogue = (result: MissionPageLoadResult): Promise<CatalogueResult> => {
  if (result.catalogue === null) throw new Error("expected a selected-family catalogue");
  return result.catalogue;
};

const resolveSummaries = (result: MissionPageLoadResult) =>
  Promise.all(
    result.familyOverviews.map(async ({ family, summary }) => ({ family, ...(await summary) }))
  );

type MissionRequest = {
  baseUrl: string;
  path: { region: string };
  query: {
    family: MissionFamily;
    character_id?: string;
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
    fetchMissionCharacterOptions.mockReset();
    fetchMissionCharacterOptions.mockResolvedValue([
      { id: 1, name: "Ichika Hoshino", unit: "light_sound", unitName: "Leo/need" }
    ]);
  });

  it("streams one first page for every default family separately", async () => {
    const totals: Record<MissionFamily, number> = {
      storyMissions: 1600,
      characterMissionV2s: 1200,
      normalMissions: 272
    };
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      Promise.resolve(createMissionResponse(query.family, query.page ?? 1, totals[query.family]))
    );

    const result = (await runLoad("invalid")) as unknown as MissionPageLoadResult;

    expect(result.region).toBe("jp");
    expect(result.query).toEqual({ family: null, character: null });
    expect(result.catalogue).toBeNull();
    expect(result.familyOverviews.map(({ family }) => family)).toEqual([...missionFamilies]);
    const summaries = await resolveSummaries(result);
    expect(summaries).toEqual(
      missionFamilies.map((family) => ({
        family,
        items: expect.any(Array),
        total: totals[family],
        loadFailed: false
      }))
    );
    for (const { family, items } of summaries) {
      expect(items).toHaveLength(FAMILY_PAGE_SIZE);
      expect(items.every((mission) => mission.family === family)).toBe(true);
    }

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

  it("does not hold finished families behind a slow family", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      query.family === "storyMissions"
        ? new Promise(() => {})
        : Promise.resolve(createMissionResponse(query.family, 1, 8))
    );

    const result = (await runLoad("jp")) as unknown as MissionPageLoadResult;
    const [, character, normal] = result.familyOverviews;

    await expect(character?.summary).resolves.toMatchObject({ total: 8, loadFailed: false });
    await expect(normal?.summary).resolves.toMatchObject({ total: 8, loadFailed: false });
  });

  it("loads the complete story mission ladder instead of a catalogue page", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) => {
      const page = query.page ?? 1;
      const items = Array.from({ length: page === 1 ? 100 : 20 }, (_, index) => ({
        id: (page - 1) * 100 + index + 1,
        requirement: ((page - 1) * 100 + index + 1) * 10,
        resourceBoxId: 1
      }));
      return Promise.resolve({
        data: {
          items,
          pagination: { page, page_size: 100, total: 120, total_pages: 2, has_next: page === 1 }
        }
      });
    });

    const result = (await runLoad(
      "jp",
      "?family=storyMissions"
    )) as unknown as MissionPageLoadResult;

    expect(result.query).toEqual({ family: "storyMissions", character: null });
    expect(result.catalogue).toBeNull();
    expect(result.familyOverviews).toEqual([]);
    const story = await result.storyMissions;
    expect(story?.loadFailed).toBe(false);
    expect(story?.items).toHaveLength(120);
    expect(story?.items.at(-1)).toMatchObject({ id: 120, requirement: 1200 });
    expect(getMissionsByRegionList.mock.calls.map(([request]) => request.query)).toEqual([
      { family: "storyMissions", page: 1, page_size: 100, sort_by: "id", sort_order: "asc" },
      { family: "storyMissions", page: 2, page_size: 100, sort_by: "id", sort_order: "asc" }
    ]);
  });

  it("keeps the story tab usable when the story ladder fails to load", async () => {
    getMissionsByRegionList.mockRejectedValue(new Error("master api unavailable"));

    const result = (await runLoad(
      "jp",
      "?family=storyMissions"
    )) as unknown as MissionPageLoadResult;

    await expect(result.storyMissions).resolves.toEqual({ items: [], loadFailed: true });
  });

  it("loads every normal mission at once from legacy query values", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) => {
      const page = query.page ?? 1;
      const items = Array.from({ length: page === 1 ? 100 : 20 }, (_, index) => ({
        id: (page - 1) * 100 + index + 1
      }));
      return Promise.resolve({
        data: {
          items,
          pagination: { page, page_size: 100, total: 120, total_pages: 2, has_next: page === 1 }
        }
      });
    });

    const result = (await runLoad(
      "tw",
      "?family=normalMissions,invalid&family=storyMissions,normalMissions&page=2"
    )) as unknown as MissionPageLoadResult;
    const catalogue = await resolveCatalogue(result);

    expect(result.query).toEqual({ family: "normalMissions", character: null });
    expect(result.familyOverviews).toEqual([]);
    expect(result.characterOptions).toBeNull();
    expect(catalogue).toMatchObject({ loadFailed: false, pagination: { hasNext: false } });
    expect(catalogue.items).toHaveLength(120);
    expect(getMissionsByRegionList.mock.calls.map(([request]) => request.query)).toEqual([
      { family: "normalMissions", page: 1, page_size: 100, sort_by: "seq", sort_order: "asc" },
      { family: "normalMissions", page: 2, page_size: 100, sort_by: "seq", sort_order: "asc" }
    ]);
  });

  it("shows only the character picker until a character is chosen", async () => {
    const result = (await runLoad(
      "jp",
      "?family=characterMissionV2s&character=abc"
    )) as unknown as MissionPageLoadResult;

    expect(result.query).toEqual({ family: "characterMissionV2s", character: null });
    expect(result.catalogue).toBeNull();
    expect(getMissionsByRegionList).not.toHaveBeenCalled();
    await expect(result.characterOptions).resolves.toEqual({
      items: [{ id: 1, name: "Ichika Hoshino", unit: "light_sound", unitName: "Leo/need" }],
      loadFailed: false
    });
    expect(fetchMissionCharacterOptions).toHaveBeenCalledWith("https://master-api.test", "jp");
  });

  it("keeps the picker retryable when characters fail to load", async () => {
    fetchMissionCharacterOptions.mockRejectedValue(new Error("master api unavailable"));

    const result = (await runLoad(
      "jp",
      "?family=characterMissionV2s"
    )) as unknown as MissionPageLoadResult;

    await expect(result.characterOptions).resolves.toEqual({ items: [], loadFailed: true });
  });

  it("pages the selected character's missions", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      Promise.resolve(createMissionResponse(query.family, query.page ?? 1, 20))
    );

    const result = (await runLoad(
      "jp",
      "?family=characterMissionV2s&character=3"
    )) as unknown as MissionPageLoadResult;
    const catalogue = await resolveCatalogue(result);

    expect(result.query).toEqual({ family: "characterMissionV2s", character: 3 });
    expect(catalogue).toMatchObject({
      loadFailed: false,
      pagination: { page: 1, pageSize: 24, hasNext: true, total: 20, totalPages: 3 }
    });
    expect(catalogue.items).toHaveLength(8);
    expect(getMissionsByRegionList.mock.calls.map(([request]) => request.query)).toEqual([
      {
        family: "characterMissionV2s",
        character_id: "3",
        page: 1,
        page_size: 8,
        sort_by: "seq",
        sort_order: "asc"
      }
    ]);
  });

  it("ignores the character query outside Character Missions", async () => {
    getMissionsByRegionList.mockResolvedValue({
      data: {
        items: [{ id: 1 }],
        pagination: { page: 1, page_size: 100, total: 1, total_pages: 1, has_next: false }
      }
    });

    const result = (await runLoad(
      "jp",
      "?family=normalMissions&character=3"
    )) as unknown as MissionPageLoadResult;

    expect(result.query).toEqual({ family: "normalMissions", character: null });
    await resolveCatalogue(result);
    expect(getMissionsByRegionList.mock.calls[0]?.[0].query).not.toHaveProperty("character_id");
  });

  it("ignores a legacy page query on the SSR route", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      Promise.resolve(createMissionResponse(query.family, query.page ?? 1, 8))
    );

    const result = (await runLoad(
      "jp",
      "?family=characterMissionV2s&character=1&page=900"
    )) as unknown as MissionPageLoadResult;

    expect(result.query).toEqual({ family: "characterMissionV2s", character: 1 });
    await expect(resolveCatalogue(result)).resolves.toMatchObject({
      loadFailed: false,
      pagination: { page: 1 }
    });
    expect(getMissionsByRegionList.mock.calls[0]?.[0].query.page).toBe(1);
  });

  it("deduplicates repeated missions within a selected family page", async () => {
    const response = createMissionResponse("characterMissionV2s", 1, 8);
    response.data.items[1] = response.data.items[0];
    getMissionsByRegionList.mockResolvedValue(response);

    const result = (await runLoad(
      "jp",
      "?family=characterMissionV2s&character=1"
    )) as unknown as MissionPageLoadResult;
    const catalogue = await resolveCatalogue(result);

    expect(catalogue.items).toHaveLength(7);
    expect(new Set(catalogue.items.map((mission) => mission.id)).size).toBe(7);
  });

  it("keeps a family total nullable when it cannot be derived", async () => {
    getMissionsByRegionList.mockImplementation(() =>
      Promise.resolve({
        data: {
          items: Array.from({ length: FAMILY_PAGE_SIZE }, (_, index) => ({ id: index + 1 })),
          pagination: { page: 1, page_size: 8, total_pages: 4, has_next: true }
        }
      })
    );

    const result = (await runLoad("jp")) as unknown as MissionPageLoadResult;

    await expect(resolveSummaries(result)).resolves.toEqual(
      missionFamilies.map((family) => ({
        family,
        items: expect.any(Array),
        total: null,
        loadFailed: false
      }))
    );
  });

  it("marks only the failing family as unavailable in the overview", async () => {
    getMissionsByRegionList.mockImplementation(({ query }: MissionRequest) =>
      query.family === "characterMissionV2s"
        ? Promise.resolve({ error: new Error("family unavailable") })
        : Promise.resolve(createMissionResponse(query.family, 1, 8))
    );

    const result = (await runLoad("jp")) as unknown as MissionPageLoadResult;

    await expect(resolveSummaries(result)).resolves.toEqual([
      { family: "storyMissions", items: expect.any(Array), total: 8, loadFailed: false },
      { family: "characterMissionV2s", items: [], total: null, loadFailed: true },
      { family: "normalMissions", items: expect.any(Array), total: 8, loadFailed: false }
    ]);
    expect(getMissionsByRegionList).toHaveBeenCalledTimes(3);
  });

  it("fails the whole page when a selected family throws", async () => {
    getMissionsByRegionList.mockRejectedValue(new Error("master api unavailable"));

    const result = (await runLoad(
      "jp",
      "?family=normalMissions"
    )) as unknown as MissionPageLoadResult;

    await expect(resolveCatalogue(result)).resolves.toMatchObject({ items: [], loadFailed: true });
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
      "?family=characterMissionV2s&character=1"
    )) as unknown as MissionPageLoadResult;
    await expect(resolveCatalogue(inconsistentResult)).resolves.toMatchObject({
      items: [],
      loadFailed: true
    });
  });
});
