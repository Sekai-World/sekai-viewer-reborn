import { describe, expect, it, vi } from "vitest";
import type { FilterGuideScope } from "./filter-onboarding";
import { readFilterGuideSeen, writeFilterGuideSeen } from "./filter-onboarding";

const scopes: readonly FilterGuideScope[] = ["cards", "musics", "virtual-lives"];

const createStorage = (
  initial: Record<string, string> = {}
): Pick<Storage, "getItem" | "setItem"> => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
};

describe("filter guide storage helpers", () => {
  it("persists an independent seen flag for each catalogue", () => {
    const storage = createStorage();

    writeFilterGuideSeen("cards", storage);

    for (const scope of scopes) {
      expect(readFilterGuideSeen(scope, storage)).toBe(scope === "cards");
    }

    for (const scope of scopes) {
      writeFilterGuideSeen(scope, storage);
      expect(storage.getItem(`content_site_filter_guide_seen_${scope}`)).toBe("true");
      expect(readFilterGuideSeen(scope, storage)).toBe(true);
    }
  });

  it("recognizes only the literal true value", () => {
    const storage = createStorage({
      content_site_filter_guide_seen_cards: "yes",
      content_site_filter_guide_seen_musics: "1",
      "content_site_filter_guide_seen_virtual-lives": "true"
    });

    for (const scope of scopes) {
      expect(readFilterGuideSeen(scope, storage)).toBe(scope === "virtual-lives");
    }
  });

  it("treats null and failing storage as unavailable", () => {
    expect(readFilterGuideSeen("cards", null)).toBe(false);
    expect(() => writeFilterGuideSeen("cards", null)).not.toThrow();

    const storage = {
      getItem: vi.fn(() => {
        throw new Error("storage blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("storage blocked");
      })
    } satisfies Pick<Storage, "getItem" | "setItem">;

    expect(readFilterGuideSeen("cards", storage)).toBe(false);
    expect(() => writeFilterGuideSeen("cards", storage)).not.toThrow();
  });

  it("uses browser localStorage by default and tolerates SSR or blocked access", () => {
    const storage = createStorage({ content_site_filter_guide_seen_cards: "true" });

    vi.stubGlobal("window", { localStorage: storage });
    try {
      expect(readFilterGuideSeen("cards")).toBe(true);
      writeFilterGuideSeen("musics");
      expect(storage.getItem("content_site_filter_guide_seen_musics")).toBe("true");
    } finally {
      vi.unstubAllGlobals();
    }

    vi.stubGlobal("window", undefined);
    try {
      expect(readFilterGuideSeen("cards")).toBe(false);
      expect(() => writeFilterGuideSeen("cards")).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }

    const blockedWindow = Object.defineProperty({}, "localStorage", {
      get: () => {
        throw new Error("storage blocked");
      }
    });
    vi.stubGlobal("window", blockedWindow);
    try {
      expect(readFilterGuideSeen("cards")).toBe(false);
      expect(() => writeFilterGuideSeen("cards")).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
