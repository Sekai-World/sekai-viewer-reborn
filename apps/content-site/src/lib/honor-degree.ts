import {
  normalizeHonorDegreeRarity,
  type HonorDegreeInput,
  type HonorDegreeAssetResolver
} from "@platform/ui-shell";
import { getRemoteAssetEndpointURL } from "$lib/assets/index";
import type { Honor, HonorGroupMetadata } from "$lib/domain/honor";
import type { SupportedRegion } from "$lib/domain/regions";

export type CatalogueHonorDegree = { main: HonorDegreeInput; sub: HonorDegreeInput };

const LIVE_MASTER_MISSION_TYPES = new Set([
  "easy_full_combo",
  "normal_full_combo",
  "hard_full_combo",
  "expert_full_combo",
  "master_full_combo",
  "master_full_perfect",
  "append_full_combo",
  "append_full_perfect"
]);

const normalizeAssetBundleName = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized || null;
};

export function toCatalogueHonorDegree(
  honor: Honor,
  group: HonorGroupMetadata
): CatalogueHonorDegree {
  const levels = honor.levels.filter(
    (level) => Number.isSafeInteger(level.level) && (level.level ?? 0) > 0
  );
  const effective = levels.find((level) => level.honorRarity === honor.honorRarity) ?? levels[0];
  const rarity =
    normalizeHonorDegreeRarity(honor.honorRarity) ??
    normalizeHonorDegreeRarity(effective?.honorRarity);
  const type = group.honorType ?? honor.group?.honorType ?? honor.honorType;
  const liveMaster = LIVE_MASTER_MISSION_TYPES.has(honor.honorMissionType ?? "");
  const background =
    normalizeAssetBundleName(group.backgroundAssetBundleName) ??
    normalizeAssetBundleName(honor.group?.backgroundAssetBundleName);
  const masterBundle = normalizeAssetBundleName(honor.assetBundleName);
  const selectedLevelBundle = normalizeAssetBundleName(effective?.assetBundleName);
  const event = !liveMaster && type === "event" && background !== null;
  const bundle = background ?? (liveMaster ? selectedLevelBundle : null) ?? masterBundle;
  const input = (main: boolean): HonorDegreeInput => {
    if (type === "rank_match" && !liveMaster) {
      if (!background && !masterBundle) return { kind: "empty" };
      return {
        kind: "rank-match",
        assetBundleName: masterBundle,
        backgroundAssetBundleName: background,
        rarity,
        frameBundlePath: "local/honor"
      };
    }
    if (event && !masterBundle) return { kind: "empty" };
    return {
      kind: "normal",
      honorType: liveMaster
        ? "live-master"
        : event
          ? "event"
          : type === "birthday"
            ? "birthday"
            : "regular",
      assetBundleName: bundle,
      // Remote custom SVG frames cannot recover failed loads through this resolver.
      // Always use the generic local frame, even when the group supplies frameName.
      frameBundlePath: "local/honor",
      rarity: rarity ?? 0,
      level: effective?.level ?? null,
      rankAsset:
        event && masterBundle
          ? {
              bundlePath: `honor/${masterBundle}`,
              resourceName: `rank_${main ? "main" : "sub"}.png`
            }
          : null
    };
  };
  return { main: input(true), sub: input(false) };
}

export function createHonorDegreeAssetResolver(region: SupportedRegion): HonorDegreeAssetResolver {
  return (bundle, resource) => {
    const name = resource.replace(/\.png$/, "");
    if (bundle === "local/honor") return `/degree/${name}.png`;
    if (bundle === "local/bonds-honor") return `/degree/bonds/${name}.png`;
    if (bundle === "local/live-master") return `/degree/live-master/${name}.png`;
    if (!/^(honor|honor_frame|rank_live\/honor)\//.test(bundle)) return null;
    return getRemoteAssetEndpointURL(`${bundle}/${name}.webp`, region);
  };
}
