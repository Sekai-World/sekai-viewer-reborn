import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRemoteI18nRuntime,
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  repoLocaleByUiLocale,
  resolveI18nMessageBundle,
  supportedUiLocales
} from "./index";

describe("UI locale configuration", () => {
  it("exposes the supported locale and repository mappings", () => {
    expect(supportedUiLocales).toEqual(["en", "ja-JP", "ko-KR", "zh-CN", "zh-TW"]);
    expect(DEFAULT_UI_LOCALE).toBe("en");
    expect(repoLocaleByUiLocale).toEqual({
      en: "en",
      "ja-JP": "ja",
      "ko-KR": "ko",
      "zh-CN": "zh-CN",
      "zh-TW": "zh-TW"
    });
  });

  it("normalizes browser locale aliases and falls back unsupported values", () => {
    expect(normalizeUiLocale("en-US")).toBe("en");
    expect(normalizeUiLocale("en-GB")).toBe("en");
    expect(normalizeUiLocale("zh")).toBe("zh-CN");
    expect(normalizeUiLocale("ja-JP")).toBe("ja-JP");
    expect(normalizeUiLocale("fr")).toBe("en");
    expect(normalizeUiLocale(null, "zh-TW")).toBe("zh-TW");
  });
});

describe("i18n bundle resolution", () => {
  it("returns the loaded bundle when loading succeeds", async () => {
    const bundle = { greeting: "Hello" };

    await expect(
      resolveI18nMessageBundle(async () => bundle, { greeting: "Fallback" })
    ).resolves.toBe(bundle);
  });

  it("returns fallback messages when loading rejects", async () => {
    const fallback = { greeting: "Fallback" };

    await expect(
      resolveI18nMessageBundle(async () => Promise.reject(new Error("offline")), fallback)
    ).resolves.toBe(fallback);
  });

  it("returns fallback messages when loading misses its deadline", async () => {
    vi.useFakeTimers();
    const fallback = { greeting: "Fallback" };
    const pendingBundle = new Promise<Record<string, string>>(() => {});

    const result = resolveI18nMessageBundle(() => pendingBundle, fallback, 25);
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBe(fallback);
  });
});

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
