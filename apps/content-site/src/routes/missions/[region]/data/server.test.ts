import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MissionFamily } from "$lib/domain/mission";

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { fetchMissionListPage, parseMissionFamily } = vi.hoisted(() => ({
  fetchMissionListPage: vi.fn(),
  parseMissionFamily: vi.fn()
}));
vi.mock("$lib/server/mission-list", () => ({ fetchMissionListPage, parseMissionFamily }));

import { GET } from "./+server";

type MissionPage = {
  items: { id: number; family: MissionFamily }[];
  pagination: { page: number; hasNext: boolean };
};

const runGet = (region: string, search = "") =>
  GET({
    params: { region },
    url: new URL(`http://localhost/missions/${region}/data${search}`)
  } as Parameters<typeof GET>[0]);

const page: MissionPage = {
  items: [{ id: 101, family: "normalMissions" }],
  pagination: { page: 2, hasNext: true }
};

describe("mission list data endpoint", () => {
  beforeEach(() => {
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchMissionListPage.mockReset();
    parseMissionFamily.mockReset();
    parseMissionFamily.mockReturnValue(null);
  });

  it("returns the next all-family page with a normalized region and page", async () => {
    fetchMissionListPage.mockResolvedValue(page);

    const response = await runGet("invalid", "?page=2");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(page);
    expect(fetchMissionListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      undefined,
      2
    );
  });

  it("passes the selected family to the paginated adapter", async () => {
    parseMissionFamily.mockReturnValue("storyMissions");
    fetchMissionListPage.mockResolvedValue(page);

    const response = await runGet("tw", "?family=storyMissions&page=3");

    expect(response.status).toBe(200);
    expect(fetchMissionListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "tw",
      ["storyMissions"],
      3
    );
  });

  it.each(["", "?page=0", "?page=-1", "?page=invalid", "?page=9007199254740992"])(
    "normalizes invalid page query %s to page one",
    async (search) => {
      fetchMissionListPage.mockResolvedValue(page);

      const response = await runGet("jp", search);

      expect(response.status).toBe(200);
      expect(fetchMissionListPage).toHaveBeenCalledWith(
        "https://master-api.test",
        "jp",
        undefined,
        1
      );
    }
  );

  it("returns a server error when the next page cannot be loaded", async () => {
    fetchMissionListPage.mockRejectedValueOnce(new Error("upstream unavailable"));

    const response = await runGet("jp", "?page=2");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: true });
  });
});
