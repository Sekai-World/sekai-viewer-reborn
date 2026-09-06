import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCardsByRegionById, getGachasByRegionById, getGachasRegionsByIdAvailability } =
  vi.hoisted(() => ({
    getCardsByRegionById: vi.fn(),
    getGachasByRegionById: vi.fn(),
    getGachasRegionsByIdAvailability: vi.fn()
  }));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCardsByRegionById,
  getGachasByRegionById,
  getGachasRegionsByIdAvailability
}));

const { getServerI18nText } = vi.hoisted(() => ({ getServerI18nText: vi.fn() }));
vi.mock("$lib/i18n/runtime", () => ({ getServerI18nText }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

import { load } from "./+page.server";

describe("gacha detail page load", () => {
  beforeEach(() => {
    getCardsByRegionById.mockReset();
    getGachasByRegionById.mockReset();
    getGachasRegionsByIdAvailability.mockReset();
    getServerI18nText.mockResolvedValue("translated");
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
  });

  it("preserves special-training metadata on pickup cards", async () => {
    getGachasByRegionById.mockResolvedValue({
      data: {
        id: "gacha-1",
        gachaPickups: [{ cardId: "card-1", weight: 1 }]
      }
    });
    getGachasRegionsByIdAvailability.mockResolvedValue({ data: ["jp"] });
    getCardsByRegionById.mockResolvedValue({
      data: {
        id: "card-1",
        prefix: "Trained pickup",
        assetbundleName: "trained_pickup",
        attr: "cute",
        cardRarity: { cardRarityType: "rarity_4" },
        initialSpecialTrainingStatus: "done"
      }
    });

    const result = (await load({
      params: { region: "jp", id: "gacha-1" },
      cookies: { get: () => undefined },
      fetch: vi.fn()
    } as unknown as Parameters<typeof load>[0])) as {
      gachaPayload: Promise<{
        pickupCards: {
          cardId: string | null;
          initialSpecialTrainingStatus: string | null;
        }[];
      }>;
    };

    const payload = await result.gachaPayload;
    expect(payload.pickupCards).toEqual([
      expect.objectContaining({ cardId: "card-1", initialSpecialTrainingStatus: "done" })
    ]);
  });
});
