import { describe, expect, it, vi } from "vitest";

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));

vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

import { load } from "./+page.server";

type CharacterPageData = {
  region: string;
  characterId: string;
  payload: Promise<{ character: null; loadFailed: boolean }>;
  availableRegions: Promise<string[]>;
};

describe("character detail page load", () => {
  it("returns the normalized region with empty character state without requiring layout i18n inputs", async () => {
    const result = (await load({
      params: { region: "invalid", id: "   " }
    } as Parameters<typeof load>[0])) as CharacterPageData;

    expect(result.region).toBe("jp");
    expect(result.characterId).toBe("");
    await expect(result.payload).resolves.toEqual({ character: null, loadFailed: false });
    await expect(result.availableRegions).resolves.toEqual(["jp"]);
    expect(getMasterApiBaseUrl).toHaveBeenCalledOnce();
  });
});
