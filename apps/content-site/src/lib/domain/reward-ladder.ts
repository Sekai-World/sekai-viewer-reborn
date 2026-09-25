import type { MissionResourceBoxDetail } from "./mission";

export type RewardTotal = {
  resourceType: string;
  quantity: number;
  /** One detail of this total, which carries the item's ID and name for its icon. */
  detail: MissionResourceBoxDetail;
};

// Items whose ID names a distinct item, so each keeps its own total.
const ITEM_TYPES_BY_ID = new Set([
  "material",
  "gacha_ticket",
  "skill_practice_ticket",
  "boost_item"
]);

const totalKey = (detail: MissionResourceBoxDetail): string =>
  ITEM_TYPES_BY_ID.has(detail.resourceType ?? "") && detail.resourceId !== null
    ? `${detail.resourceType}:${detail.resourceId}`
    : (detail.resourceType ?? "");

export type RewardLadderSummary<T> = {
  totals: RewardTotal[];
  /** Steps whose rewards differ from the most common reward set; steps without rewards are skipped. */
  milestones: T[];
};

const TOTAL_ORDER = [
  "jewel",
  "gacha_ticket",
  "honor",
  "bonds_honor",
  "material",
  "stamp",
  "avatar_costume",
  "coin",
  "virtual_coin"
];

const totalOrder = (resourceType: string): number => {
  const index = TOTAL_ORDER.indexOf(resourceType);
  return index === -1 ? TOTAL_ORDER.length : index;
};

const rewardSignature = (details: MissionResourceBoxDetail[]): string =>
  details
    .map((detail) => `${totalKey(detail)}:${detail.resourceQuantity ?? ""}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");

/**
 * Totals every reward in a ladder of steps (ranks, targets) and picks the milestone steps:
 * those whose reward set differs from the most common one, so repeated standard rewards
 * collapse while notable steps stay visible.
 */
export const summarizeRewardLadder = <T>(
  steps: T[],
  getDetails: (step: T) => MissionResourceBoxDetail[]
): RewardLadderSummary<T> => {
  const signatureCounts = new Map<string, number>();
  const totals = new Map<string, RewardTotal>();

  for (const step of steps) {
    const details = getDetails(step);
    const signature = rewardSignature(details);
    if (signature) signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
    for (const detail of details) {
      if (!detail.resourceType) continue;
      const key = totalKey(detail);
      const total = totals.get(key);
      if (total) total.quantity += detail.resourceQuantity ?? 1;
      else
        totals.set(key, {
          resourceType: detail.resourceType,
          quantity: detail.resourceQuantity ?? 1,
          detail
        });
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
    totals: [...totals.values()].sort(
      (left, right) =>
        totalOrder(left.resourceType) - totalOrder(right.resourceType) ||
        left.resourceType.localeCompare(right.resourceType) ||
        (left.detail.resourceId ?? 0) - (right.detail.resourceId ?? 0)
    ),
    milestones: steps.filter((step) => {
      const signature = rewardSignature(getDetails(step));
      return signature !== "" && signature !== standardSignature;
    })
  };
};
