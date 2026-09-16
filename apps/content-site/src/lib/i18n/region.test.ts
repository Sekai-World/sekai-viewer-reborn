import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REGION,
  DEFAULT_UI_LOCALE,
  PREFERRED_REGION_CHANGE_EVENT,
  PREFERRED_REGION_COOKIE_NAME,
  PREFERRED_REGION_STORAGE_KEY,
  normalizeRegion,
  normalizeUiLocale,
  persistPreferredRegion,
  resolvePreferredRegion
} from "./region";

describe("region and locale preferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    document.cookie = `${PREFERRED_REGION_COOKIE_NAME}=; Max-Age=0; Path=/`;
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
    expect(document.cookie).toContain(`${PREFERRED_REGION_COOKIE_NAME}=en`);
  });

  it("prefers the cookie and synchronizes localStorage", () => {
    document.cookie = `${PREFERRED_REGION_COOKIE_NAME}=kr; Path=/`;
    localStorage.setItem(PREFERRED_REGION_STORAGE_KEY, "en");

    expect(resolvePreferredRegion()).toBe("kr");
    expect(localStorage.getItem(PREFERRED_REGION_STORAGE_KEY)).toBe("kr");
  });

  it("keeps matching cookie and localStorage region preferences in sync", () => {
    document.cookie = `${PREFERRED_REGION_COOKIE_NAME}=en; Path=/`;
    localStorage.setItem(PREFERRED_REGION_STORAGE_KEY, "en");

    expect(resolvePreferredRegion()).toBe("en");
    expect(localStorage.getItem(PREFERRED_REGION_STORAGE_KEY)).toBe("en");
  });

  it("ignores unsupported and malformed preferred-region cookies", () => {
    document.cookie = `${PREFERRED_REGION_COOKIE_NAME}=global; Path=/`;
    expect(resolvePreferredRegion()).toBe(DEFAULT_REGION);

    document.cookie = `${PREFERRED_REGION_COOKIE_NAME}=%; Path=/`;
    expect(resolvePreferredRegion()).toBe(DEFAULT_REGION);
  });

  it("handles missing document globals without persisting a region", () => {
    vi.stubGlobal("document", undefined);

    expect(resolvePreferredRegion()).toBe(DEFAULT_REGION);
    expect(() => persistPreferredRegion("en")).not.toThrow();
  });

  it("migrates the legacy home region preference", () => {
    localStorage.setItem("home-region", "tw");

    expect(resolvePreferredRegion()).toBe("tw");
    expect(localStorage.getItem(PREFERRED_REGION_STORAGE_KEY)).toBe("tw");
    expect(localStorage.getItem("home-region")).toBeNull();
    expect(document.cookie).toContain(`${PREFERRED_REGION_COOKIE_NAME}=tw`);
  });

  it("persists the region and announces browser changes", () => {
    const listener = vi.fn();
    window.addEventListener(PREFERRED_REGION_CHANGE_EVENT, listener);

    persistPreferredRegion("kr");

    expect(localStorage.getItem(PREFERRED_REGION_STORAGE_KEY)).toBe("kr");
    expect(document.cookie).toContain(`${PREFERRED_REGION_COOKIE_NAME}=kr`);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      type: PREFERRED_REGION_CHANGE_EVENT,
      detail: "kr"
    });
  });
});
