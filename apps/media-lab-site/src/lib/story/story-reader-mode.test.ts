import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readRememberedStoryReaderMode,
  rememberStoryReaderMode
} from "./story-reader-mode";

const createStorageMock = (initial: Record<string, string> = {}): Storage => {
  const values = new Map(Object.entries(initial));
  return {
    get length(): number {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: () => null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value)
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("remembered story reader mode", () => {
  it("reads null without a window (SSR)", () => {
    expect(readRememberedStoryReaderMode()).toBeNull();
  });

  it("round-trips a remembered mode", () => {
    vi.stubGlobal("window", { localStorage: createStorageMock() });

    expect(readRememberedStoryReaderMode()).toBeNull();

    rememberStoryReaderMode("player");

    expect(readRememberedStoryReaderMode()).toBe("player");
    rememberStoryReaderMode("text");
    expect(readRememberedStoryReaderMode()).toBe("text");
  });

  it("treats corrupt stored values as no preference", () => {
    vi.stubGlobal("window", {
      localStorage: createStorageMock({ "media-lab:story-reader-mode": "cinematic" })
    });

    expect(readRememberedStoryReaderMode()).toBeNull();
  });

  it("survives storage failures instead of breaking the picker", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      }
    };
    vi.stubGlobal("window", { localStorage: throwingStorage });

    expect(() => rememberStoryReaderMode("text")).not.toThrow();
    expect(readRememberedStoryReaderMode()).toBeNull();
  });
});
