import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REGION,
  DEFAULT_UI_LOCALE,
  PREFERRED_REGION_CHANGE_EVENT,
  PREFERRED_REGION_STORAGE_KEY,
  normalizeRegion,
  normalizeUiLocale,
  persistPreferredRegion,
  resolvePreferredRegion
} from "./region";

describe("region and locale preferences", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it.each([
    ["jp", "jp"],
    ["en", "en"],
    ["tw", "tw"],
    ["kr", "kr"],
    ["cn", "cn"]
  ] as const)("accepts supported region %s", (value, expected) => {
    expect(normalizeRegion(value)).toBe(expected);
  });

  it("falls back for missing, unsupported, and custom region values", () => {
    expect(normalizeRegion(undefined)).toBe(DEFAULT_REGION);
    expect(normalizeRegion(null, "en")).toBe("en");
    expect(normalizeRegion("global", "tw")).toBe("tw");
  });

  it.each([
    ["en-US", "en"],
    ["en-GB", "en"],
    ["zh", "zh-CN"],
    ["ja-JP", "ja-JP"],
    ["ko-KR", "ko-KR"],
    ["zh-CN", "zh-CN"],
    ["zh-TW", "zh-TW"]
  ] as const)("normalizes locale variant %s", (value, expected) => {
    expect(normalizeUiLocale(value)).toBe(expected);
  });

  it("uses the locale fallback for missing and unsupported values", () => {
    expect(normalizeUiLocale(undefined)).toBe(DEFAULT_UI_LOCALE);
    expect(normalizeUiLocale(null, "en")).toBe("en");
    expect(normalizeUiLocale("fr-FR", "ja-JP")).toBe("ja-JP");
  });

  it("returns the default region during SSR without reading storage", () => {
    vi.stubGlobal("window", undefined);
    const getItem = vi.spyOn(Storage.prototype, "getItem");

    expect(resolvePreferredRegion()).toBe(DEFAULT_REGION);
    expect(getItem).not.toHaveBeenCalled();
  });

  it("reads a normalized preferred region from localStorage in the browser", () => {
    localStorage.setItem(PREFERRED_REGION_STORAGE_KEY, "en");

    expect(resolvePreferredRegion()).toBe("en");
  });

  it("migrates the legacy home region preference", () => {
    localStorage.setItem("home-region", "tw");

    expect(resolvePreferredRegion()).toBe("tw");
    expect(localStorage.getItem(PREFERRED_REGION_STORAGE_KEY)).toBe("tw");
    expect(localStorage.getItem("home-region")).toBeNull();
  });

  it("persists the region and announces browser changes", () => {
    const listener = vi.fn();
    window.addEventListener(PREFERRED_REGION_CHANGE_EVENT, listener);

    persistPreferredRegion("kr");

    expect(localStorage.getItem(PREFERRED_REGION_STORAGE_KEY)).toBe("kr");
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      type: PREFERRED_REGION_CHANGE_EVENT,
      detail: "kr"
    });
  });
});
