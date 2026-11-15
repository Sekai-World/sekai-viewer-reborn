import { describe, expect, it } from "vitest";
import { parseRouteId } from "./route-id.js";

describe("parseRouteId", () => {
  it.each([
    ["1", 1],
    ["180", 180],
    ["9007199254740991", Number.MAX_SAFE_INTEGER]
  ])("accepts the canonical id %s", (value, expected) => {
    expect(parseRouteId(value)).toBe(expected);
  });

  it.each([
    ["a missing segment", undefined],
    ["an empty segment", ""],
    ["zero", "0"],
    ["a negative number", "-1"],
    ["an explicit sign", "+1"],
    ["text", "abc"],
    ["a trailing letter", "12a"],
    ["hexadecimal", "0x10"],
    ["an exponent", "1e2"],
    ["a decimal", "1.0"],
    ["a leading zero", "0180"],
    ["a leading space", " 1"],
    ["a trailing space", "1 "],
    ["a trailing newline", "1\n"],
    ["full-width digits", "１２"],
    ["the first unsafe integer", "9007199254740992"],
    ["2^53 + 1", "9007199254740993"],
    ["a very large number", "99999999999999999999"]
  ])("rejects %s", (_label, value) => {
    expect(parseRouteId(value)).toBeNull();
  });
});
