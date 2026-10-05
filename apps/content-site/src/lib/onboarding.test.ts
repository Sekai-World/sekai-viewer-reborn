import { describe, expect, it, vi } from "vitest";
import {
  ONBOARDING_SEEN_STORAGE_KEY,
  SEEN_SITE_VERSION_STORAGE_KEY,
  readOnboardingSeen,
  readSeenSiteVersion,
  writeOnboardingSeen,
  writeSeenSiteVersion
} from "./onboarding";

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

describe("onboarding storage helpers", () => {
  it("persists the onboarding and site version state", () => {
    const storage = createStorage();

    expect(readOnboardingSeen(storage)).toBe(false);
    writeOnboardingSeen(storage);
    expect(readOnboardingSeen(storage)).toBe(true);

    writeSeenSiteVersion("0.0.2", storage);
    expect(readSeenSiteVersion(storage)).toBe("0.0.2");
    expect(storage.getItem(ONBOARDING_SEEN_STORAGE_KEY)).toBe("true");
    expect(storage.getItem(SEEN_SITE_VERSION_STORAGE_KEY)).toBe("0.0.2");
  });

  it("ignores malformed persisted values and invalid versions", () => {
    const storage = createStorage({
      [ONBOARDING_SEEN_STORAGE_KEY]: "yes",
      [SEEN_SITE_VERSION_STORAGE_KEY]: "release-latest"
    });

    expect(readOnboardingSeen(storage)).toBe(false);
    expect(readSeenSiteVersion(storage)).toBeNull();

    writeSeenSiteVersion("release-latest", storage);
    expect(storage.getItem(SEEN_SITE_VERSION_STORAGE_KEY)).toBe("release-latest");
  });

  it("treats storage failures as unavailable", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("storage blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("storage blocked");
      })
    } satisfies Pick<Storage, "getItem" | "setItem">;

    expect(readOnboardingSeen(storage)).toBe(false);
    expect(readSeenSiteVersion(storage)).toBeNull();
    expect(() => writeOnboardingSeen(storage)).not.toThrow();
    expect(() => writeSeenSiteVersion("0.0.2", storage)).not.toThrow();
  });
});
