import { describe, expect, it } from "vitest";
import {
  countCharacterMissionGoals,
  formatCharacterMissionSentence,
  summarizeCharacterMission,
  summarizeCharacterRanks
} from "./character-growth";
import type { CharacterRankReference, Mission } from "./mission";

const rank = (
  characterRank: number,
  rewards: [string, number | null][],
  powerBonusRate: number | null = null
): CharacterRankReference => ({
  characterRank,
  powerBonusRate,
  rewards: [
    {
      id: characterRank,
      resourceBoxPurpose: "character_rank_reward",
      resourceBoxType: "expand",
      details: rewards.map(([resourceType, resourceQuantity], index) => ({
        resourceBoxId: characterRank,
        resourceBoxPurpose: "character_rank_reward",
        resourceId: null,
        resourceLevel: null,
        resourceQuantity,
        resourceType,
        seq: index + 1
      }))
    }
  ]
});

const mission = (overrides: Partial<Mission>): Mission => ({
  id: 1001,
  family: "characterMissionV2s",
  characterId: 1,
  characterMissionType: "play_live",
  eventId: null,
  isAchievementMission: true,
  normalMissionType: null,
  parameterGroup: null,
  parameterGroupId: 1,
  progressSentence: null,
  requirement: null,
  resourceBoxId: null,
  rewards: [],
  sentence: "Clear {requirement} lives",
  seq: 1,
  storyMissionType: null,
  ...overrides
});

describe("summarizeCharacterRanks", () => {
  it("treats the most common reward set as standard and lists the other ranks as milestones", () => {
    const summary = summarizeCharacterRanks([
      rank(1, [], 0.1),
      rank(2, [["material", 2]], 0.2),
      rank(3, [["jewel", 100]], 0.3),
      rank(4, [["jewel", 100]], 0.4),
      rank(5, [
        ["honor", 1],
        ["jewel", 300]
      ]),
      rank(6, [["jewel", 100]], 5),
      rank(7, [["avatar_costume", null]])
    ]);

    expect(summary.rankCount).toBe(7);
    expect(summary.maxPowerBonusRate).toBe(5);
    expect(summary.milestones.map((item) => item.characterRank)).toEqual([2, 5, 7]);
    expect(
      summary.totals.map(({ resourceType, quantity }) => ({ resourceType, quantity }))
    ).toEqual([
      { resourceType: "jewel", quantity: 600 },
      { resourceType: "honor", quantity: 1 },
      { resourceType: "material", quantity: 2 },
      { resourceType: "avatar_costume", quantity: 1 }
    ]);
  });

  it("returns an empty summary without ranks", () => {
    expect(summarizeCharacterRanks([])).toEqual({
      rankCount: 0,
      maxPowerBonusRate: null,
      totals: [],
      milestones: []
    });
  });
});

describe("character mission summaries", () => {
  it("reports the first and final targets, the goal count, and EX missions", () => {
    const group = {
      id: 1,
      levels: [{ seq: 1, requirement: 10, exp: 1, quantity: 0 }],
      lastLevel: { seq: 140, requirement: 50000, exp: 1, quantity: 0 },
      totalLevels: 140
    };

    expect(summarizeCharacterMission(mission({ parameterGroup: group }))).toEqual({
      firstTarget: 10,
      lastTarget: 50000,
      goalCount: 140,
      isExtra: false
    });
    expect(
      summarizeCharacterMission(
        mission({ characterMissionType: "play_live_ex", parameterGroup: null })
      )
    ).toEqual({ firstTarget: null, lastTarget: null, goalCount: null, isExtra: true });
    expect(
      countCharacterMissionGoals([
        mission({ parameterGroup: group }),
        mission({ id: 1002, parameterGroup: { ...group, totalLevels: 72 } }),
        mission({ id: 1003, parameterGroup: null })
      ])
    ).toBe(212);
  });

  it("replaces per-level target placeholders", () => {
    expect(formatCharacterMissionSentence("Clear {requirement} lives ({progress})")).toBe(
      "Clear … lives (…)"
    );
  });
});
