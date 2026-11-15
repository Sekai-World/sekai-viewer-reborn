import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchEventStoriesByEvent } = vi.hoisted(() => ({ fetchEventStoriesByEvent: vi.fn() }));
vi.mock("#lib/story/master-data-client.server.js", () => ({ fetchEventStoriesByEvent }));
vi.mock("#lib/story/story-resolver.server.js", () => ({
  getStoryAssetBase: () => "https://assets.test"
}));

import { GET } from "./+server";

const callGet = (region: string, eventId: string) =>
  GET({ params: { region, eventId }, fetch } as unknown as Parameters<typeof GET>[0]);

describe("event story episodes endpoint", () => {
  beforeEach(() => {
    fetchEventStoriesByEvent.mockReset();
    fetchEventStoriesByEvent.mockResolvedValue([]);
  });

  it.each([
    ["1", 1],
    ["180", 180]
  ])("loads the episodes of event %s", async (raw, eventId) => {
    const response = await callGet("jp", raw);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ storyType: "event", eventId, episodes: [] });
    expect(fetchEventStoriesByEvent).toHaveBeenCalledWith("jp", eventId, { fetch });
  });

  it.each([
    ["zero", "0"],
    ["a negative number", "-1"],
    ["text", "abc"],
    ["hexadecimal", "0x10"],
    ["an exponent", "1e2"],
    ["a leading zero", "0180"],
    ["a leading space", " 1"],
    ["2^53 + 1", "9007199254740993"],
    ["a very large number", "99999999999999999999"]
  ])("answers 404 for %s without calling the master API", async (_label, raw) => {
    await expect(callGet("jp", raw)).rejects.toMatchObject({
      status: 404,
      body: { message: "Unsupported event id" }
    });
    expect(fetchEventStoriesByEvent).not.toHaveBeenCalled();
  });

  it("answers 404 for an unsupported region", async () => {
    await expect(callGet("xx", "1")).rejects.toMatchObject({ status: 404 });
    expect(fetchEventStoriesByEvent).not.toHaveBeenCalled();
  });
});
