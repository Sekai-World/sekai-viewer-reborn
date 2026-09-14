import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEventsByRegionByIdDetail, getEventsRegionsByIdAvailability } = vi.hoisted(() => ({
  getEventsByRegionByIdDetail: vi.fn(),
  getEventsRegionsByIdAvailability: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getEventsByRegionByIdDetail,
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
    event: null;
    relatedData: null;
    debugEventJson: null;
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
});
