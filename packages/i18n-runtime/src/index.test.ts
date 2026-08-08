import { afterEach, describe, expect, it, vi } from "vitest";
import { createRemoteI18nRuntime } from "./index";

const createRuntime = (messageLoadTimeoutMs: number) =>
  createRemoteI18nRuntime({
    baseUrl: "https://example.test/",
    fallbackLocale: "en",
    messageLoadTimeoutMs,
    normalizeLocale: (locale) => locale,
    toRemoteLocale: (locale) => locale
  });

describe("remote message loading", () => {
  it("aborts at its deadline and evicts the failed cache entry for a retry", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetcher = vi.fn((_input: string, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        });
      }

      return Promise.resolve(new Response(JSON.stringify({ home: "Accueil" })));
    });
    const runtime = createRuntime(25);

    const first = runtime.loadMessages("fr", "common", fetcher);
    await vi.advanceTimersByTimeAsync(25);

    await expect(first).resolves.toEqual({});
    await expect(runtime.loadMessages("fr", "common", fetcher)).resolves.toEqual({
      home: "Accueil"
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("deduplicates concurrent lookups for the same remote locale and namespace", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        })
    );
    const runtime = createRuntime(100);

    const first = runtime.loadMessages("fr", "common", fetcher);
    const second = runtime.loadMessages("fr", "common", fetcher);

    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveResponse?.(new Response(JSON.stringify({ home: "Accueil" })));
    await expect(first).resolves.toEqual({ home: "Accueil" });
  });

  it("forwards request initialization to the default fetcher", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ home: "Accueil" })));
    const runtime = createRuntime(100);

    await expect(runtime.loadMessages("fr", "common")).resolves.toEqual({ home: "Accueil" });

    expect(fetchSpy).toHaveBeenCalledWith("https://example.test/fr/common.json", {
      signal: expect.any(AbortSignal)
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
});
