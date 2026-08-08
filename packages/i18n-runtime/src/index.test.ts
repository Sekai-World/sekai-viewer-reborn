import { describe, expect, it } from "vitest";
import { createScopedI18nLoader } from "./index";

describe("createScopedI18nLoader", () => {
  it("merges local source messages with matching-locale remote messages", async () => {
    const loader = createScopedI18nLoader({
      fallbackLocale: "en",
      localSourceMessagesByNamespace: { common: { local: "Local" } },
      commonNamespace: "common",
      loadRemoteMessages: async () => ({ remote: "Remote" }),
      normalizeLocale: (locale) => locale,
      toRemoteLocale: (locale) => locale
    });

    await expect(loader.loadMessages("en", "common")).resolves.toEqual({
      local: "Local",
      remote: "Remote"
    });
  });
});
