import { afterEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  getSekaiApiBaseUrl: vi.fn()
}));

vi.mock("$lib/server/config", () => config);

import { fetchGlobalNotices } from "./notifications";

const createResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(body)
  }) as unknown as Response;

describe("fetchGlobalNotices", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list without fetching when the base URL is not configured", async () => {
    config.getSekaiApiBaseUrl.mockImplementation(() => {
      throw new Error("Missing required environment variable: SEKAI_API_BASE_URL");
    });

    const fetcher = vi.fn();
    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches the notifications feed and normalizes valid entries", async () => {
    config.getSekaiApiBaseUrl.mockReturnValue("https://api.example.test");
    const fetcher = vi.fn().mockResolvedValue(
      createResponse({
        status: "success",
        data: [
          { id: "n1", version: 1, severity: "info", title: "Hello", message: "World" },
          { id: "broken" }
        ]
      })
    );

    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([
      { id: "n1", version: 1, severity: "info", title: "Hello", message: "World" }
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/notifications",
      expect.objectContaining({
        headers: { accept: "application/json" }
      })
    );
  });

  it("returns an empty list on a non-OK response", async () => {
    config.getSekaiApiBaseUrl.mockReturnValue("https://api.example.test");
    const fetcher = vi.fn().mockResolvedValue(createResponse(null, false));

    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
  });

  it("returns an empty list when the request rejects", async () => {
    config.getSekaiApiBaseUrl.mockReturnValue("https://api.example.test");
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
  });

  it("returns an empty list for an invalid envelope", async () => {
    config.getSekaiApiBaseUrl.mockReturnValue("https://api.example.test");
    const fetcher = vi.fn().mockResolvedValue(createResponse({ status: "fail", data: [] }));

    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
  });
});