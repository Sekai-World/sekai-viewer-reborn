import { describe, expect, it } from "vitest";
import { toLive2dCatalogSummary, type Live2dCatalogRouteData } from "./catalog-route-data";

const motionSet = {
  motionSetId: "ichika-motion",
  motionPath: "motion/ichika",
  motionFiles: ["wave.motion3.json"],
  facialPath: "motion/ichika-face",
  facialFiles: [],
  bodyMotions: [{ id: "wave.motion3.json", url: "/live2d/assets/motion/ichika/wave.motion3.json" }],
  facialMotions: []
};

const readyRouteData: Live2dCatalogRouteData = {
  status: "ready",
  source: "network",
  reason: "catalog loaded from network",
  models: [
    {
      id: "ichika",
      modelId: "ichika",
      region: "jp",
      characterId: 1,
      character2dId: 101,
      characterType: "game_character",
      modelBase: "ichika_base",
      modelFile: "ichika.model3.json",
      modelName: "ichika",
      modelPath: "model/ichika",
      modelUrl: "/live2d/assets/model/ichika/ichika.model3.json",
      motionSets: [motionSet]
    },
    {
      id: "ichika-2",
      modelId: "ichika-2",
      region: "jp",
      character2dId: 102,
      modelBase: "ichika_alt",
      modelFile: "ichika.model3.json",
      modelName: "ichika",
      modelPath: "model/ichika-alt",
      modelUrl: "/live2d/assets/model/ichika-alt/ichika.model3.json",
      motionSets: [motionSet]
    }
  ]
};

describe("toLive2dCatalogSummary", () => {
  it("keeps only the fields the catalog page renders or groups by", () => {
    expect(toLive2dCatalogSummary(readyRouteData)).toEqual({
      status: "ready",
      models: [
        {
          id: "ichika",
          modelName: "ichika",
          modelBase: "ichika_base",
          characterId: 1,
          characterType: "game_character"
        },
        { id: "ichika-2", modelName: "ichika", modelBase: "ichika_alt" }
      ]
    });
  });

  it("passes unavailable and error catalogs through unchanged", () => {
    const unavailable: Live2dCatalogRouteData = {
      status: "unavailable",
      reason: "offline",
      models: []
    };
    const failed: Live2dCatalogRouteData = { status: "error", reason: "failed", models: [] };

    expect(toLive2dCatalogSummary(unavailable)).toBe(unavailable);
    expect(toLive2dCatalogSummary(failed)).toBe(failed);
  });
});
