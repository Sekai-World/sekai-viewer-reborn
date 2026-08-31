import { describe, expect, it, vi } from "vitest";
import {
  createI18nTranslator,
  getLocalI18nMessages,
  loadI18nMessageBundle,
  mediaLabI18nNamespaces
} from "./runtime";

describe("media-lab-site local i18n runtime", () => {
  it("merges the requested local namespaces", () => {
    expect(getLocalI18nMessages(mediaLabI18nNamespaces)).toMatchObject({
      "home.title": expect.any(String)
    });
  });

  it("looks up messages and uses the key or provided fallback when missing", () => {
    const translate = createI18nTranslator("ja-JP", { greeting: "こんにちは" });

    expect(translate("greeting")).toBe("こんにちは");
    expect(translate("missing")).toBe("missing");
    expect(translate("missing", "Fallback")).toBe("Fallback");
  });

  it("resolves a local bundle without using the optional fetcher", async () => {
    const fetcher = vi.fn();

    await expect(loadI18nMessageBundle("en", ["common"], fetcher)).resolves.toEqual(
      getLocalI18nMessages(["common"])
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
