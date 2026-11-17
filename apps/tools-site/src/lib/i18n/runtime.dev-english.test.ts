import { describe, expect, it, vi } from "vitest";

vi.mock("$app/env", () => ({ browser: true, dev: true }));

import { getLocalI18nMessages, loadI18nMessageBundle } from "./runtime";

describe("tools-site dev English message loading", () => {
  it("resolves English from local source files without a remote fetch", async () => {
    const fetcher = vi.fn();

    await expect(
      loadI18nMessageBundle("en", ["common"], fetcher as unknown as typeof fetch)
    ).resolves.toEqual(getLocalI18nMessages(["common"]));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
