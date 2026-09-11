import { describe, expect, it, vi } from "vitest";

const regionContext = vi.hoisted(() => new Map<unknown, unknown>());

vi.mock("svelte", () => ({
  getContext: (key: unknown) => regionContext.get(key),
  setContext: (key: unknown, value: unknown) => regionContext.set(key, value)
}));

import {
  buildPrimaryRegionUrl,
  DEFAULT_PRIMARY_REGION,
  DEFAULT_SECONDARY_REGION,
  isSupportedRegion,
  normalizePrimaryRegion,
  provideRegionSelection,
  RegionSelection,
  supportedRegions,
  useRegionSelection
} from "./region-selection.svelte";

describe("media-lab-site region selection", () => {
  it("exposes the supported regions and expected defaults", () => {
    expect(supportedRegions).toEqual(["jp", "en", "tw", "kr", "cn"]);
    const selection = new RegionSelection();

    expect(DEFAULT_PRIMARY_REGION).toBe("jp");
    expect(DEFAULT_SECONDARY_REGION).toBe("en");
    expect(selection.primary).toBe("jp");
    expect(selection.secondary).toBe("en");
  });

  it.each([
    [" JP ", "jp"],
    ["EN", "en"],
    [" tw ", "tw"],
    ["invalid", "jp"],
    [null, "jp"],
    [undefined, "jp"]
  ])("normalizes primary region input %j", (value, expected) => {
    expect(normalizePrimaryRegion(value)).toBe(expected);
  });

  it("identifies supported regions and preserves unrelated URL state", () => {
    expect(isSupportedRegion("cn")).toBe(true);
    expect(isSupportedRegion("CN")).toBe(false);
    expect(isSupportedRegion(null)).toBe(false);

    const currentUrl = new URL("https://media-lab.test/live2d?view=grid&region=jp#models");
    const nextUrl = buildPrimaryRegionUrl(currentUrl, "kr");

    expect(nextUrl.pathname).toBe("/live2d");
    expect(nextUrl.searchParams.get("region")).toBe("kr");
    expect(nextUrl.searchParams.get("view")).toBe("grid");
    expect(nextUrl.hash).toBe("#models");
    expect(currentUrl.searchParams.get("region")).toBe("jp");
  });

  it("allows primary and secondary regions to be selected independently", () => {
    const selection = new RegionSelection();

    selection.primary = "tw";
    selection.secondary = "kr";

    expect(selection.primary).toBe("tw");
    expect(selection.secondary).toBe("kr");
  });

  it("provides and reads a request-scoped selection through context", () => {
    const provided = provideRegionSelection();

    expect(useRegionSelection()).toBe(provided);
  });

  it("reports a useful error when context has not been provided", () => {
    regionContext.clear();

    expect(() => useRegionSelection()).toThrow(
      "Region selection must be provided by the root layout before use."
    );
  });
});
