import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDetail, EventRelatedData } from "$lib/domain/event-detail";

const {
  getEventsByRegionByIdDetail,
  getEventsByRegionByIdHonorBonuses,
  getEventsRegionsByIdAvailability
} = vi.hoisted(() => ({
  getEventsByRegionByIdDetail: vi.fn(),
  getEventsByRegionByIdHonorBonuses: vi.fn(),
  getEventsRegionsByIdAvailability: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getEventsByRegionByIdDetail,
  getEventsByRegionByIdHonorBonuses,
  getEventsRegionsByIdAvailability
}));

const { getServerI18nText } = vi.hoisted(() => ({ getServerI18nText: vi.fn() }));
vi.mock("$lib/i18n/runtime", () => ({ getServerI18nText }));

const { getMasterApiBaseUrl } = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test")
}));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

const { fetchUnitProfiles, toUnitProfileMap } = vi.hoisted(() => ({
  fetchUnitProfiles: vi.fn(),
  toUnitProfileMap: vi.fn()
}));
vi.mock("$lib/server/unit-profiles", () => ({ fetchUnitProfiles, toUnitProfileMap }));

import { load } from "./+page.server";

const messages = {
  invalidEventId: "Invalid event id",
  eventUnavailableInCurrentRegion: "Event unavailable",
  failedToLoadEventData: "Failed to load event data"
} as const;

type EventPageLoadResult = {
  region: string;
  eventPayload: Promise<{
    event: EventDetail | null;
    relatedData: EventRelatedData | null;
    debugEventJson: string | null;
    error: string | null;
  }>;
};

const runLoad = (region: string, id: string) =>
  load({
    params: { region, id },
    cookies: { get: () => undefined },
    fetch: vi.fn()
  } as unknown as Parameters<typeof load>[0]);

describe("event detail page load", () => {
  beforeEach(() => {
    getEventsByRegionByIdDetail.mockReset();
    getEventsByRegionByIdHonorBonuses.mockReset();
    getEventsRegionsByIdAvailability.mockReset();
    getEventsRegionsByIdAvailability.mockResolvedValue({ data: ["jp"] });
    getServerI18nText.mockReset();
    getServerI18nText.mockImplementation((_locale, key) =>
      Promise.resolve(messages[key as keyof typeof messages])
    );
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test");
    fetchUnitProfiles.mockReset();
    fetchUnitProfiles.mockResolvedValue([]);
    toUnitProfileMap.mockReset();
    toUnitProfileMap.mockReturnValue({});
  });

  it("preserves the invalid-id message and normalizes an unknown region", async () => {
    const result = (await runLoad("invalid", "   ")) as EventPageLoadResult;

    expect(result.region).toBe("jp");
    await expect(result.eventPayload).resolves.toEqual({
      event: null,
      relatedData: null,
      debugEventJson: null,
      error: messages.invalidEventId
    });
    expect(getEventsByRegionByIdDetail).not.toHaveBeenCalled();
  });

  it.each(["error response", "request rejection"] as const)(
    "returns the failed-load message after a detail API %s",
    async (failureMode) => {
      if (failureMode === "error response") {
        getEventsByRegionByIdDetail.mockResolvedValue({ error: new Error("upstream failure") });
      } else {
        getEventsByRegionByIdDetail.mockRejectedValue(new Error("network failure"));
      }

      const result = (await runLoad("invalid", "event-1")) as EventPageLoadResult;

      expect(result.region).toBe("jp");
      await expect(result.eventPayload).resolves.toEqual({
        event: null,
        relatedData: null,
        debugEventJson: null,
        error: messages.failedToLoadEventData
      });
      expect(getEventsByRegionByIdDetail).toHaveBeenCalledWith({
        baseUrl: "https://master-api.test",
        path: { region: "jp", id: "event-1" }
      });
    }
  );
  it("does not report an error when the detail API succeeds", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({ data: {} });

    const result = (await runLoad("jp", "event-1")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toEqual({
      event: null,
      relatedData: null,
      debugEventJson: null,
      error: null
    });
  });

  it("replaces aggregate honor bonus stubs with the read-only enriched response", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: { id: 123, name: "Event" },
        bonuses: {
          eventHonorBonuses: [{ honorId: 42, bonusRate: 25 }]
        }
      }
    });
    getEventsByRegionByIdHonorBonuses.mockResolvedValue({
      data: {
        items: [
          {
            honorId: 42,
            bonusRate: 25,
            honor: {
              id: 42,
              name: "Event Honor",
              assetbundleName: "honor_bundle",
              group: {
                name: "Event Group",
                honorType: "rank_match",
                backgroundAssetbundleName: "group_background"
              }
            }
          }
        ]
      }
    });

    const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toMatchObject({
      error: null,
      event: { id: "123", title: "Event" },
      relatedData: {
        honorBonusesLoadFailed: false,
        bonuses: {
          honorBonusCount: 1,
          honorBonuses: [
            {
              honorId: 42,
              bonusRate: 25,
              honor: {
                id: 42,
                name: "Event Honor",
                assetBundleName: "honor_bundle",
                group: {
                  name: "Event Group",
                  honorType: "rank_match",
                  backgroundAssetBundleName: "group_background"
                }
              }
            }
          ]
        }
      }
    });
    expect(getEventsByRegionByIdHonorBonuses).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "tw", id: "event-123" }
    });
  });

  it.each(["error response", "request rejection"] as const)(
    "retains safe aggregate honor bonus data when enrichment has a %s",
    async (failureMode) => {
      getEventsByRegionByIdDetail.mockResolvedValue({
        data: {
          event: { id: 123, name: "Event" },
          bonuses: {
            eventHonorBonuses: [{ honorId: 42, bonusRate: 25 }]
          }
        }
      });
      if (failureMode === "error response") {
        getEventsByRegionByIdHonorBonuses.mockResolvedValue({
          error: new Error("upstream failure")
        });
      } else {
        getEventsByRegionByIdHonorBonuses.mockRejectedValue(new Error("network failure"));
      }

      const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

      await expect(result.eventPayload).resolves.toMatchObject({
        error: null,
        relatedData: {
          honorBonusesLoadFailed: true,
          bonuses: {
            honorBonusCount: 1,
            honorBonuses: [{ honorId: 42, bonusRate: 25, honor: null }]
          }
        }
      });
    }
  );

  it("does not request honor bonus enrichment when the aggregate reports no bonuses", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: { id: 123, name: "Event" },
        bonuses: { eventHonorBonuses: [] }
      }
    });

    const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toMatchObject({
      error: null,
      relatedData: {
        honorBonusesLoadFailed: false,
        bonuses: { honorBonusCount: 0 }
      }
    });
    expect(getEventsByRegionByIdHonorBonuses).not.toHaveBeenCalled();
  });

  it("keeps an empty successful enrichment response distinct from a failure", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: { id: 123, name: "Event" },
        bonuses: {
          eventHonorBonuses: [{ honorId: 42, bonusRate: 25 }]
        }
      }
    });
    getEventsByRegionByIdHonorBonuses.mockResolvedValue({ data: { items: [] } });

    const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toMatchObject({
      error: null,
      relatedData: {
        honorBonusesLoadFailed: false,
        bonuses: {
          honorBonusCount: 1,
          honorBonuses: [{ honorId: 42, bonusRate: 25, honor: null }]
        }
      }
    });
  });

  it("marks malformed successful enrichment data unavailable and preserves aggregate bonuses", async () => {
    getEventsByRegionByIdDetail.mockResolvedValue({
      data: {
        event: { id: 123, name: "Event" },
        bonuses: {
          eventHonorBonuses: [{ honorId: 42, bonusRate: 25 }]
        }
      }
    });
    getEventsByRegionByIdHonorBonuses.mockResolvedValue({ data: "invalid response" });

    const result = (await runLoad("tw", "event-123")) as EventPageLoadResult;

    await expect(result.eventPayload).resolves.toMatchObject({
      error: null,
      relatedData: {
        honorBonusesLoadFailed: true,
        bonuses: {
          honorBonusCount: 1,
          honorBonuses: [{ honorId: 42, bonusRate: 25, honor: null }]
        }
      }
    });
  });
});
