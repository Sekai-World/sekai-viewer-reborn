import type {
  EventRankingRewardRange,
  EventRewardHonor,
  EventRewardHonorGroup,
  EventRewardHonorLevel,
  EventRewardResourceBoxDetail
} from "$lib/domain/event-detail";

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const getStringLike = (value: unknown): string | null =>
  getString(value) ?? (typeof value === "number" && Number.isFinite(value) ? String(value) : null);

const parseHonorGroup = (value: unknown): EventRewardHonorGroup | null => {
  const node = getObject(value);
  if (!node) return null;

  return {
    id: getStringLike(node.id),
    honorType: getString(node.honorType),
    backgroundAssetBundleName:
      getString(node.backgroundAssetbundleName) ?? getString(node.backgroundAssetBundleName),
    frameName: getString(node.frameName)
  };
};

const parseHonorLevel = (value: unknown): EventRewardHonorLevel | null => {
  const node = getObject(value);
  if (!node) return null;

  return {
    honorId: getStringLike(node.honorId),
    level: getNumber(node.level),
    honorRarity: getString(node.honorRarity),
    assetBundleName: getString(node.assetbundleName) ?? getString(node.assetBundleName)
  };
};

const parseHonor = (value: unknown): EventRewardHonor | null => {
  const node = getObject(value);
  if (!node) return null;

  return {
    id: getStringLike(node.id),
    groupId: getStringLike(node.groupId),
    honorRarity: getString(node.honorRarity),
    honorMissionType: getString(node.honorMissionType),
    honorType: getString(node.honorType),
    assetBundleName: getString(node.assetbundleName) ?? getString(node.assetBundleName),
    levels: getArray(node.levels).flatMap((item) => {
      const level = parseHonorLevel(item);
      return level ? [level] : [];
    }),
    group: parseHonorGroup(node.group)
  };
};

const parseResourceBoxDetail = (value: unknown): EventRewardResourceBoxDetail | null => {
  const node = getObject(value);
  if (!node) return null;

  return {
    resourceType: getString(node.resourceType),
    resourceId: getStringLike(node.resourceId),
    resourceLevel: getNumber(node.resourceLevel),
    resourceQuantity: getNumber(node.resourceQuantity),
    seq: getNumber(node.seq),
    honor: parseHonor(node.honor)
  };
};

export const parseEventRewardRanges = (payload: unknown): EventRankingRewardRange[] => {
  const root = getObject(payload);
  return getArray(root?.items).flatMap((item) => {
    const range = getObject(item);
    if (!range) return [];

    return [
      {
        fromRank: getNumber(range.fromRank),
        toRank: getNumber(range.toRank),
        isToRankBorder: typeof range.isToRankBorder === "boolean" ? range.isToRankBorder : null,
        rewardCount: getArray(range.eventRankingRewards).length,
        rewards: getArray(range.eventRankingRewards).flatMap((value) => {
          const reward = getObject(value);
          if (!reward) return [];

          const resourceBox = getObject(reward.resourceBox);
          return [
            {
              id: getStringLike(reward.id),
              resourceBoxId: getStringLike(reward.resourceBoxId),
              conditionValue: getNumber(reward.conditionValue),
              rewardConditionType: getString(reward.rewardConditionType),
              seq: getNumber(reward.seq),
              resourceBoxPurpose: getString(resourceBox?.resourceBoxPurpose),
              resourceBoxDetails: getArray(resourceBox?.details).flatMap((detail) => {
                const parsed = parseResourceBoxDetail(detail);
                return parsed ? [parsed] : [];
              })
            }
          ];
        })
      }
    ];
  });
};
