import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCardsByRegionBatch, getGachasByRegionById, getMasterApiBaseUrl, getSecureRandomUnit } =
  vi.hoisted(() => ({
    getCardsByRegionBatch: vi.fn(),
    getGachasByRegionById: vi.fn(),
    getMasterApiBaseUrl: vi.fn(() => "https://master-api.test"),
    getSecureRandomUnit: vi.fn()
  }));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCardsByRegionBatch,
  getGachasByRegionById
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));
vi.mock("$lib/server/secure-random", () => ({ getSecureRandomUnit }));

import { POST } from "./+server";

const createRequest = (body: unknown): Request =>
  new Request("http://localhost/api/gacha/jp/gacha-1/pull", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });

const createInvalidJsonRequest = (): Request =>
  new Request("http://localhost/api/gacha/jp/gacha-1/pull", {
    method: "POST",
    body: "not-json",
    headers: { "content-type": "application/json" }
  });

const postPull = (request: Request, id = "gacha-1") =>
  POST({
    params: { region: "jp", id },
    request
  } as Parameters<typeof POST>[0]);

describe("gacha pull endpoint", () => {
  beforeEach(() => {
    getCardsByRegionBatch.mockReset();
    getGachasByRegionById.mockReset();
    getSecureRandomUnit.mockReset();
    getSecureRandomUnit.mockReturnValue(0);
    getCardsByRegionBatch.mockResolvedValue({
      data: {
        items: [
          {
            id: "card-1",
            prefix: "Card 1",
            cardRarity: { cardRarityType: "rarity_3" },
            initialSpecialTrainingStatus: "done"
          },
          { id: "card-2", prefix: "Card 2", cardRarity: { cardRarityType: "rarity_3" } }
        ]
      }
    });
    getGachasByRegionById.mockResolvedValue({
      data: {
        id: "gacha-1",
        gachaCardRarityRates: [{ cardRarityType: "rarity_3", rate: 100 }],
        gachaDetails: [
          { cardId: "card-1", weight: 1, isWish: false },
          { cardId: "card-2", weight: 1, isWish: false }
        ],
        gachaBehaviors: []
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects rarity pools with zero or negative total weights", async () => {
    for (const weights of [
      [0, 0],
      [-1, 0]
    ]) {
      getGachasByRegionById.mockResolvedValueOnce({
        data: {
          id: "gacha-1",
          gachaCardRarityRates: [{ cardRarityType: "rarity_3", rate: 100 }],
          gachaDetails: weights.map((weight, index) => ({
            cardId: `card-${index + 1}`,
            weight,
            isWish: false
          })),
          gachaBehaviors: []
        }
      });

      const response = await postPull(createRequest({}));

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({ error: "no_valid_rarity_pool" });
    }
  });

  it("rejects missing ids, invalid JSON, and malformed gacha responses", async () => {
    const missingIdResponse = await postPull(createRequest({}), "  ");
    expect(missingIdResponse.status).toBe(400);
    await expect(missingIdResponse.json()).resolves.toEqual({ error: "missing_gacha_id" });

    const invalidJsonResponse = await postPull(createInvalidJsonRequest());
    expect(invalidJsonResponse.status).toBe(400);
    await expect(invalidJsonResponse.json()).resolves.toEqual({ error: "invalid_json" });

    getGachasByRegionById.mockResolvedValueOnce({ error: { status: 404 } });
    const notFoundResponse = await postPull(createRequest({}));
    expect(notFoundResponse.status).toBe(404);
    await expect(notFoundResponse.json()).resolves.toEqual({ error: "gacha_not_found" });

    getGachasByRegionById.mockResolvedValueOnce({ data: {} });
    const parseFailedResponse = await postPull(createRequest({}));
    expect(parseFailedResponse.status).toBe(500);
    await expect(parseFailedResponse.json()).resolves.toEqual({ error: "gacha_parse_failed" });
  });

  it("rejects empty detail pools and pools without card ids", async () => {
    getGachasByRegionById.mockResolvedValueOnce({ data: { id: "gacha-1", gachaDetails: [] } });
    const emptyPoolResponse = await postPull(createRequest({}));
    expect(emptyPoolResponse.status).toBe(422);
    await expect(emptyPoolResponse.json()).resolves.toEqual({ error: "empty_pool" });

    getGachasByRegionById.mockResolvedValueOnce({
      data: { id: "gacha-1", gachaDetails: [{ cardId: "  ", weight: 1 }] }
    });
    const missingCardIdResponse = await postPull(createRequest({}));
    expect(missingCardIdResponse.status).toBe(422);
    await expect(missingCardIdResponse.json()).resolves.toEqual({ error: "empty_pool" });
  });

  it("uses the first valid pool when rarity rates do not cover a roll", async () => {
    getGachasByRegionById.mockResolvedValueOnce({
      data: {
        id: "gacha-1",
        gachaCardRarityRates: [{ cardRarityType: "rarity_3", rate: 50 }],
        gachaDetails: [{ cardId: "card-1", weight: 1, isWish: false }],
        gachaBehaviors: []
      }
    });
    getSecureRandomUnit.mockReturnValueOnce(0.999).mockReturnValueOnce(0);

    const response = await postPull(createRequest({}));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{ cardId: "card-1", title: "Card 1", initialSpecialTrainingStatus: "done" }]
    });
  });

  it("parses string rarity rates and asserts the upstream and random boundaries", async () => {
    getGachasByRegionById.mockResolvedValueOnce({
      data: {
        id: "gacha-1",
        gachaCardRarityRates: [{ cardRarityType: "rarity_3", rate: "100" }],
        gachaDetails: [{ cardId: "card-1", weight: 1, isWish: false }],
        gachaBehaviors: []
      }
    });

    const response = await postPull(createRequest({}));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{ cardId: "card-1", title: "Card 1" }]
    });
    expect(getGachasByRegionById).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "jp", id: "gacha-1" }
    });
    expect(getCardsByRegionBatch).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "jp" },
      query: { ids: "card-1" }
    });
    expect(getSecureRandomUnit).toHaveBeenCalledTimes(2);
  });

  it("selects the final weighted card when earlier weights do not reach the roll", async () => {
    getGachasByRegionById.mockResolvedValueOnce({
      data: {
        id: "gacha-1",
        gachaCardRarityRates: [{ cardRarityType: "rarity_3", rate: 100 }],
        gachaDetails: [
          { cardId: "card-1", weight: 1, isWish: false },
          { cardId: "card-2", weight: 3, isWish: false }
        ],
        gachaBehaviors: []
      }
    });
    getSecureRandomUnit.mockReturnValueOnce(0).mockReturnValueOnce(0.999);

    const response = await postPull(createRequest({}));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{ cardId: "card-2", title: "Card 2" }]
    });
  });

  it("applies the ten-pull rarity guarantee after nine lower-rarity pulls", async () => {
    getCardsByRegionBatch.mockResolvedValueOnce({
      data: {
        items: [
          { id: "card-3", prefix: "Card 3", cardRarity: { cardRarityType: "rarity_3" } },
          { id: "card-4", prefix: "Card 4", cardRarity: { cardRarityType: "rarity_4" } }
        ]
      }
    });
    getGachasByRegionById.mockResolvedValueOnce({
      data: {
        id: "gacha-1",
        gachaCardRarityRates: [
          { cardRarityType: "rarity_3", rate: 90 },
          { cardRarityType: "rarity_4", rate: 10 }
        ],
        gachaDetails: [
          { cardId: "card-3", weight: 1, isWish: false },
          { cardId: "card-4", weight: 1, isWish: false }
        ],
        gachaBehaviors: [{ gachaBehaviorType: "over_rarity_4_once" }]
      }
    });
    getSecureRandomUnit.mockReturnValue(0);

    const response = await postPull(createRequest({ count: 10 }));
    const body = (await response.json()) as { results: { cardId: string }[] };

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(10);
    expect(body.results.at(-1)?.cardId).toBe("card-4");
    expect(getSecureRandomUnit).toHaveBeenCalledTimes(20);
  });

  it("returns a validation error when no rarity pool is usable", async () => {
    getGachasByRegionById.mockResolvedValueOnce({
      data: {
        id: "gacha-1",
        gachaCardRarityRates: [
          { cardRarityType: "rarity_4", rate: 100 },
          { cardRarityType: null, rate: 0 }
        ],
        gachaDetails: [{ cardId: "card-1", weight: 1, isWish: false }],
        gachaBehaviors: []
      }
    });

    const response = await postPull(createRequest({}));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "no_valid_rarity_pool" });
  });

  it("uses safe defaults for an omitted id and non-numeric pull count", async () => {
    const missingIdResponse = await POST({
      params: { region: "jp" },
      request: createRequest({ count: "ten" })
    } as Parameters<typeof POST>[0]);
    expect(missingIdResponse.status).toBe(400);
    await expect(missingIdResponse.json()).resolves.toEqual({ error: "missing_gacha_id" });

    const response = await postPull(createRequest({ count: "ten" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [{ cardId: expect.stringMatching(/^card-[12]$/) }]
    });
  });

  it("returns an internal error when the upstream request rejects", async () => {
    getGachasByRegionById.mockRejectedValueOnce(new Error("upstream unavailable"));

    const response = await postPull(createRequest({}));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "internal_error" });
  });
});
