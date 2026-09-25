import type {
  SharedEventRewardRangeResponse,
  SharedEventRewardResourceBoxDetail
} from "@platform/sekai-master-api-sdk";
import type { HonorDegreeInput, HonorDegreeRarity } from "@platform/ui-shell";

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const bundleName = (value: unknown): string | null => {
  const name = text(value);
  return name && /^[\w-]+$/.test(name) ? name : null;
};
const positiveLevel = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const rarity = (value: unknown): HonorDegreeRarity | null =>
  value === "low" || value === "middle" || value === "high" || value === "highest" ? value : null;

export type RewardHonorInput = Extract<HonorDegreeInput, { kind: "normal" | "rank-match" }>;

type RewardHonorLevel = NonNullable<
  NonNullable<SharedEventRewardResourceBoxDetail["honor"]>["levels"]
>[number];

const sortedPositiveLevels = (levels: RewardHonorLevel[] | undefined): RewardHonorLevel[] =>
  (Array.isArray(levels) ? levels : [])
    .filter((entry) => entry && positiveLevel(entry.level))
    .toSorted((a, b) => (a.level ?? 0) - (b.level ?? 0));

const normalHonorType = (
  type: string | null,
  isEvent: boolean
): "event" | "birthday" | "regular" => {
  if (isEvent) return "event";
  if (type === "birthday") return "birthday";
  return "regular";
};

const adaptRankMatchHonor = (
  masterBundle: string | null,
  background: string | null,
  selectedRarity: HonorDegreeRarity | null
): RewardHonorInput | null => {
  if (!masterBundle && !background) return null;
  return {
    kind: "rank-match",
    assetBundleName: masterBundle,
    backgroundAssetBundleName: background ?? masterBundle,
    rarity: selectedRarity,
    frameBundlePath: "local/honor"
  };
};

const adaptNormalHonor = (
  type: string | null,
  masterBundle: string | null,
  selectedLevel: RewardHonorLevel | undefined,
  level: number | undefined,
  selectedRarity: HonorDegreeRarity | null,
  frameName: string | null
): RewardHonorInput | null => {
  const isEvent = type === "event" || type === "event_point";
  let body = masterBundle;
  if (!body && !isEvent) body = bundleName(selectedLevel?.assetbundleName);
  if (!body) return null;

  return {
    kind: "normal",
    honorType: normalHonorType(type, isEvent),
    assetBundleName: body,
    group: { frameName },
    rarity: selectedRarity,
    level: level ?? null,
    rankAsset:
      isEvent && masterBundle
        ? { bundlePath: `honor/${masterBundle}`, resourceName: "rank_main.png" }
        : null
  };
};

/** Use only reward enrichment; never infer an event's rank sprite from a level bundle. */
export const adaptRewardHonor = (
  detail: SharedEventRewardResourceBoxDetail
): RewardHonorInput | null => {
  const honor = detail.honor;
  if (!honor || (detail.resourceType && detail.resourceType !== "honor")) return null;
  const levels = sortedPositiveLevels(honor.levels);
  const level = positiveLevel(detail.resourceLevel) ? detail.resourceLevel : levels[0]?.level;
  const selectedLevel = levels.find((entry) => entry.level === level);
  const masterBundle = bundleName(honor.assetbundleName);
  const type = text(honor.group?.honorType) ?? text(honor.honorType);
  const selectedRarity = rarity(honor.honorRarity) ?? rarity(selectedLevel?.honorRarity);
  const background = bundleName(honor.group?.backgroundAssetbundleName);

  if (type === "bonds_honor") return null;
  if (type === "rank_match") {
    return adaptRankMatchHonor(masterBundle, background, selectedRarity);
  }

  return adaptNormalHonor(
    type,
    masterBundle,
    selectedLevel,
    level,
    selectedRarity,
    bundleName(honor.group?.frameName)
  );
};

/** Select the first renderable reward honor, retaining a name-only fallback when art is absent. */
export const selectRewardHonor = (
  reward: SharedEventRewardRangeResponse | null | undefined
): { label: string | null; honor: RewardHonorInput | null } => {
  let fallbackLabel: string | null = null;
  for (const rankingReward of reward?.eventRankingRewards ?? []) {
    for (const detail of rankingReward.resourceBox?.details ?? []) {
      const label = text(detail.honor?.name);
      fallbackLabel ??= label;
      const honor = adaptRewardHonor(detail);
      if (honor) return { label, honor };
    }
  }
  return { label: fallbackLabel, honor: null };
};
