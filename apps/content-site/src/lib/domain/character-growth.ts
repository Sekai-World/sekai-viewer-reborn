import type { CharacterRankReference, Mission, MissionResourceBoxDetail } from "./mission";
import { summarizeRewardLadder, type RewardLadderSummary, type RewardTotal } from "./reward-ladder";

export type CharacterRankRewardTotal = RewardTotal;

export type CharacterRankSummary = RewardLadderSummary<CharacterRankReference> & {
  rankCount: number;
  maxPowerBonusRate: number | null;
};

export type CharacterMissionSummary = {
  firstTarget: number | null;
  lastTarget: number | null;
  goalCount: number | null;
  isExtra: boolean;
};

export const getCharacterRankRewardDetails = (
  rank: CharacterRankReference
): MissionResourceBoxDetail[] => rank.rewards.flatMap((box) => box.details);

export const summarizeCharacterRanks = (ranks: CharacterRankReference[]): CharacterRankSummary => {
  const bonusRates = ranks.flatMap((rank) =>
    rank.powerBonusRate === null ? [] : [rank.powerBonusRate]
  );
  return {
    ...summarizeRewardLadder(ranks, getCharacterRankRewardDetails),
    rankCount: ranks.length,
    maxPowerBonusRate: bonusRates.length > 0 ? Math.max(...bonusRates) : null
  };
};

export const summarizeCharacterMission = (mission: Mission): CharacterMissionSummary => {
  const group = mission.parameterGroup;
  return {
    firstTarget: group?.levels[0]?.requirement ?? null,
    lastTarget: group?.lastLevel?.requirement ?? group?.levels.at(-1)?.requirement ?? null,
    goalCount: group?.totalLevels ?? null,
    isExtra: mission.characterMissionType?.endsWith("_ex") ?? false
  };
};

export const countCharacterMissionGoals = (missions: Mission[]): number =>
  missions.reduce((sum, mission) => sum + (mission.parameterGroup?.totalLevels ?? 0), 0);

/** Replaces the per-level target placeholders, since a character mission spans many targets. */
export const formatCharacterMissionSentence = (sentence: string): string =>
  sentence.replaceAll("{requirement}", "…").replaceAll("{progress}", "…");
