import { describe, expect, it } from "vitest";
import type { BondsHonor, Honor } from "@platform/ui-shell/honor-degree-adapter";
import {
  parseLeaderCard,
  parseProfileHonors,
  toProfileHonorDegrees,
  type TrackerProfileHonor
} from "./tracker-player-profile";

describe("tracker player profile", () => {
  it("picks trained art only for the special_training default image", () => {
    expect(
      parseLeaderCard({
        cardId: 670,
        defaultImage: "special_training",
        specialTrainingStatus: "done"
      })
    ).toEqual({ cardId: 670, trained: true });
    expect(
      parseLeaderCard({ cardId: "12", defaultImage: "original", specialTrainingStatus: "done" })
    ).toEqual({ cardId: 12, trained: false });
    expect(parseLeaderCard({ defaultImage: "special_training" })).toBeNull();
    expect(parseLeaderCard(null)).toBeNull();
  });

  it("keeps the three profile slots in order and drops malformed entries", () => {
    expect(
      parseProfileHonors([
        { seq: 3, honorId: 30, honorLevel: 2, profileHonorType: "normal" },
        {
          seq: 2,
          honorId: 20,
          honorLevel: 1,
          bondsHonorWordId: 0,
          profileHonorType: "bonds",
          bondsHonorViewType: "reverse_unit_virtual_singer"
        },
        { seq: 1, honorId: 10, profileHonorType: "normal" },
        { seq: 1, honorId: 11, profileHonorType: "normal" },
        { seq: 4, honorId: 40, profileHonorType: "normal" },
        { seq: 2, honorId: 0, profileHonorType: "normal" },
        { seq: 2, honorId: 21, profileHonorType: "unknown" }
      ])
    ).toEqual([
      { kind: "normal", seq: 1, honorId: 10, level: null },
      {
        kind: "bonds",
        seq: 2,
        honorId: 20,
        level: 1,
        wordId: null,
        view: "reverse_unit_virtual_singer"
      },
      { kind: "normal", seq: 3, honorId: 30, level: 2 }
    ]);
    expect(parseProfileHonors(null)).toEqual([]);
  });

  it("lays titles out in the game's slots at the player's level", () => {
    const honor: Honor = {
      id: 10,
      name: "Regular",
      assetBundleName: "honor_10",
      group: null,
      groupId: 1,
      honorMissionType: null,
      honorRarity: "middle",
      honorType: "achievement",
      honorTypeId: null,
      seq: null,
      levels: [
        {
          level: 1,
          honorRarity: "middle",
          assetBundleName: null,
          honorId: 10,
          bonus: null,
          description: null
        }
      ]
    };
    const bondsHonor: BondsHonor = {
      id: 20,
      bondsGroupId: 1,
      name: "Pair",
      honorRarity: "low",
      levels: [{ level: 1, description: null }],
      words: [{ id: 5, seq: 1, assetBundleName: "word", name: null, description: null }],
      units: [
        { id: 1, gameCharacterId: 1, unit: "light_sound", colorCode: null },
        { id: 2, gameCharacterId: 2, unit: "light_sound", colorCode: null }
      ],
      configurableUnitVirtualSinger: false
    };
    const profile: TrackerProfileHonor[] = [
      { kind: "bonds", seq: 1, honorId: 20, level: 4, wordId: 5, view: "reverse" },
      { kind: "normal", seq: 2, honorId: 10, level: 3 },
      { kind: "normal", seq: 3, honorId: 99, level: 1 }
    ];

    const degrees = toProfileHonorDegrees(profile, {
      honors: [honor],
      bondsHonors: [bondsHonor],
      bondsViewData: null
    });

    expect(degrees.map(({ seq, slot, name }) => ({ seq, slot, name }))).toEqual([
      { seq: 1, slot: "main", name: "Pair" },
      { seq: 2, slot: "sub1", name: "Regular" }
    ]);
    expect(degrees[0].degree).toMatchObject({ kind: "bonds", level: 4, reverse: true });
    expect(degrees[1].degree).toMatchObject({ kind: "normal", rarity: 1, level: 3 });
  });
});
