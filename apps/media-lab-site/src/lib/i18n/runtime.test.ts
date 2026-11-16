import { describe, expect, it, vi } from "vitest";
import { createI18nTranslator, getLocalI18nMessages, mediaLabI18nNamespaces } from "./runtime";

// The runtime caches dictionaries per module instance, so remote-loading tests
// each load a fresh copy.
const importRuntime = async () => {
  vi.resetModules();
  return import("./runtime");
};

describe("media-lab-site i18n runtime", () => {
  it("exposes route-aware namespaces", () => {
    expect(mediaLabI18nNamespaces).toEqual(["common", "home", "live2d", "chibi", "story-reader"]);
  });

  it("merges the requested local namespaces", () => {
    expect(getLocalI18nMessages(mediaLabI18nNamespaces)).toMatchObject({
      "shell.title": expect.any(String),
      "home.tagline": expect.any(String),
      "live2d.title": expect.any(String),
      "storyReader.landing.title": expect.any(String)
    });
  });

  it("keeps route namespaces scoped to their own keys", () => {
    const live2dMessages = getLocalI18nMessages(["live2d"]);

    expect(live2dMessages).toHaveProperty("live2d.title");
    expect(live2dMessages).not.toHaveProperty("shell.title");
  });

  it("looks up messages and uses the key or provided fallback when missing", () => {
    const translate = createI18nTranslator("ja-JP", { greeting: "こんにちは" });

    expect(translate("greeting")).toBe("こんにちは");
    expect(translate("missing")).toBe("missing");
    expect(translate("missing", "Fallback")).toBe("Fallback");
  });

  it("falls back to the local bundle when the remote dictionaries are unavailable", async () => {
    const { loadI18nMessageBundle } = await importRuntime();
    const fetcher = vi.fn(async () => new Response("Not found", { status: 404 }));

    await expect(loadI18nMessageBundle("en", ["live2d"], fetcher)).resolves.toEqual(
      getLocalI18nMessages(["live2d"])
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://sekai-world.github.io/sekai-i18n-reborn/en/media-lab-site/live2d.json",
      expect.anything()
    );
  });

  it("requests the media-lab-site dictionary path and layers it over English", async () => {
    const { loadI18nMessageBundle } = await importRuntime();
    const fetcher = vi.fn(async (input: string) =>
      input.includes("/ja/media-lab-site/common.json")
        ? Response.json({ "shell.title": "メディアラボ" })
        : new Response("Not found", { status: 404 })
    );

    const messages = await loadI18nMessageBundle("ja-JP", ["common"], fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/ja/media-lab-site/common.json"),
      expect.anything()
    );
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("/ja/common.json"))).toBe(false);
    expect(messages["shell.title"]).toBe("メディアラボ");
    expect(messages["shell.badge"]).toBe(getLocalI18nMessages(["common"])["shell.badge"]);
  });
});
