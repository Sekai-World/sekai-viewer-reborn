import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchGlobalNotices,
  fetchWithTimeout,
  NOTIFICATION_FETCH_TIMEOUT_MS,
  stripTrailingSlashes
} from "./global-notices";

const createResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(body)
  }) as unknown as Response;

describe("stripTrailingSlashes", () => {
  it("removes every trailing slash", () => {
    expect(stripTrailingSlashes("https://api.test/")).toBe("https://api.test");
    expect(stripTrailingSlashes("https://api.test///")).toBe("https://api.test");
  });

  it("leaves strings without trailing slashes untouched", () => {
    expect(stripTrailingSlashes("https://api.test")).toBe("https://api.test");
    expect(stripTrailingSlashes("https://api.test/notifications")).toBe(
      "https://api.test/notifications"
    );
  });

  it("returns an empty string when only slashes are present", () => {
    expect(stripTrailingSlashes("/")).toBe("");
    expect(stripTrailingSlashes("///")).toBe("");
    expect(stripTrailingSlashes("")).toBe("");
  });
});

describe("fetchGlobalNotices", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns an empty list without fetching when the base URL is null", async () => {
    const fetcher = vi.fn();
    await expect(fetchGlobalNotices(null, fetcher)).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches the notifications feed and normalizes valid entries", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      createResponse({
        status: "success",
        data: [
          { id: "n1", version: 1, severity: "info", title: "Hello", message: "World" },
          { id: "broken" }
        ]
      })
    );

    await expect(fetchGlobalNotices("https://api.example.test", fetcher)).resolves.toEqual([
      { id: "n1", version: 1, severity: "info", title: "Hello", message: "World" }
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/notifications",
      expect.objectContaining({ headers: { accept: "application/json" } })
    );
  });

  it("returns an empty list on a non-OK response", async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse(null, false));
    await expect(fetchGlobalNotices("https://api.example.test", fetcher)).resolves.toEqual([]);
  });

  it("returns an empty list when the request rejects", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(fetchGlobalNotices("https://api.example.test", fetcher)).resolves.toEqual([]);
  });

  it("returns an empty list for an invalid envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse({ status: "fail", data: [] }));
    await expect(fetchGlobalNotices("https://api.example.test", fetcher)).resolves.toEqual([]);
  });
});

describe("fetchWithTimeout", () => {
  it("aborts the request when the timeout elapses", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      });
    });

    const promise = fetchWithTimeout(
      "https://api.example.test/notifications",
      fetcher as unknown as typeof fetch
    );
    vi.advanceTimersByTime(NOTIFICATION_FETCH_TIMEOUT_MS);
    await expect(promise).rejects.toThrow();
  });

  it("forwards the abort signal and accept header to the fetcher", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(createResponse({ status: "success", data: [] }));
    await fetchWithTimeout("https://api.example.test/x", fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/x",
      expect.objectContaining({
        headers: { accept: "application/json" },
        signal: expect.any(AbortSignal)
      })
    );
  });
});
