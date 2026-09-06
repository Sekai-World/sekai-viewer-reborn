import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GachaCardRarityRate, GachaDetail, GachaDetailSub } from "$lib/domain/gacha-detail";

const { getCardsByRegionBatch, getGachasByRegionById, getGachasByRegionByIdRateChoiceWishes } =
  vi.hoisted(() => ({
    getCardsByRegionBatch: vi.fn(),
    getGachasByRegionById: vi.fn(),
    getGachasByRegionByIdRateChoiceWishes: vi.fn()
  }));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCardsByRegionBatch,
  getGachasByRegionById,
  getGachasByRegionByIdRateChoiceWishes
}));

import {
  buildGachaProbabilityPayload,
  loadGachaProbabilityPayload
} from "./gacha-probability";

const createGacha = (overrides: Partial<GachaDetail> = {}): GachaDetail => ({
  id: "gacha-default",
  gachaType: null,
  name: null,
  assetBundleName: null,
  summary: null,
  startAt: null,
  endAt: null,
  costResourceType: null,
  costResourceId: null,
  costCount: null,
  gachaPickups: [],
  gachaCardRarityRates: [
    { cardRarityType: "rarity_4", rate: 100, lotteryType: "normal" }
  ],
  gachaBehaviors: [],
  gachaDetails: [{ cardId: "card-1", weight: 1, isWish: false }],
  gachaInformation: null,
  gachaCeilItemId: null,
  wishFixedSelectCount: null,
  wishLimitedSelectCount: null,
  wishSelectCount: null,
  isShowPeriod: null,
  ...overrides
});

const createRawGacha = (gacha: GachaDetail): Record<string, unknown> => ({
  id: gacha.id,
  gachaCardRarityRates: gacha.gachaCardRarityRates,
  gachaBehaviors: gacha.gachaBehaviors,
  gachaDetails: gacha.gachaDetails,
  wishSelectCount: gacha.wishSelectCount
});

const createDetails = (details: GachaDetailSub[]): GachaDetailSub[] => details;

const createRates = (rates: GachaCardRarityRate[]): GachaCardRarityRate[] => rates;

const mockCardMetadata = (items: unknown[]): void => {
  getCardsByRegionBatch.mockResolvedValue({ data: { items } });
};

const createCard = (
  id: string | number,
  rarityType = "rarity_4",
  initialSpecialTrainingStatus: string | null = null
): Record<string, unknown> => ({
  id,
  prefix: " Card title ",
  assetBundleName: "card_asset",
  attribute: "cute",
  cardRarityType: rarityType,
  initialSpecialTrainingStatus
});

describe("gacha probability server data", () => {
  beforeEach(() => {
    getCardsByRegionBatch.mockReset();
    getGachasByRegionById.mockReset();
    getGachasByRegionByIdRateChoiceWishes.mockReset();
  });

  it("builds normal probabilities from batched card metadata", async () => {
    mockCardMetadata([null, createCard(1, "rarity_4", "done"), createCard("unrequested")]);

    const payload = await buildGachaProbabilityPayload({
      baseUrl: "https://master-api.test",
      region: "jp",
      gacha: createGacha({
        id: "normal-probabilities",
        gachaDetails: createDetails([
          { cardId: "1", weight: 1, isWish: false },
          { cardId: "1", weight: 2, isWish: false }
        ])
      }),
      rateChoiceWishes: null
    });

    expect(payload.cards).toHaveLength(1);
    expect(payload.cards[0]).toMatchObject({
      cardId: "1",
      weight: 3,
      title: "Card title",
      assetBundleName: "card_asset",
      attr: "cute",
      rarityType: "rarity_4",
      initialSpecialTrainingStatus: "done",
      probability: 100,
      probabilityByLotteryType: { normal: 100 },
      diagnostic: "none"
    });
  });

  it("keeps probability diagnostics when metadata or rates are invalid", async () => {
    getCardsByRegionBatch.mockResolvedValue({ error: { status: 503 } });

    const incompletePayload = await buildGachaProbabilityPayload({
      baseUrl: "https://master-api.test",
      region: "jp",
      gacha: createGacha({
        id: "incomplete-metadata",
        gachaDetails: createDetails([
          { cardId: "missing", weight: 1, isWish: false },
          { cardId: null, weight: 0, isWish: true }
        ])
      }),
      rateChoiceWishes: null
    });

    expect(incompletePayload.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardId: "missing", diagnostic: "missing-card-rarity" }),
        expect.objectContaining({ cardId: null, diagnostic: "missing-card-id" })
      ])
    );

    getCardsByRegionBatch.mockRejectedValueOnce(new Error("metadata unavailable"));
    const rejectedMetadataPayload = await buildGachaProbabilityPayload({
      baseUrl: "https://master-api.test",
      region: "jp",
      gacha: createGacha({ id: "rejected-metadata" }),
      rateChoiceWishes: null
    });
    expect(rejectedMetadataPayload.cards[0]).toMatchObject({ diagnostic: "missing-card-rarity" });

    mockCardMetadata([createCard("invalid-rate")]);
    const invalidRatePayload = await buildGachaProbabilityPayload({
      baseUrl: "https://master-api.test",
      region: "jp",
      gacha: createGacha({
        id: "invalid-rate",
        gachaDetails: createDetails([{ cardId: "invalid-rate", weight: 1, isWish: false }]),
        gachaCardRarityRates: createRates([
          { cardRarityType: "rarity_4", rate: null, lotteryType: "normal" }
        ])
      }),
      rateChoiceWishes: null
    });
    expect(invalidRatePayload.cards[0]).toMatchObject({ diagnostic: "invalid-rate" });
  });

  it("applies valid rate-choice wish groups to conditional probabilities", async () => {
    mockCardMetadata([createCard("wish-1")]);
    const gacha = createGacha({
      id: "valid-rate-choice",
      gachaDetails: createDetails([{ cardId: "wish-1", weight: 1, isWish: true }]),
      gachaCardRarityRates: createRates([
        { cardRarityType: "rarity_4", rate: 100, lotteryType: "rate_choice_1" }
      ]),
      wishSelectCount: 1
    });

    const payload = await buildGachaProbabilityPayload({
      baseUrl: "https://master-api.test",
      region: "jp",
      gacha,
      rateChoiceWishes: {
        data: {
          gachaId: "valid-rate-choice",
          rateChoiceGachaWishGroupId: "group-1",
          items: [{ groupId: "group-1", lotteryType: "rate_choice_1", selectCount: 1 }]
        }
      }
    });

    expect(payload.cards[0]).toMatchObject({
      cardId: "wish-1",
      probability: null,
      probabilityByLotteryType: { rate_choice_1: 100 },
      probabilitySegments: [
        {
          lotteryType: "rate_choice_1",
          probability: 100,
          selectCount: 1,
          conditional: true
        }
      ],
      diagnostic: "none"
    });
  });

  it("reports invalid rate-choice configuration without inventing groups", async () => {
    mockCardMetadata([createCard("wish-invalid")]);
    const payload = await buildGachaProbabilityPayload({
      baseUrl: "https://master-api.test",
      region: "jp",
      gacha: createGacha({
        id: "invalid-rate-choice",
        gachaDetails: createDetails([{ cardId: "wish-invalid", weight: 1, isWish: true }]),
        gachaCardRarityRates: createRates([
          { cardRarityType: "rarity_4", rate: 100, lotteryType: "rate_choice_1" }
        ]),
        wishSelectCount: 1
      }),
      rateChoiceWishes: {
        data: {
          gachaId: "different-gacha",
          rateChoiceGachaWishGroupId: "group-1",
          items: [{ groupId: "group-1", lotteryType: "rate_choice_1", selectCount: 1 }]
        }
      }
    });

    expect(payload.cards[0]).toMatchObject({
      cardId: "wish-invalid",
      probabilitySegments: [],
      diagnostic: "invalid-rate-choice"
    });
  });

  it("loads and caches normal probability payloads", async () => {
    const gacha = createGacha({ id: "cached-probabilities" });
    mockCardMetadata([createCard("card-1")]);
    getGachasByRegionById.mockResolvedValue({ data: createRawGacha(gacha) });

    const args = {
      baseUrl: "https://master-api.test",
      region: "jp",
      gachaId: gacha.id
    };
    const first = await loadGachaProbabilityPayload(args);
    const second = await loadGachaProbabilityPayload(args);

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(getGachasByRegionById).toHaveBeenCalledOnce();
  });

  it("handles missing gacha data and rate-choice wish requests", async () => {
    getGachasByRegionById.mockResolvedValueOnce({ error: { status: 404 } });
    await expect(
      loadGachaProbabilityPayload({
        baseUrl: "https://master-api.test",
        region: "jp",
        gachaId: "missing-probabilities"
      })
    ).resolves.toBeNull();

    getGachasByRegionById.mockResolvedValueOnce({ data: {} });
    await expect(
      loadGachaProbabilityPayload({
        baseUrl: "https://master-api.test",
        region: "jp",
        gachaId: "malformed-probabilities"
      })
    ).resolves.toBeNull();

    const gacha = createGacha({
      id: "loaded-rate-choice",
      gachaDetails: [{ cardId: "wish-loaded", weight: 1, isWish: true }],
      gachaCardRarityRates: [
        { cardRarityType: "rarity_4", rate: 100, lotteryType: "rate_choice_1" }
      ],
      wishSelectCount: 1
    });
    mockCardMetadata([createCard("wish-loaded")]);
    getGachasByRegionById.mockResolvedValueOnce({ data: createRawGacha(gacha) });
    getGachasByRegionByIdRateChoiceWishes.mockResolvedValueOnce({
      data: {
        gachaId: gacha.id,
        rateChoiceGachaWishGroupId: "group-loaded",
        items: [{ groupId: "group-loaded", lotteryType: "rate_choice_1", selectCount: 1 }]
      }
    });

    const payload = await loadGachaProbabilityPayload({
      baseUrl: "https://master-api.test",
      region: "jp",
      gachaId: gacha.id
    });

    expect(payload?.cards[0]).toMatchObject({ diagnostic: "none" });
    expect(getGachasByRegionByIdRateChoiceWishes).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "jp", id: gacha.id }
    });

    getGachasByRegionById.mockResolvedValueOnce({ data: createRawGacha({ ...gacha, id: "failed-rate-choice" }) });
    getGachasByRegionByIdRateChoiceWishes.mockResolvedValueOnce({ error: { status: 503 } });
    await expect(
      loadGachaProbabilityPayload({
        baseUrl: "https://master-api.test",
        region: "jp",
        gachaId: "failed-rate-choice"
      })
    ).rejects.toThrow("Failed to load rate-choice gacha wishes.");
  });
});
