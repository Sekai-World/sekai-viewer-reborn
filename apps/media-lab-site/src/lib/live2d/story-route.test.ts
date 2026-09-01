import { describe, expect, it } from "vitest";
import {
  isStoryRouteRegion,
  isStoryRouteStoryId,
  isStoryRouteStoryType,
  parseStoryRouteParams,
  storyRouteStoryTypes
} from "./story-route";

describe("media-lab-site story route params", () => {
  it("exposes the draft story type vocabulary for route validation", () => {
    expect(storyRouteStoryTypes).toEqual([
      "unit",
      "event",
      "character",
      "card",
      "area-talk",
      "special",
      "profile"
    ]);
  });

  it("accepts supported regions and rejects unknown ones", () => {
    expect(isStoryRouteRegion("jp")).toBe(true);
    expect(isStoryRouteRegion("cn")).toBe(true);
    expect(isStoryRouteRegion("xx")).toBe(false);
    expect(isStoryRouteRegion("")).toBe(false);
  });

  it("accepts known story types and rejects unknown ones", () => {
    expect(isStoryRouteStoryType("area-talk")).toBe(true);
    expect(isStoryRouteStoryType("unit")).toBe(true);
    expect(isStoryRouteStoryType("song")).toBe(false);
    expect(isStoryRouteStoryType("")).toBe(false);
  });

  it("keeps story ids path-safe and bounded", () => {
    expect(isStoryRouteStoryId("1")).toBe(true);
    expect(isStoryRouteStoryId("story_01-a")).toBe(true);
    expect(isStoryRouteStoryId("")).toBe(false);
    expect(isStoryRouteStoryId("../escape")).toBe(false);
    expect(isStoryRouteStoryId("a/b")).toBe(false);
    expect(isStoryRouteStoryId("a b")).toBe(false);
    expect(isStoryRouteStoryId("a".repeat(129))).toBe(false);
    expect(isStoryRouteStoryId("a".repeat(128))).toBe(true);
  });

  it("parses a valid route into a normalized story identity", () => {
    expect(parseStoryRouteParams({ region: "jp", storyType: "unit", storyId: "1" })).toEqual({
      status: "ok",
      identity: { region: "jp", storyType: "unit", storyId: "1" }
    });
    expect(parseStoryRouteParams({ region: " JP ", storyType: "unit", storyId: " 12 " })).toEqual({
      status: "ok",
      identity: { region: "jp", storyType: "unit", storyId: "12" }
    });
  });

  it("reports the first invalid param in route order", () => {
    expect(parseStoryRouteParams({ region: "xx", storyType: "unit", storyId: "1" })).toEqual({
      status: "invalid-region"
    });
    expect(parseStoryRouteParams({ region: "jp", storyType: "song", storyId: "1" })).toEqual({
      status: "invalid-story-type"
    });
    expect(parseStoryRouteParams({ region: "jp", storyType: "unit", storyId: "../1" })).toEqual({
      status: "invalid-story-id"
    });
    expect(parseStoryRouteParams({})).toEqual({ status: "invalid-region" });
  });
});
