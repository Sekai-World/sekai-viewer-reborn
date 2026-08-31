import { describe, expect, it } from "vitest";
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

  it("resolves the local bundle for the requested namespaces", async () => {
    await expect(loadI18nMessageBundle("en", ["common"])).resolves.toEqual(
      getLocalI18nMessages(["common"])
    );
  });
});
