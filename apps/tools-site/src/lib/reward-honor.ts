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

/** Use only reward enrichment; never infer an event's rank sprite from a level bundle. */
export const adaptRewardHonor = (
  detail: SharedEventRewardResourceBoxDetail
): RewardHonorInput | null => {
  const honor = detail.honor;
  if (!honor || (detail.resourceType && detail.resourceType !== "honor")) return null;
  const levels = (Array.isArray(honor.levels) ? honor.levels : [])
    .filter((entry) => entry && positiveLevel(entry.level))
    .toSorted((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const level = positiveLevel(detail.resourceLevel) ? detail.resourceLevel : levels[0]?.level;
  const selectedLevel = levels.find((entry) => entry.level === level);
  const masterBundle = bundleName(honor.assetbundleName);
  const type = text(honor.group?.honorType) ?? text(honor.honorType);
  const selectedRarity = rarity(honor.honorRarity) ?? rarity(selectedLevel?.honorRarity);
  const background = bundleName(honor.group?.backgroundAssetbundleName);

  if (type === "bonds_honor") return null;

  if (type === "rank_match") {
    if (!masterBundle && !background) return null;
    return {
      kind: "rank-match",
      assetBundleName: masterBundle,
      backgroundAssetBundleName: background ?? masterBundle,
      rarity: selectedRarity,
      frameBundlePath: "local/honor"
    };
  }
  const isEvent = type === "event" || type === "event_point";
  const body = masterBundle ?? (!isEvent ? bundleName(selectedLevel?.assetbundleName) : null);
  if (!body || (isEvent && !masterBundle)) return null;
  return {
    kind: "normal",
    honorType: isEvent ? "event" : type === "birthday" ? "birthday" : "regular",
    assetBundleName: body,
    group: { frameName: bundleName(honor.group?.frameName) },
    rarity: selectedRarity,
    level: level ?? null,
    rankAsset:
      isEvent && masterBundle
        ? { bundlePath: `honor/${masterBundle}`, resourceName: "rank_main.png" }
        : null
  };
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
