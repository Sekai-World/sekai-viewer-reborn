import {
  normalizeHonorDegreeRarity,
  type HonorDegreeInput,
  type HonorDegreeAssetResolver
} from "@platform/ui-shell";
import { getRemoteAssetEndpointURL } from "$lib/assets/index";
import type { Honor, HonorGroupMetadata, HonorLevel } from "$lib/domain/honor";
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

type HonorDegreeRarity = ReturnType<typeof normalizeHonorDegreeRarity>;

type HonorDegreeAdapterContext = {
  type: string | null;
  liveMaster: boolean;
  event: boolean;
  background: string | null;
  masterBundle: string | null;
  bundle: string | null;
  rarity: HonorDegreeRarity;
  level: number | null;
};

function getEffectiveHonorLevel(honor: Honor): HonorLevel | undefined {
  const levels = honor.levels.filter(
    (level) => Number.isSafeInteger(level.level) && (level.level ?? 0) > 0
  );
  return levels.find((level) => level.honorRarity === honor.honorRarity) ?? levels[0];
}

function getHonorDegreeBundle(
  background: string | null,
  liveMaster: boolean,
  selectedLevelBundle: string | null,
  masterBundle: string | null
): string | null {
  if (background !== null) return background;
  if (liveMaster && selectedLevelBundle !== null) return selectedLevelBundle;
  return masterBundle;
}

function getNormalHonorType(
  type: string | null,
  liveMaster: boolean,
  event: boolean
): "event" | "birthday" | "live-master" | "regular" {
  if (liveMaster) return "live-master";
  if (event) return "event";
  if (type === "birthday") return "birthday";
  return "regular";
}

function createRankMatchHonorInput(
  background: string | null,
  masterBundle: string | null,
  rarity: HonorDegreeRarity
): HonorDegreeInput {
  if (background === null && masterBundle === null) return { kind: "empty" };

  return {
    kind: "rank-match",
    assetBundleName: masterBundle,
    backgroundAssetBundleName: background,
    rarity,
    frameBundlePath: "local/honor"
  };
}

function createEventRankAsset(
  event: boolean,
  masterBundle: string | null,
  main: boolean
): { bundlePath: string; resourceName: string } | null {
  if (!event || masterBundle === null) return null;

  let slot: "main" | "sub";
  if (main) {
    slot = "main";
  } else {
    slot = "sub";
  }

  return {
    bundlePath: `honor/${masterBundle}`,
    resourceName: `rank_${slot}.png`
  };
}

function resolveHonorDegreeInput(
  context: HonorDegreeAdapterContext,
  main: boolean
): HonorDegreeInput {
  if (context.type === "rank_match" && !context.liveMaster) {
    return createRankMatchHonorInput(context.background, context.masterBundle, context.rarity);
  }
  if (context.event && context.masterBundle === null) return { kind: "empty" };

  return {
    kind: "normal",
    honorType: getNormalHonorType(context.type, context.liveMaster, context.event),
    assetBundleName: context.bundle,
    // Remote custom SVG frames cannot recover failed loads through this resolver.
    // Always use the generic local frame, even when the group supplies frameName.
    frameBundlePath: "local/honor",
    rarity: context.rarity ?? 0,
    level: context.level,
    rankAsset: createEventRankAsset(context.event, context.masterBundle, main)
  };
}

export function toCatalogueHonorDegree(
  honor: Honor,
  group: HonorGroupMetadata
): CatalogueHonorDegree {
  const effective = getEffectiveHonorLevel(honor);
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
  const context: HonorDegreeAdapterContext = {
    type,
    liveMaster,
    event,
    background,
    masterBundle,
    bundle: getHonorDegreeBundle(background, liveMaster, selectedLevelBundle, masterBundle),
    rarity,
    level: effective?.level ?? null
  };

  return {
    main: resolveHonorDegreeInput(context, true),
    sub: resolveHonorDegreeInput(context, false)
  };
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
