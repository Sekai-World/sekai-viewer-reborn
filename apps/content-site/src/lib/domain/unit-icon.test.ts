import { describe, expect, it } from "vitest";
import {
  resolveCanonicalUnitSlug,
  resolveUnitIconUrl,
  resolveUnitLogoUrl
} from "./unit-icon";

describe("resolveCanonicalUnitSlug", () => {
  it("normalizes known unit slugs", () => {
    expect(resolveCanonicalUnitSlug(" IDOL ")).toBe("idol");
    expect(resolveCanonicalUnitSlug("Light_Sound")).toBe("light_sound");
  });

  it("returns null for unknown, empty, or missing slugs", () => {
    expect(resolveCanonicalUnitSlug("leoneed")).toBeNull();
    expect(resolveCanonicalUnitSlug("")).toBeNull();
    expect(resolveCanonicalUnitSlug(null)).toBeNull();
    expect(resolveCanonicalUnitSlug(undefined)).toBeNull();
  });
});

describe("resolveUnitIconUrl", () => {
  it("maps the support-unit none slug to the piapro icon on request", () => {
    expect(resolveUnitIconUrl("none", true)).toBe("/icons/icon_piapro.png");
  });

  it("returns null for unknown slugs", () => {
    expect(resolveUnitIconUrl("unknown")).toBeNull();
  });
});

describe("resolveUnitLogoUrl", () => {
  it("resolves the logo for a known unit", () => {
    expect(resolveUnitLogoUrl("idol")).toBe("/logos/logo_idol.png");
  });

  it("returns null for unknown slugs", () => {
    expect(resolveUnitLogoUrl("leoneed")).toBeNull();
  });
});
