import { describe, expect, it, vi } from "vitest";

const { aggregateGameCharactersByRegion, aggregateGameCharacterUnitsByRegion, fetchUnitProfiles } =
  vi.hoisted(() => ({
    aggregateGameCharactersByRegion: vi.fn(),
    aggregateGameCharacterUnitsByRegion: vi.fn(),
    fetchUnitProfiles: vi.fn()
  }));

vi.mock("$lib/server/character-pages", () => ({
  aggregateGameCharactersByRegion,
  aggregateGameCharacterUnitsByRegion
}));
vi.mock("$lib/server/unit-profiles", () => ({ fetchUnitProfiles }));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl: () => "https://master-api.test" }));

import { load } from "./+page.server";

type CharacterCataloguePageData = {
  region: string;
  catalogue: Promise<{ items: unknown[]; unitProfiles: Record<string, string>; loadFailed: boolean }>;
};

describe("character catalogue page load", () => {
  it("returns a normalized region and deferred catalogue without page-level i18n inputs", async () => {
    aggregateGameCharactersByRegion.mockResolvedValue({ data: { items: [] }, loadFailed: false });
    aggregateGameCharacterUnitsByRegion.mockResolvedValue({ data: { items: [] }, loadFailed: false });
    fetchUnitProfiles.mockResolvedValue([]);

    const result = (await load({
      params: { region: "invalid" }
    } as Parameters<typeof load>[0])) as CharacterCataloguePageData;

    expect(result.region).toBe("jp");
    await expect(result.catalogue).resolves.toEqual({ items: [], unitProfiles: {}, loadFailed: false });
    expect(aggregateGameCharactersByRegion).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      "seq",
      "asc"
    );
  });
});
