import { describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({ browser: true, dev: true }));

import { loadI18nMessages } from "./runtime";

describe("dev English message loading", () => {
  it("resolves English from local source files without a remote fetch", async () => {
    const fetcher = vi.fn();

    const messages = await loadI18nMessages("en", "common", fetcher as unknown as typeof fetch);

    expect(messages["navigation.characters"]).toBe("Characters & Units");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
