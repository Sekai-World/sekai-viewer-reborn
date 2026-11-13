import { describe, expect, it } from "vitest";
import { resolveChibiModelDescriptor } from "./chibi-model";

const BUCKET = "https://storage.sekai.best/sekai-jp-assets/";

describe("resolveChibiModelDescriptor", () => {
  it.each([
    {
      modelName: "sd_01ichika_normal",
      family: "main",
      folder: "area_sd/sd_main/sd_01ichika_normal/",
      skeleton: "area_sd/sd_main/base_model/sd_main.skel"
    },
    {
      modelName: "v2_sd_01ichika_casual",
      family: "v2",
      folder: "area_sd/v2_sd_main/v2_sd_01ichika_casual/",
      skeleton: "area_sd/v2_sd_main/v2_base_model/v2_sd_main.skel"
    },
    {
      modelName: "sd_mob001",
      family: "mob",
      folder: "area_sd/sd_mob/sd_mob001/",
      skeleton: "area_sd/sd_mob/base_model_mob/sd_mob.skel"
    }
  ])("resolves the $family family", ({ modelName, family, folder, skeleton }) => {
    expect(resolveChibiModelDescriptor(modelName)).toEqual({
      status: "ok",
      descriptor: {
        modelName,
        family,
        region: "jp",
        atlasUrl: `${BUCKET}${folder}sekai_atlas.atlas.txt`,
        textureUrl: `${BUCKET}${folder}sekai_atlas.png`,
        skeletonUrl: `${BUCKET}${skeleton}`
      }
    });
  });

  it("returns a descriptor that survives JSON serialization", () => {
    const result = resolveChibiModelDescriptor("sd_01ichika_normal");

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it.each([
    ["an unknown family", "v3_sd_01ichika"],
    ["a bare family prefix", "sd_mob"],
    ["a path separator", "sd_main/../secret"],
    ["an uppercase name", "SD_01ichika_normal"],
    ["a query string", "sd_01ichika_normal?x=1"],
    ["an empty string", ""],
    ["a non-string value", 12]
  ])("rejects %s", (_label, modelName) => {
    expect(resolveChibiModelDescriptor(modelName).status).toBe("invalid");
  });
});
