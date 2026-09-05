import type { GachaBehavior } from "$lib/domain/gacha-detail";

export type PullRequestBody = {
  count: unknown;
  behaviorType: string | null;
  spinnableType: string | null;
};

export const RARITY_VALUE: Readonly<Record<string, number>> = {
  rarity_1: 1,
  rarity_2: 2,
  rarity_3: 3,
  rarity_4: 4,
  rarity_birthday: 4
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeBehaviorValue = (value: string | null | undefined): string | null =>
  getNonEmptyString(value);

export const parsePullRequestBody = (value: unknown): PullRequestBody => {
  const body = getObject(value);

  return {
    count: body?.count,
    behaviorType: getNonEmptyString(body?.behaviorType),
    spinnableType: getNonEmptyString(body?.spinnableType)
  };
};

export const resolveSelectedBehavior = (
  behaviors: readonly GachaBehavior[],
  behaviorType?: string | null,
  spinnableType?: string | null
): GachaBehavior | null => {
  const requestedBehaviorType = normalizeBehaviorValue(behaviorType);
  const requestedSpinnableType = normalizeBehaviorValue(spinnableType);

  if (requestedBehaviorType) {
    if (requestedSpinnableType) {
      return (
        behaviors.find(
          (behavior) =>
            normalizeBehaviorValue(behavior.gachaBehaviorType) === requestedBehaviorType &&
            normalizeBehaviorValue(behavior.gachaSpinnableType) === requestedSpinnableType
        ) ?? null
      );
    }

    return (
      behaviors.find(
        (behavior) => normalizeBehaviorValue(behavior.gachaBehaviorType) === requestedBehaviorType
      ) ?? null
    );
  }

  return (
    behaviors.find((behavior) =>
      normalizeBehaviorValue(behavior.gachaBehaviorType)?.startsWith("over_rarity")
    ) ?? null
  );
};

export const getGuaranteeLevel = (behavior: GachaBehavior | null | undefined): number => {
  switch (normalizeBehaviorValue(behavior?.gachaBehaviorType)) {
    case "over_rarity_3_once":
      return 3;
    case "over_rarity_4_once":
      return 4;
    default:
      return 0;
  }
};

export const isRarityAtLeast = (rarityType: string, guaranteeLevel: number): boolean =>
  (RARITY_VALUE[rarityType] ?? 0) >= guaranteeLevel;
