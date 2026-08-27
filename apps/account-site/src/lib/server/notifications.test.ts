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

describe("account-site fetchGlobalNotices", () => {
  afterEach(() => {
    vi.clearAllMocks();
    envState.SEKAI_API_BASE_URL = undefined;
  });

  it("returns an empty list without fetching when the base URL is not configured", async () => {
    const fetcher = vi.fn();
    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("strips trailing slashes and normalizes valid entries", async () => {
    envState.SEKAI_API_BASE_URL = "https://account.example.test///";
    const fetcher = vi.fn().mockResolvedValue(
      createResponse({
        status: "success",
        data: [
          { id: "a1", version: 1, severity: "info", title: "Hi", message: "There" },
          { id: "broken" }
        ]
      })
    );

    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([
      { id: "a1", version: 1, severity: "info", title: "Hi", message: "There" }
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://account.example.test/notifications",
      expect.objectContaining({ headers: { accept: "application/json" } })
    );
  });

  it("resolves to an empty list when the request rejects", async () => {
    envState.SEKAI_API_BASE_URL = "https://account.example.test";
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(fetchGlobalNotices(fetcher)).resolves.toEqual([]);
  });
});
