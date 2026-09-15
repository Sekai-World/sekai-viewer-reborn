import { describe, expect, it } from "vitest";
import {
  getDateValue,
  getDateValuePreservingWhitespace,
  getObject,
  getString,
  getStringLike,
  getStringLikePreservingWhitespace,
  getStringPreservingWhitespace,
  pickFirstDateValue,
  pickFirstDateValuePreservingWhitespace,
  pickFirstNumber,
  pickFirstObject,
  pickFirstString,
  pickFirstStringLike,
  pickFirstStringLikePreservingWhitespace,
  pickFirstStringPreservingWhitespace
} from "./response-values";

describe("response scalar values", () => {
  it("normalizes non-empty strings and finite number-like values", () => {
    expect(getString("  value  ")).toBe("value");
    expect(getString("   ")).toBeNull();
    expect(getString(7)).toBeNull();
    expect(getStringLike("  value  ")).toBe("value");
    expect(getStringLike(7)).toBe("7");
    expect(getStringLike(Number.NaN)).toBeNull();
    expect(getDateValue(" 2026-01-01 ")).toBe("2026-01-01");
    expect(getDateValue(7)).toBe(7);
    expect(getDateValue(Number.POSITIVE_INFINITY)).toBeNull();
    expect(getStringPreservingWhitespace("  value  ")).toBe("  value  ");
    expect(getStringPreservingWhitespace("   ")).toBeNull();
    expect(getStringLikePreservingWhitespace("  value  ")).toBe("  value  ");
    expect(getStringLikePreservingWhitespace(7)).toBe("7");
    expect(getDateValuePreservingWhitespace(" 2026-01-01 ")).toBe(" 2026-01-01 ");
    expect(getObject({ value: 1 })).toEqual({ value: 1 });
    expect(getObject(null)).toBeNull();
  });

  it("returns the first non-empty string alias", () => {
    expect(pickFirstString({ first: " ", second: " value " }, ["first", "second"])).toBe("value");
    expect(pickFirstString({ first: 1 }, ["first", "missing"])).toBeNull();
    expect(pickFirstStringLike({ first: " ", second: 7 }, ["first", "second"])).toBe("7");
    expect(pickFirstDateValue({ first: " ", second: 7 }, ["first", "second"])).toBe(7);
    expect(pickFirstObject({ first: null, second: { value: 1 } }, ["first", "second"])).toEqual({
      value: 1
    });
    expect(pickFirstNumber({ first: "invalid", second: 7 }, ["first", "second"])).toBe(7);
    expect(
      pickFirstStringPreservingWhitespace({ first: " ", second: " value " }, ["first", "second"])
    ).toBe(" value ");
    expect(
      pickFirstStringLikePreservingWhitespace({ first: " ", second: 7 }, ["first", "second"])
    ).toBe("7");
    expect(
      pickFirstDateValuePreservingWhitespace({ first: " ", second: 7 }, ["first", "second"])
    ).toBe(7);
  });
});
