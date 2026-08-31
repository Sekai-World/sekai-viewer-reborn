import { describe, expect, it, vi } from "vitest";

const regionContext = vi.hoisted(() => new Map<unknown, unknown>());

vi.mock("svelte", () => ({
  getContext: (key: unknown) => regionContext.get(key),
  setContext: (key: unknown, value: unknown) => regionContext.set(key, value)
}));

import {
  DEFAULT_PRIMARY_REGION,
  DEFAULT_SECONDARY_REGION,
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
