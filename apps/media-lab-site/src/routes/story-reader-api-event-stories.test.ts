import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchEventStoriesByEvent: vi.fn()
}));

vi.mock("$lib/story/master-data-client.server", () => mocks);
vi.mock("$lib/story/story-resolver.server", () => ({
  getStoryAssetBase: () => "https://assets.test"
}));

import { GET } from "./story-reader/api/stories/[region]/event-stories/[eventId]/+server";

const callGet = (params: Record<string, string>) =>
  GET({
    params,
    fetch: vi.fn(),
    url: new URL("http://localhost:4103/story-reader/api/stories/jp/event-stories/34")
  } as unknown as Parameters<typeof GET>[0]) as unknown as Promise<Response>;

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as { status?: number; body?: { message?: string } };
  }
  throw new Error("expected the handler to reject");
};

describe("event story episodes API", () => {
  it("returns episode links with banner URLs for one event", async () => {
    mocks.fetchEventStoriesByEvent.mockResolvedValue([
      {
        id: 1,
        eventId: 34,
        assetbundleName: "event_34",
        eventStoryEpisodes: [
          {
            id: 1,
            eventStoryId: 1,
            episodeNo: 1,
            title: "EP1",
            assetbundleName: "event_34_ep1",
            scenarioId: "event_34_1"
          }
        ]
      }
    ]);
    const response = await callGet({ region: "jp", eventId: "34" });
    const body = await response.json();
    expect(mocks.fetchEventStoriesByEvent).toHaveBeenCalledWith(
      "jp",
      34,
      expect.anything()
    );
    expect(body).toMatchObject({ storyType: "event", eventId: 34 });
    expect(body.episodes[0]).toMatchObject({ storyId: "34-1", label: "EP1" });
    expect(body.episodes[0].bannerUrl).toContain("event_34");
  });

  it("rejects unsupported regions and invalid event ids", async () => {
    const regionError = await errorOf(callGet({ region: "us", eventId: "34" }));
    expect(regionError.status).toBe(404);
    const zeroIdError = await errorOf(callGet({ region: "jp", eventId: "0" }));
    expect(zeroIdError.status).toBe(404);
    expect(zeroIdError.body?.message).toBe("Unsupported event id");
    const nanIdError = await errorOf(callGet({ region: "jp", eventId: "abc" }));
    expect(nanIdError.status).toBe(404);
  });

  it("maps master-data failures to a 502", async () => {
    mocks.fetchEventStoriesByEvent.mockRejectedValue(new Error("boom"));
    const failure = await errorOf(callGet({ region: "jp", eventId: "34" }));
    expect(failure.status).toBe(502);
    expect(failure.body?.message).toBe("Failed to load event story episodes");
  });
});
