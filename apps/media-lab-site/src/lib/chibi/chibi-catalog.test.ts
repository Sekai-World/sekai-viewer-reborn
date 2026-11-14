import { describe, expect, it } from "vitest";
import {
  describeChibiModelName,
  getChibiModelTitle,
  pickDefaultChibiAnimation
} from "./chibi-catalog";

describe("describeChibiModelName", () => {
  it.each([
    ["sd_01ichika_normal", { character: "Ichika", variant: "Normal" }],
    ["v2_sd_21miku_street_aprilfool2023", { character: "Miku", variant: "Street Aprilfool2023" }],
    ["sd_mob001", { character: null, variant: "Mob001" }],
    ["v2_sd_school_garden_m", { character: null, variant: "School Garden M" }],
    ["v2_sd_kitty", { character: null, variant: "Kitty" }]
  ])("labels %s", (modelName, expected) => {
    expect(describeChibiModelName(modelName)).toEqual(expected);
  });
});

describe("getChibiModelTitle", () => {
  it("joins the character and the variant", () => {
    expect(getChibiModelTitle("sd_01ichika_normal")).toBe("Ichika Normal");
  });

  it("uses the variant alone when the name has no character part", () => {
    expect(getChibiModelTitle("sd_mob001")).toBe("Mob001");
  });
});

describe("pickDefaultChibiAnimation", () => {
  it("prefers the first animation ending in pose_default", () => {
    expect(pickDefaultChibiAnimation(["m_walk", "m_pose_default", "w_pose_default"])).toBe(
      "m_pose_default"
    );
  });

  it("falls back to the first animation", () => {
    expect(pickDefaultChibiAnimation(["m_walk", "m_run"])).toBe("m_walk");
  });

  it("returns an empty name when the model has no animations", () => {
    expect(pickDefaultChibiAnimation([])).toBe("");
  });
});
