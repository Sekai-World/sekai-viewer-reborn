import { describe, expect, it } from "vitest";
import { getString, getStringLike, pickFirstString } from "./response-values";

describe("response scalar values", () => {
  it("normalizes non-empty strings and finite number-like values", () => {
    expect(getString("  value  ")).toBe("value");
    expect(getString("   ")).toBeNull();
    expect(getString(7)).toBeNull();
    expect(getStringLike("  value  ")).toBe("value");
    expect(getStringLike(7)).toBe("7");
    expect(getStringLike(Number.NaN)).toBeNull();
  });

  it("returns the first non-empty string alias", () => {
    expect(pickFirstString({ first: " ", second: " value " }, ["first", "second"])).toBe("value");
    expect(pickFirstString({ first: 1 }, ["first", "missing"])).toBeNull();
  });
});
