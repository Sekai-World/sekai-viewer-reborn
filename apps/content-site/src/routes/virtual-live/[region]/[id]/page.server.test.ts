import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMusicsByRegionById,
  getMusicsByRegionByIdDetail,
  getMusicsRegionsByIdAvailability,
  getVirtualLivesByRegionById,
  getVirtualLivesByRegionByIdSchedules,
  getVirtualLivesByRegionByIdSetlists,
  getVirtualLivesRegionsByIdAvailability
} = vi.hoisted(() => ({
  getMusicsByRegionById: vi.fn(),
  getMusicsByRegionByIdDetail: vi.fn(),
  getMusicsRegionsByIdAvailability: vi.fn(),
  getVirtualLivesByRegionById: vi.fn(),
  getVirtualLivesByRegionByIdSchedules: vi.fn(),
  getVirtualLivesByRegionByIdSetlists: vi.fn(),
  getVirtualLivesRegionsByIdAvailability: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getMusicsByRegionById,
  getMusicsByRegionByIdDetail,
  getMusicsRegionsByIdAvailability,
  getVirtualLivesByRegionById,
  getVirtualLivesByRegionByIdSchedules,
  getVirtualLivesByRegionByIdSetlists,
  getVirtualLivesRegionsByIdAvailability
}));

const { getMusicAssetServer } = vi.hoisted(() => ({ getMusicAssetServer: vi.fn() }));
vi.mock("$lib/assets/index", () => ({ getMusicAssetServer }));

const { getServerI18nText } = vi.hoisted(() => ({ getServerI18nText: vi.fn() }));
vi.mock("$lib/i18n/runtime", () => ({ getServerI18nText }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { aggregateGameCharacterUnitsByRegion } = vi.hoisted(() => ({
  aggregateGameCharacterUnitsByRegion: vi.fn()
}));
vi.mock("$lib/server/character-pages", () => ({ aggregateGameCharacterUnitsByRegion }));

const {
  buildCharacterUnitEnrichmentMap,
  enrichVirtualLiveCharacters,
  parseVirtualLiveDetail,
  parseVirtualLiveSetlistItems
} = vi.hoisted(() => ({
  buildCharacterUnitEnrichmentMap: vi.fn(),
  enrichVirtualLiveCharacters: vi.fn(),
  parseVirtualLiveDetail: vi.fn(),
  parseVirtualLiveSetlistItems: vi.fn()
}));
vi.mock("$lib/server/virtual-live-detail", () => ({
  buildCharacterUnitEnrichmentMap,
  enrichVirtualLiveCharacters,
  parseVirtualLiveDetail,
  parseVirtualLiveSetlistItems
}));

const { parseMusicDetail } = vi.hoisted(() => ({ parseMusicDetail: vi.fn() }));
vi.mock("$lib/server/music-detail", () => ({ parseMusicDetail }));

import { load } from "./+page.server";

const messages = {
  invalidVirtualLiveId: "Invalid virtual live id",
  virtualLiveUnavailableInCurrentRegion: "Virtual live unavailable",
  failedToLoadVirtualLiveData: "Failed to load virtual live data"
} as const;

type VirtualLivePageLoadResult = {
  region: string;
  virtualLivePayload: Promise<{
    virtualLive: null;
    debugVirtualLiveJson: null;
    error: string | null;
  }>;
};

const runLoad = (region: string, id: string) =>
  load({
    params: { region, id },
    cookies: { get: () => undefined },
    fetch: vi.fn()
  } as unknown as Parameters<typeof load>[0]);

describe("virtual live detail page load", () => {
  beforeEach(() => {
    getMusicsByRegionById.mockReset();
    getMusicsByRegionByIdDetail.mockReset();
    getMusicsRegionsByIdAvailability.mockReset();
    getVirtualLivesByRegionById.mockReset();
    getVirtualLivesByRegionByIdSchedules.mockReset();
    getVirtualLivesByRegionByIdSetlists.mockReset();
    getVirtualLivesRegionsByIdAvailability.mockReset();
    getVirtualLivesByRegionByIdSchedules.mockResolvedValue({ data: { items: [] } });
    getVirtualLivesByRegionByIdSetlists.mockResolvedValue({ data: { items: [] } });
    getVirtualLivesRegionsByIdAvailability.mockResolvedValue({ data: ["jp"] });
    getServerI18nText.mockReset();
    getServerI18nText.mockImplementation((_locale, key) =>
      Promise.resolve(messages[key as keyof typeof messages])
    );
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    aggregateGameCharacterUnitsByRegion.mockReset();
    aggregateGameCharacterUnitsByRegion.mockResolvedValue({
      data: { items: [] },
      loadFailed: false
    });
    getMusicAssetServer.mockReset();
    getMusicAssetServer.mockReturnValue("jp");
    buildCharacterUnitEnrichmentMap.mockReset();
    enrichVirtualLiveCharacters.mockReset();
    parseVirtualLiveDetail.mockReset();
    parseVirtualLiveSetlistItems.mockReset();
    parseMusicDetail.mockReset();
  });

  it("preserves the invalid-id message and normalizes an unknown region", async () => {
    const result = (await runLoad("invalid", "   ")) as VirtualLivePageLoadResult;

    expect(result.region).toBe("jp");
    await expect(result.virtualLivePayload).resolves.toEqual({
      virtualLive: null,
      debugVirtualLiveJson: null,
      error: messages.invalidVirtualLiveId
    });
    expect(getVirtualLivesByRegionById).not.toHaveBeenCalled();
  });

  it.each(["error response", "request rejection"] as const)(
    "returns the failed-load message after a detail API %s",
    async (failureMode) => {
      if (failureMode === "error response") {
        getVirtualLivesByRegionById.mockResolvedValue({ error: new Error("upstream failure") });
      } else {
        getVirtualLivesByRegionById.mockRejectedValue(new Error("network failure"));
      }

      const result = (await runLoad("invalid", "virtual-live-1")) as VirtualLivePageLoadResult;

      expect(result.region).toBe("jp");
      await expect(result.virtualLivePayload).resolves.toEqual({
        virtualLive: null,
        debugVirtualLiveJson: null,
        error: messages.failedToLoadVirtualLiveData
      });
      expect(getVirtualLivesByRegionById).toHaveBeenCalledWith({
        baseUrl: "https://master-api.test",
        path: { region: "jp", id: "virtual-live-1" }
      });
    }
  );
});
