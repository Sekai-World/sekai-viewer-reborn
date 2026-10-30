import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolveStoryRouteResult } from "./story-resolver.server";

const resolveStoryRoute = vi.hoisted(() => vi.fn<() => Promise<ResolveStoryRouteResult>>());

vi.mock("./story-resolver.server.js", () => ({ resolveStoryRoute }));

import { resolveStoryPage } from "./story-page-load.server";

const params = { region: "tw", storyType: "card", storyId: "100" };
const identity = { region: "tw", storyType: "card", storyId: "100" };
const fetchFn = vi.fn() as unknown as typeof fetch;

describe("resolveStoryPage", () => {
  beforeEach(() => resolveStoryRoute.mockReset());

  it("rejects a malformed route with a 404", async () => {
    await expect(
      resolveStoryPage({ ...params, region: "xx" }, fetchFn, "http://localhost")
    ).rejects.toMatchObject({ status: 404 });
    expect(resolveStoryRoute).not.toHaveBeenCalled();
  });

  it("rejects an unknown story with a 404", async () => {
    resolveStoryRoute.mockResolvedValue({ status: "not-found" });
    await expect(resolveStoryPage(params, fetchFn, "http://localhost")).rejects.toMatchObject({
      status: 404
    });
  });

  it.each([
    [{ status: "region-unavailable" }, { identity, readerStatus: "region-unavailable" }],
    [
      { status: "master-data-error", error: new Error("down") },
      { identity, readerStatus: "unavailable" }
    ],
    [
      { status: "unsupported", reason: "no scenario" },
      { identity, readerStatus: "unsupported-story", reason: "no scenario" }
    ]
  ] as const)("maps %j to a reader status page", async (result, page) => {
    resolveStoryRoute.mockResolvedValue(result as ResolveStoryRouteResult);
    expect(await resolveStoryPage(params, fetchFn, "http://localhost")).toEqual({
      ready: false,
      page
    });
  });

  it("hands a resolved story back to the loader", async () => {
    const value = { identity } as never;
    resolveStoryRoute.mockResolvedValue({ status: "ok", value });
    expect(await resolveStoryPage(params, fetchFn, "http://localhost")).toEqual({
      ready: true,
      identity,
      value
    });
  });
});
