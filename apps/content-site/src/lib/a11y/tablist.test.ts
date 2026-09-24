import { describe, expect, it } from "vitest";
import { getTablistTargetIndex } from "./tablist";

describe("getTablistTargetIndex", () => {
  it("wraps arrow navigation and jumps with Home/End", () => {
    expect(getTablistTargetIndex("ArrowRight", 2, 3)).toBe(0);
    expect(getTablistTargetIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(getTablistTargetIndex("ArrowDown", 0, 3)).toBe(1);
    expect(getTablistTargetIndex("ArrowUp", 1, 3)).toBe(0);
    expect(getTablistTargetIndex("Home", 2, 3)).toBe(0);
    expect(getTablistTargetIndex("End", 0, 3)).toBe(2);
  });

  it("ignores unrelated keys and empty lists", () => {
    expect(getTablistTargetIndex("Enter", 0, 3)).toBeNull();
    expect(getTablistTargetIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
