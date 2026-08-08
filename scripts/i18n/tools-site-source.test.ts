import { describe, expect, it } from "vitest";
import { collectTranslatorKeys } from "./tools-site-source.mjs";

describe("tools-site i18n source collection", () => {
  it("collects literal keys from both t and translate calls", () => {
    const keys = new Set<string>();

    collectTranslatorKeys(
      `t("comparison.title"); translate('comparison.empty'); translate(\`dynamic.key\`);`,
      keys
    );

    expect(keys).toEqual(new Set(["comparison.title", "comparison.empty"]));
  });
});
