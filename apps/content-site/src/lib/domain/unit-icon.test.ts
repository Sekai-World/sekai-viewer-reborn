import { describe, expect, it } from "vitest";
import { resolveCanonicalUnitSlug, resolveUnitLogoUrl } from "./unit-icon";

describe("resolveCanonicalUnitSlug", () => {
  it("delegates to ui-shell normalization for known unit slugs", () => {
    expect(resolveCanonicalUnitSlug(" IDOL ")).toBe("idol");
    expect(resolveCanonicalUnitSlug("Light_Sound")).toBe("light_sound");
  });

  it("returns null for unknown, empty, or missing slugs", () => {
    expect(resolveCanonicalUnitSlug("leoneed")).toBeNull();
    expect(resolveCanonicalUnitSlug("")).toBeNull();
    expect(resolveCanonicalUnitSlug(null)).toBeNull();
    expect(resolveCanonicalUnitSlug(undefined)).toBeNull();
  });

  it("does not map the support-unit none slug to piapro by default", () => {
    expect(resolveCanonicalUnitSlug("none")).toBeNull();
  });
});

describe("resolveUnitLogoUrl", () => {
  it("resolves the logo for a known unit via asset()", () => {
    expect(resolveUnitLogoUrl("idol")).toBe("/logos/logo_idol.png");
  });

  it("returns null for unknown slugs", () => {
    expect(resolveUnitLogoUrl("leoneed")).toBeNull();
  });
});
