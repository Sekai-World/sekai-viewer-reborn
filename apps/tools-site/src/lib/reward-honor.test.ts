import type {
  SharedEventRewardRangeResponse,
  SharedEventRewardResourceBoxDetail
} from "@platform/sekai-master-api-sdk";
import { describe, expect, it } from "vitest";
import { adaptRewardHonor, selectRewardHonor } from "./reward-honor";

const detail = {
  resourceType: "honor",
  resourceLevel: 7,
  honor: {
    name: " Reward honor ",
    assetbundleName: "master",
    honorRarity: "high",
    group: {
      honorType: "character",
      frameName: "frame",
      backgroundAssetbundleName: "group-background"
    },
    levels: [{ level: 7, assetbundleName: "level_seven", honorRarity: "middle" }]
  }
} satisfies SharedEventRewardResourceBoxDetail;

describe("reward honor adapter", () => {
  it("maps regular honor fields and an explicit positive reward level", () => {
    expect(adaptRewardHonor(detail)).toEqual({
      kind: "normal",
      honorType: "regular",
      assetBundleName: "master",
      group: { frameName: "frame" },
      rarity: "high",
      level: 7,
      rankAsset: null
    });
  });

  it.each(["event", "event_point"])("uses master-level rank art for %s", (honorType) => {
    expect(
      adaptRewardHonor({
        ...detail,
        honor: {
          ...detail.honor,
          group: { honorType, backgroundAssetbundleName: "background", frameName: "frame" }
        }
      })
    ).toMatchObject({
      kind: "normal",
      honorType: "event",
      assetBundleName: "master",
      rankAsset: { bundlePath: "honor/master", resourceName: "rank_main.png" }
    });
    expect(
      adaptRewardHonor({
        honor: {
          assetbundleName: "",
          group: { honorType, backgroundAssetbundleName: "background" },
          levels: [{ level: 1, assetbundleName: "not_a_rank" }]
        }
      })
    ).toBeNull();
  });

  it("uses rank-match backgrounds and the app-local rarity frame", () => {
    expect(
      adaptRewardHonor({
        ...detail,
        honor: {
          ...detail.honor,
          group: { honorType: "rank_match", backgroundAssetbundleName: "season" }
        }
      })
    ).toEqual({
      kind: "rank-match",
      assetBundleName: "master",
      backgroundAssetBundleName: "season",
      rarity: "high",
      frameBundlePath: "local/honor"
    });
  });

  it("allows rank-match background-only data without inventing a master rank asset", () => {
    expect(
      adaptRewardHonor({
        honor: {
          honorRarity: "middle",
          group: { honorType: "rank_match", backgroundAssetbundleName: "season" }
        }
      })
    ).toEqual({
      kind: "rank-match",
      assetBundleName: null,
      backgroundAssetBundleName: "season",
      rarity: "middle",
      frameBundlePath: "local/honor"
    });
  });

  it("maps birthday honors and falls back to the selected level's assets and rarity", () => {
    expect(
      adaptRewardHonor({
        resourceLevel: 7,
        honor: {
          honorType: "birthday",
          levels: detail.honor.levels,
          group: { frameName: "birthday" }
        }
      })
    ).toMatchObject({
      kind: "normal",
      honorType: "birthday",
      level: 7,
      rarity: "middle",
      assetBundleName: "level_seven",
      group: { frameName: "birthday" }
    });
  });

  it("uses a valid selected-level bundle only as a non-event fallback", () => {
    expect(
      adaptRewardHonor({
        resourceLevel: 7,
        honor: {
          group: { honorType: "character", backgroundAssetbundleName: "not-a-body" },
          levels: [{ level: 7, assetbundleName: "level_seven" }]
        }
      })
    ).toMatchObject({ kind: "normal", assetBundleName: "level_seven" });
    expect(
      adaptRewardHonor({
        resourceLevel: 7,
        honor: {
          group: { honorType: "character" },
          levels: [{ level: 7, assetbundleName: "../invalid" }]
        }
      })
    ).toBeNull();
  });

  it("chooses the lowest supplied positive level deterministically without mutating data", () => {
    const levels = [
      { level: 6, assetbundleName: "six" },
      { level: 0 },
      { level: 2, assetbundleName: "two" }
    ];
    expect(adaptRewardHonor({ honor: { levels } })).toMatchObject({
      level: 2,
      assetBundleName: "two"
    });
    expect(levels.map((level) => level.level)).toEqual([6, 0, 2]);
  });

  it.each([0, -1, 1.5, NaN, Infinity])(
    "does not invent level icons for invalid level %s",
    (resourceLevel) => {
      expect(
        adaptRewardHonor({
          resourceLevel,
          honor: { assetbundleName: "base", honorRarity: "unknown" }
        })
      ).toMatchObject({ level: null, rarity: null });
    }
  );

  it("omits unavailable and non-honor media rather than rendering a frame alone", () => {
    expect(adaptRewardHonor({})).toBeNull();
    expect(
      adaptRewardHonor({ honor: { name: "Name only", group: { frameName: "frame" } } })
    ).toBeNull();
    expect(adaptRewardHonor({ ...detail, resourceType: "bonds_honor" })).toBeNull();
    expect(
      adaptRewardHonor({
        honor: { assetbundleName: "bonds", honorType: "bonds_honor" }
      })
    ).toBeNull();
    expect(adaptRewardHonor({ honor: { assetbundleName: "../invalid" } })).toBeNull();
  });
});

describe("selectRewardHonor", () => {
  it("traverses multiple ranking rewards and details to find usable honor media", () => {
    const reward = {
      eventRankingRewards: [
        {},
        { resourceBox: { details: [{ resourceType: "jewel" }, { honor: { name: "Text only" } }] } },
        { resourceBox: { details: [detail, { honor: { assetbundleName: "later" } }] } }
      ]
    } satisfies SharedEventRewardRangeResponse;
    expect(selectRewardHonor(reward)).toEqual({
      label: "Reward honor",
      honor: adaptRewardHonor(detail)
    });
  });

  it("preserves name-only text when data or assets are missing", () => {
    expect(selectRewardHonor(null)).toEqual({ label: null, honor: null });
    expect(selectRewardHonor({})).toEqual({ label: null, honor: null });
    expect(
      selectRewardHonor({
        eventRankingRewards: [
          {
            resourceBox: {
              details: [{ honor: { name: " " } }, { honor: { name: " Name only " } }]
            }
          }
        ]
      })
    ).toEqual({ label: "Name only", honor: null });
  });

  it("keeps a bonds-honor name as text while omitting its renderer input", () => {
    expect(
      selectRewardHonor({
        eventRankingRewards: [
          {
            resourceBox: {
              details: [
                {
                  resourceType: "bonds_honor",
                  honor: { name: "Bonds Honor", assetbundleName: "bonds" }
                }
              ]
            }
          }
        ]
      })
    ).toEqual({ label: "Bonds Honor", honor: null });
  });
});
