import { describe, expect, it } from "vitest";
import { isModelRouteId, parseModelRouteParams } from "./model-route";

describe("media-lab-site model viewer route params", () => {
  it("keeps model ids path-safe and bounded", () => {
    expect(isModelRouteId("normal_miku_v3")).toBe(true);
    expect(isModelRouteId("sample-model")).toBe(true);
    expect(isModelRouteId("")).toBe(false);
    expect(isModelRouteId("../escape")).toBe(false);
    expect(isModelRouteId("a/b")).toBe(false);
    expect(isModelRouteId("a b")).toBe(false);
    expect(isModelRouteId("a".repeat(129))).toBe(false);
    expect(isModelRouteId("a".repeat(128))).toBe(true);
  });

  it("parses a valid route into a normalized model identity", () => {
    expect(parseModelRouteParams({ modelId: "normal_miku_v3" })).toEqual({
      status: "ok",
      modelId: "normal_miku_v3"
    });
    expect(parseModelRouteParams({ modelId: " sample-model " })).toEqual({
      status: "ok",
      modelId: "sample-model"
    });
  });

  it("preserves case so future model-list matching stays exact", () => {
    expect(parseModelRouteParams({ modelId: "NormalMiku" })).toEqual({
      status: "ok",
      modelId: "NormalMiku"
    });
  });

  it("rejects missing or unsafe model ids", () => {
    expect(parseModelRouteParams({})).toEqual({ status: "invalid-model-id" });
    expect(parseModelRouteParams({ modelId: "../1" })).toEqual({
      status: "invalid-model-id"
    });
    expect(parseModelRouteParams({ modelId: "a b" })).toEqual({
      status: "invalid-model-id"
    });
  });
});
