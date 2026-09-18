import { describe, expect, it } from "vitest";
import { trackPromise } from "./promise-cache";

type Cache = Partial<Record<"region", Promise<string>>>;

describe("trackPromise", () => {
  it("clears a rejected promise from the cache", async () => {
    const cache: Cache = {};
    const error = new Error("request failed");
    const request = trackPromise(cache, "region", Promise.reject(error));

    await expect(request).rejects.toBe(error);
    expect(cache.region).toBeUndefined();
  });

  it("keeps a replacement promise when an older request settles", async () => {
    const cache: Cache = {};
    let rejectFirst: ((reason: Error) => void) | undefined;
    let resolveSecond: ((value: string) => void) | undefined;
    const firstRaw = new Promise<string>((_, reject) => {
      rejectFirst = reject;
    });
    const secondRaw = new Promise<string>((resolve) => {
      resolveSecond = resolve;
    });
    const first = trackPromise(cache, "region", firstRaw);
    const second = trackPromise(cache, "region", secondRaw);

    rejectFirst?.(new Error("first request failed"));
    await expect(first).rejects.toThrow("first request failed");
    expect(cache.region).toBe(second);

    resolveSecond?.("second request succeeded");
    await expect(second).resolves.toBe("second request succeeded");
    expect(cache.region).toBeUndefined();
  });
});
