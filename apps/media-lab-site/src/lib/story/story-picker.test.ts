import { describe, expect, it } from "vitest";
import {
  isActivePickerStoryTypePath,
  isPickerStoryType,
  pickerStoryTypes
} from "./story-picker";

describe("story picker types", () => {
  it("exposes the picker story type vocabulary without profile", () => {
    expect(pickerStoryTypes).toEqual(["unit", "event", "character", "card", "area-talk", "special"]);
    expect(isPickerStoryType("unit")).toBe(true);
    expect(isPickerStoryType("area-talk")).toBe(true);
    expect(isPickerStoryType("profile")).toBe(false);
    expect(isPickerStoryType("unknown")).toBe(false);
  });

  it("marks the matching picker sub-page active", () => {
    expect(isActivePickerStoryTypePath("/story-reader/unit", "unit")).toBe(true);
    expect(isActivePickerStoryTypePath("/story-reader/unit", "event")).toBe(false);
  });

  it("marks the matching reader route active", () => {
    expect(isActivePickerStoryTypePath("/story-reader/jp/unit/idol-1-1", "unit")).toBe(true);
    expect(isActivePickerStoryTypePath("/story-reader/jp/unit/idol-1-1", "card")).toBe(false);
  });

  it("marks the Live2D player reader route active", () => {
    expect(isActivePickerStoryTypePath("/live2d/story-reader/jp/event/ev-1", "event")).toBe(true);
    expect(isActivePickerStoryTypePath("/live2d/story-reader/jp/event/ev-1", "unit")).toBe(false);
    expect(isActivePickerStoryTypePath("/live2d", "unit")).toBe(false);
  });
});
