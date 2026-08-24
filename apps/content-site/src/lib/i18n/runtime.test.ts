import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRemoteI18nRuntime } from "@platform/i18n-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLocalI18nMessages,
  loadI18nMessages,
  resolveI18nMessageBundle,
  type I18nNamespace
} from "./runtime";

const namespaces: readonly I18nNamespace[] = ["common", "event"];

describe("loadI18nMessages", () => {
  it("loads English from the remote dictionary outside dev and lets remote win over local sources", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ "navigation.characters": "Characters (remote)" }), {
          status: 200
        })
      )
    );

    const messages = await loadI18nMessages("en", "common", fetcher as unknown as typeof fetch);

    expect(messages["navigation.characters"]).toBe("Characters (remote)");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("resolveI18nMessageBundle", () => {
  it("returns the target locale bundle when remote loading succeeds", async () => {
    const targetMessages = { home: "ホーム", eventDetailTitle: "イベント詳細" };

    await expect(resolveI18nMessageBundle(async () => targetMessages, namespaces)).resolves.toBe(
      targetMessages
    );
  });

  it("uses local source messages when remote loading fails", async () => {
    await expect(
      resolveI18nMessageBundle(async () => Promise.reject(new Error("dictionary unavailable")), namespaces)
    ).resolves.toEqual(getLocalI18nMessages(namespaces));
  });

  it("uses local source messages when the server bundle misses its deadline", async () => {
    vi.useFakeTimers();
    const pendingBundle = new Promise<Record<string, string>>(() => {});

    const result = resolveI18nMessageBundle(() => pendingBundle, namespaces, 25);
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toEqual(getLocalI18nMessages(namespaces));
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("remote message cache deadlines", () => {
  it("evicts a timed-out lookup so a later request can succeed", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const runtime = createRemoteI18nRuntime({
      baseUrl: "https://example.test",
      fallbackLocale: "en",
      messageLoadTimeoutMs: 25,
      normalizeLocale: (locale) => locale,
      toRemoteLocale: (locale) => locale
    });
    const fetcher = vi.fn((_input: string, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
      return Promise.resolve(new Response(JSON.stringify({ home: "Accueil" }), { status: 200 }));
    });

    const first = runtime.loadMessages("fr", "common", fetcher);
    await vi.advanceTimersByTimeAsync(25);
    await expect(first).resolves.toEqual({});
    await expect(runtime.loadMessages("fr", "common", fetcher)).resolves.toEqual({ home: "Accueil" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent lookups for the same locale and namespace", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const runtime = createRemoteI18nRuntime({
      baseUrl: "https://example.test",
      fallbackLocale: "en",
      messageLoadTimeoutMs: 100,
      normalizeLocale: (locale) => locale,
      toRemoteLocale: (locale) => locale
    });
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        })
    );

    const first = runtime.loadMessages("fr", "common", fetcher);
    const second = runtime.loadMessages("fr", "common", fetcher);
    expect(first).toBe(second);
    resolveResponse?.(new Response(JSON.stringify({ home: "Accueil" }), { status: 200 }));
    await expect(first).resolves.toEqual({ home: "Accueil" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("character loader i18n contract", () => {
  it("lets both character loaders inherit the resolved root layout messages", async () => {
    const routesDirectory = resolve(process.cwd(), "src/routes");
    const loaders = await Promise.all(
      ["characters/[region]/+page.server.ts", "character/[region]/[id]/+page.server.ts"].map((path) =>
        readFile(resolve(routesDirectory, path), "utf8")
      )
    );

    for (const source of loaders) {
      expect(source).not.toContain("i18nMessages");
      expect(source).not.toContain("loadI18nMessageBundle");
      expect(source).not.toContain("UI_LOCALE_COOKIE_NAME");
    }
  });
});
