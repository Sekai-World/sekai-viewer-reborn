import { describe, expect, it } from "vitest";
import type { GachaBehavior } from "$lib/domain/gacha-detail";
import {
  getGuaranteeLevel,
  isRarityAtLeast,
  parsePullRequestBody,
  resolveSelectedBehavior,
  RARITY_VALUE
} from "./pull-behavior";

const createBehavior = (gachaBehaviorType: string, gachaSpinnableType: string): GachaBehavior => ({
  id: `${gachaBehaviorType}:${gachaSpinnableType}`,
  gachaBehaviorType,
  gachaSpinnableType,
  costResourceType: null,
  costResourceQuantity: null,
  costResourceId: null,
  costResourceAssetBundleName: null,
  resourceCategory: null,
  spinCount: null,
  executeLimit: null,
  priority: null
});

describe("parsePullRequestBody", () => {
  it("accepts only non-empty string behavior selectors", () => {
    expect(
      parsePullRequestBody({
        count: 10,
        behaviorType: " normal ",
        spinnableType: " any "
      })
    ).toEqual({ count: 10, behaviorType: "normal", spinnableType: "any" });

    expect(
      parsePullRequestBody({ count: 10, behaviorType: { value: "normal" }, spinnableType: 1 })
    ).toEqual({ count: 10, behaviorType: null, spinnableType: null });
  });

  it("does not treat non-object JSON as a request body", () => {
    expect(parsePullRequestBody(null)).toEqual({
      count: undefined,
      behaviorType: null,
      spinnableType: null
    });
    expect(parsePullRequestBody(["normal"])).toEqual({
      count: undefined,
      behaviorType: null,
      spinnableType: null
    });
  });
});

describe("resolveSelectedBehavior", () => {
  it("uses an explicit normal behavior instead of the legacy over-rarity fallback", () => {
    const legacyBehavior = createBehavior("over_rarity_4_once", "any");
    const normalBehavior = createBehavior("normal", "any");

    const selected = resolveSelectedBehavior([legacyBehavior, normalBehavior], "normal");

    expect(selected).toBe(normalBehavior);
    expect(getGuaranteeLevel(selected)).toBe(0);
  });

  it.each([
    ["over_rarity_3_once", 3],
    ["over_rarity_4_once", 4]
  ] as const)("maps %s to guarantee level %s", (behaviorType, expectedLevel) => {
    const behavior = createBehavior(behaviorType, "any");

    expect(getGuaranteeLevel(resolveSelectedBehavior([behavior], behaviorType))).toBe(expectedLevel);
  });

  it("classifies birthday cards as four-star cards for guarantees", () => {
    expect(RARITY_VALUE.rarity_birthday).toBe(4);
    expect(isRarityAtLeast("rarity_birthday", 3)).toBe(true);
    expect(isRarityAtLeast("rarity_birthday", 4)).toBe(true);
  });

  it("keeps the first over-rarity behavior for legacy requests", () => {
    const normalBehavior = createBehavior("normal", "any");
    const firstGuaranteeBehavior = createBehavior("over_rarity_3_once", "any");
    const secondGuaranteeBehavior = createBehavior("over_rarity_4_once", "any");

    expect(
      resolveSelectedBehavior([normalBehavior, firstGuaranteeBehavior, secondGuaranteeBehavior])
    ).toBe(firstGuaranteeBehavior);
  });

  it("matches the requested behavior and spinnable type together", () => {
    const anyBehavior = createBehavior("over_rarity_4_once", "any");
    const colorfulPassBehavior = createBehavior("over_rarity_4_once", "colorful_pass");

    expect(
      resolveSelectedBehavior(
        [anyBehavior, colorfulPassBehavior],
        "over_rarity_4_once",
        "colorful_pass"
      )
    ).toBe(colorfulPassBehavior);
  });

  it("does not select a different spinnable behavior when the pair is unavailable", () => {
    const anyBehavior = createBehavior("over_rarity_4_once", "any");

    expect(resolveSelectedBehavior([anyBehavior], "over_rarity_4_once", "colorful_pass")).toBeNull();
  });
});
