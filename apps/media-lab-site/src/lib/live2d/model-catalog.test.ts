import { describe, expect, it } from "vitest";
import live2dMessages from "@platform/i18n-source/media-lab-site/live2d.json";
import { isModelRouteId } from "./model-route";
import { previewLive2dModelEntries, resolveModelSelection } from "./model-catalog";

describe("media-lab-site preview model catalog", () => {
  it("keeps every placeholder entry path-safe and unique", () => {
    const ids = previewLive2dModelEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(isModelRouteId(id)).toBe(true);
    }
  });

  it("keeps placeholder display strings externalized in the live2d namespace", () => {
    for (const entry of previewLive2dModelEntries) {
      // The route resolves these keys dynamically, so the literal-key i18n
      // checker cannot see them; this guards the externalization contract.
      expect(entry.titleKey in live2dMessages).toBe(true);
      expect(entry.descriptionKey in live2dMessages).toBe(true);
    }
  });

  it("resolves known catalog entries case-sensitively", () => {
    expect(resolveModelSelection(" sample-model ", previewLive2dModelEntries)).toEqual({
      status: "known",
      modelId: "sample-model"
    });
    expect(resolveModelSelection("preview-model-01", previewLive2dModelEntries)).toEqual({
      status: "known",
      modelId: "preview-model-01"
    });
    expect(resolveModelSelection("Sample-Model", previewLive2dModelEntries)).toEqual({
      status: "path-safe",
      modelId: "Sample-Model"
    });
  });

  it("keeps unknown path-safe ids navigable to the stub viewer route", () => {
    expect(resolveModelSelection("future_model_v2", previewLive2dModelEntries)).toEqual({
      status: "path-safe",
      modelId: "future_model_v2"
    });
  });

  it("rejects empty or unsafe ids", () => {
    expect(resolveModelSelection("   ", previewLive2dModelEntries)).toEqual({ status: "invalid" });
    expect(resolveModelSelection("../escape", previewLive2dModelEntries)).toEqual({
      status: "invalid"
    });
    expect(resolveModelSelection("a b", previewLive2dModelEntries)).toEqual({ status: "invalid" });
  });
});
