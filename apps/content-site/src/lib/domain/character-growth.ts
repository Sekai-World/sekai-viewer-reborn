import type { CharacterRankReference, Mission, MissionResourceBoxDetail } from "./mission";

export type CharacterRankRewardTotal = { resourceType: string; quantity: number };

export type CharacterRankSummary = {
  rankCount: number;
  maxPowerBonusRate: number | null;
  totals: CharacterRankRewardTotal[];
  /** Ranks whose rewards differ from the most common reward set; ranks without rewards are skipped. */
  milestones: CharacterRankReference[];
};

export type CharacterMissionSummary = {
  firstTarget: number | null;
  lastTarget: number | null;
  goalCount: number | null;
  isExtra: boolean;
};

const TOTAL_ORDER = [
  "jewel",
  "honor",
  "bonds_honor",
  "material",
  "stamp",
  "avatar_costume",
  "coin",
  "virtual_coin"
];

export const getCharacterRankRewardDetails = (
  rank: CharacterRankReference
): MissionResourceBoxDetail[] => rank.rewards.flatMap((box) => box.details);

const rewardSignature = (rank: CharacterRankReference): string =>
  getCharacterRankRewardDetails(rank)
    .map((detail) => `${detail.resourceType ?? ""}:${detail.resourceQuantity ?? ""}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");

const totalOrder = (resourceType: string): number => {
  const index = TOTAL_ORDER.indexOf(resourceType);
  return index === -1 ? TOTAL_ORDER.length : index;
};

export const summarizeCharacterRanks = (ranks: CharacterRankReference[]): CharacterRankSummary => {
  const signatureCounts = new Map<string, number>();
  const totals = new Map<string, number>();
  let maxPowerBonusRate: number | null = null;

  for (const rank of ranks) {
    const signature = rewardSignature(rank);
    if (signature) signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
    for (const detail of getCharacterRankRewardDetails(rank)) {
      if (!detail.resourceType) continue;
      totals.set(
        detail.resourceType,
        (totals.get(detail.resourceType) ?? 0) + (detail.resourceQuantity ?? 1)
      );
    }
    if (rank.powerBonusRate !== null) {
      maxPowerBonusRate = Math.max(maxPowerBonusRate ?? rank.powerBonusRate, rank.powerBonusRate);
    }
  }

  let standardSignature: string | null = null;
  let standardCount = 0;
  for (const [signature, count] of signatureCounts) {
    if (count > standardCount) {
      standardSignature = signature;
      standardCount = count;
    }
  }

  return {
    rankCount: ranks.length,
    maxPowerBonusRate,
    totals: [...totals]
      .map(([resourceType, quantity]) => ({ resourceType, quantity }))
      .sort(
        (left, right) =>
          totalOrder(left.resourceType) - totalOrder(right.resourceType) ||
          left.resourceType.localeCompare(right.resourceType)
      ),
    milestones: ranks.filter((rank) => {
      const signature = rewardSignature(rank);
      return signature !== "" && signature !== standardSignature;
    })
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
