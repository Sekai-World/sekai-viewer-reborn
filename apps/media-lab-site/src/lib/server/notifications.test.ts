import { afterEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  SEKAI_API_BASE_URL: undefined as string | undefined
}));

vi.mock("$env/dynamic/private", () => ({ env: envState }));

import { fetchGlobalNotices } from "./notifications";

const createResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(body)
  }) as unknown as Response;

describe("media-lab-site fetchGlobalNotices", () => {
  afterEach(() => {
    vi.clearAllMocks();
    envState.SEKAI_API_BASE_URL = undefined;
  });

  it("returns an empty list without fetching when the base URL is not configured", async () => {
    const fetcher = vi.fn();
    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("treats a value of only slashes as unconfigured", async () => {
    envState.SEKAI_API_BASE_URL = "///";
    const fetcher = vi.fn();
    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns an empty list on a non-OK response", async () => {
    envState.SEKAI_API_BASE_URL = "https://media.example.test";
    const fetcher = vi.fn().mockResolvedValue(createResponse(null, false));
    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
  });

  it("returns an empty list for an invalid envelope", async () => {
    envState.SEKAI_API_BASE_URL = "https://media.example.test/";
    const fetcher = vi.fn().mockResolvedValue(createResponse({ status: "fail", data: [] }));
    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
  });

  it("fetches and normalizes the notifications feed", async () => {
    envState.SEKAI_API_BASE_URL = "https://media.example.test";
    const fetcher = vi.fn().mockResolvedValue(
      createResponse({
        status: "success",
        data: [{ id: "m1", version: 2, severity: "warning", title: "Maint", message: "Soon" }]
      })
    );

    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([
      { id: "m1", version: 2, severity: "warning", title: "Maint", message: "Soon" }
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://media.example.test/notifications",
      expect.objectContaining({ headers: { accept: "application/json" } })
    );
  });
});
