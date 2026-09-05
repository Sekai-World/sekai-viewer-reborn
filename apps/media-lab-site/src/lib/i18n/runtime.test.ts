import { describe, expect, it } from "vitest";
import {
  createI18nTranslator,
  getLocalI18nMessages,
  loadI18nMessageBundle,
  mediaLabI18nNamespaces
} from "./runtime";

describe("media-lab-site local i18n runtime", () => {
  it("exposes route-aware namespaces", () => {
    expect(mediaLabI18nNamespaces).toEqual(["common", "home", "live2d", "story-reader"]);
  });

  it("merges the requested local namespaces", () => {
    expect(getLocalI18nMessages(mediaLabI18nNamespaces)).toMatchObject({
      "shell.title": expect.any(String),
      "home.title": expect.any(String),
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

  it("resolves the local bundle for the requested namespaces", async () => {
    await expect(loadI18nMessageBundle("en", ["live2d"])).resolves.toEqual(
      getLocalI18nMessages(["live2d"])
    );
  });
});
