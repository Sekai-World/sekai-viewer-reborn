import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { fetchMissionCharacterOptions } = vi.hoisted(() => ({
  fetchMissionCharacterOptions: vi.fn()
}));
vi.mock("$lib/server/mission-characters", () => ({ fetchMissionCharacterOptions }));

import { GET } from "./+server";

const runGet = (region: string) =>
  GET({ params: { region } } as unknown as Parameters<typeof GET>[0]);

describe("mission character list endpoint", () => {
  beforeEach(() => {
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchMissionCharacterOptions.mockReset();
  });

  it("returns the characters of a normalized region", async () => {
    const items = [{ id: 1, name: "Ichika Hoshino", unit: "light_sound", unitName: "Leo/need" }];
    fetchMissionCharacterOptions.mockResolvedValue(items);

    const response = await runGet("invalid");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items });
    expect(fetchMissionCharacterOptions).toHaveBeenCalledWith("https://master-api.test", "jp");
  });

  it("returns a server error when the characters cannot be loaded", async () => {
    fetchMissionCharacterOptions.mockRejectedValue(new Error("master api unavailable"));

    const response = await runGet("tw");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: true });
  });
});
