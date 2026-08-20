import { describe, expect, it } from "vitest";
import {
  getUnitIconBorderColor,
  normalizeUnitIconSlug,
  resolveUnitIconUrl
} from "./unit-icon-data";

describe("unit icon data", () => {
  it("normalizes supported slugs and maps none when requested", () => {
    expect(normalizeUnitIconSlug("  LIGHT_SOUND ")).toBe("light_sound");
    expect(normalizeUnitIconSlug("none")).toBeNull();
    expect(normalizeUnitIconSlug("none", true)).toBe("piapro");
    expect(normalizeUnitIconSlug("unknown")).toBeNull();
  });

  it("resolves package-owned icons and canonical border colors", () => {
    expect(resolveUnitIconUrl("idol")).toBeTruthy();
    expect(resolveUnitIconUrl("none", true)).toBeTruthy();
    expect(resolveUnitIconUrl("unknown")).toBeNull();
    expect(getUnitIconBorderColor("street")).toBe("#ee1166");
    expect(getUnitIconBorderColor("none", true)).toBe("#ffffff");
    expect(getUnitIconBorderColor("unknown")).toBeNull();
  });
});
