import { describe, expect, it } from "vitest";
import { getRovingTabIndex } from "./roving-tabs";

describe("getRovingTabIndex", () => {
  it.each([
    ["ArrowRight", 0, 1],
    ["ArrowRight", 2, 0],
    ["ArrowLeft", 0, 2],
    ["ArrowLeft", 2, 1],
    ["Home", 2, 0],
    ["End", 0, 2]
  ])("%s from %i moves to %i", (key, index, expected) => {
    expect(getRovingTabIndex(key, index, 3)).toBe(expected);
  });

  it("ignores other keys and empty tablists", () => {
    expect(getRovingTabIndex("Enter", 0, 3)).toBeNull();
    expect(getRovingTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
