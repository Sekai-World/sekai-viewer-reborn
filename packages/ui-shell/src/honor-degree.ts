import type {
  HonorDegreeAsset,
  HonorDegreeAssetResolver,
  BondsHonorDegreeCharacter,
  HonorDegreeInput,
  HonorDegreeLayer,
  HonorDegreeLayout,
  HonorDegreeMask,
  HonorDegreeMaskLayer,
  HonorDegreePart,
  HonorDegreeSize,
  HonorDegreeSlot
} from "./honor-degree.types";

export const honorDegreeScales = { S: 0.7, M: 0.8, L: 1, LL: 1.2 } as const;

/** Verified local resource names for the six staged Bonds honor assets. */
export const bondsHonorLocalAssetResources = {
  bundlePath: "local/bonds-honor",
  backgroundBase: "degree_bgBase",
  backgroundColor: "degree_bgColor",
  backgroundTextureMain: "degree_bgTexture_main",
  backgroundTextureSub: "degree_bgTexture_sub",
  maskMain: "mask_degree_main",
  maskSub: "mask_degree_sub"
} as const;

/** Verified local resource names for the two staged Live Master star assets. */
export const liveMasterLocalAssetResources = {
  bundlePath: "local/live-master",
  star1: "live_master_honor_star_1",
  star2: "live_master_honor_star_2"
} as const;

/** Asset names used by the regular honor level indicator. */
export const honorDegreeLevelIconResources = {
  bundlePath: "local/honor",
  regular: "icon_degreeLv",
  upgraded: "icon_degreeLv6"
} as const;

export function normalizeHonorDegreeRarity(value: unknown): 0 | 1 | 2 | 3 | null {
  switch (value) {
    case "low":
    case 0:
      return 0;
    case "middle":
    case 1:
      return 1;
    case "high":
    case 2:
      return 2;
    case "highest":
    case 3:
      return 3;
    default:
      return null;
  }
}

function hasName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

type HonorDegreeRect = Pick<HonorDegreePart, "x" | "y" | "width" | "height">;
type HonorDegreeLayerAdder = (
  name: string,
  asset: HonorDegreeAsset | null | undefined,
  rect?: HonorDegreeRect,
  mask?: HonorDegreeMask | null
) => void;
type NormalHonorDegreeInput = Extract<HonorDegreeInput, { kind: "normal" }>;
type RankMatchHonorDegreeInput = Extract<HonorDegreeInput, { kind: "rank-match" }>;
type BondsHonorDegreeInput = Extract<HonorDegreeInput, { kind: "bonds" }>;

function validRect(rect: HonorDegreeRect): boolean {
  return (
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function addHonorDegreePart(
  add: HonorDegreeLayerAdder,
  name: string,
  part: HonorDegreePart | null | undefined
): void {
  if (part) add(name, part, part);
}

function addBondsHonorDegreeCharacter(
  add: HonorDegreeLayerAdder,
  name: string,
  part: BondsHonorDegreeCharacter | null | undefined
): void {
  if (part) add(name, part, part, part.mask);
}

function addBondsHonorDegreeLayers(
  honor: BondsHonorDegreeInput,
  main: boolean,
  add: HonorDegreeLayerAdder
): void {
  if (honor.backgrounds !== undefined && honor.backgrounds !== null) {
    honor.backgrounds.forEach((background, index) => add(`background-${index}`, background));
  } else {
    add("body", honor.background);
  }
  add("pattern", honor.pattern);
  honor.characters?.forEach((part, index) =>
    addBondsHonorDegreeCharacter(add, `character-${index}`, part)
  );
  const rarity = normalizeHonorDegreeRarity(honor.rarity);
  if (rarity !== null) {
    add("frame", {
      bundlePath: "local/honor",
      resourceName: getFrameResourceName(main, rarity)
    });
  }
  addHonorDegreePart(add, "word", honor.word);
}

function getRankMatchOverlayRect(main: boolean): HonorDegreeRect {
  if (main) return { x: 200, y: 1, width: 180, height: 78 };
  return { x: 11, y: 0, width: 158, height: 40 };
}

function getEventRankOverlayRect(main: boolean): HonorDegreeRect {
  if (main) return { x: 190, y: 1, width: 150, height: 78 };
  return { x: 60, y: 0, width: 120, height: 38 };
}

function getChapterRankAssetBundleName(honor: NormalHonorDegreeInput): string | null {
  if (hasName(honor.assetBundleName) && /_cp\d+$/.test(honor.assetBundleName)) {
    return honor.assetBundleName;
  }

  const rankBundleName = honor.rankAsset?.bundlePath.split("/").at(-1);
  return hasName(rankBundleName) && /_cp\d+$/.test(rankBundleName) ? rankBundleName : null;
}

function getFrameResourceName(main: boolean, rarity: number): string {
  return `frame_degree_${main ? "m" : "s"}_${rarity + 1}`;
}

function addRankMatchHonorDegreeLayers(
  honor: RankMatchHonorDegreeInput,
  main: boolean,
  variant: "main" | "sub",
  add: HonorDegreeLayerAdder
): void {
  const background = honor.backgroundAssetBundleName ?? honor.assetBundleName;
  if (hasName(background)) {
    add("body", {
      bundlePath: `rank_live/honor/${background}`,
      resourceName: `degree_${variant}.png`
    });
  }

  const rarity = normalizeHonorDegreeRarity(honor.rarity);
  if (hasName(honor.frameBundlePath) && rarity !== null) {
    add("frame", {
      bundlePath: honor.frameBundlePath,
      resourceName: getFrameResourceName(main, rarity)
    });
  }

  if (hasName(honor.assetBundleName)) {
    add(
      "rank",
      {
        bundlePath: `rank_live/honor/${honor.assetBundleName}`,
        resourceName: `${variant}.png`
      },
      getRankMatchOverlayRect(main)
    );
  }
}

function getNormalHonorFrameBundlePath(honor: NormalHonorDegreeInput): string | null {
  const rarity = normalizeHonorDegreeRarity(honor.rarity);
  const isChapterHonor = getChapterRankAssetBundleName(honor) !== null;

  if (honor.honorType === "birthday") {
    const frameName = honor.group?.frameName;
    if (hasName(frameName)) return `honor_frame/${frameName}`;
    return "local/honor";
  }

  const frameName = honor.group?.frameName;
  if (isChapterHonor && (rarity === 2 || rarity === 3) && hasName(frameName)) {
    return `honor_frame/${frameName}`;
  }

  return "local/honor";
}

function addBirthdayHonorDegreeLevelLayers(
  level: number,
  rarity: number | null,
  frameBundlePath: string | null,
  main: boolean,
  add: HonorDegreeLayerAdder
): void {
  if (rarity === null || !frameBundlePath) return;

  for (let index = 0; index < Math.min(5, level); index++) {
    add(
      `birthday-level-${index}`,
      {
        bundlePath: frameBundlePath,
        resourceName: `frame_degree_level_${rarity + 1}`
      },
      { x: (main ? 150 : 50) + 16 * index, y: 64, width: 16, height: 16 }
    );
  }
}

function getBirthdayHonorFrameBundlePath(
  honor: NormalHonorDegreeInput,
  frameBundlePath: string | null
): string | null {
  const frameName = honor.group?.frameName;
  if (hasName(frameName)) return `honor_frame/${frameName}`;

  return frameBundlePath;
}

function addHonorDegreeLevelIcons(
  name: string,
  resourceName: string,
  count: number,
  x: number,
  add: HonorDegreeLayerAdder
): void {
  for (let index = 0; index < count; index++) {
    add(
      `${name}-${index}`,
      { bundlePath: honorDegreeLevelIconResources.bundlePath, resourceName },
      { x: x + 16 * index, y: 64, width: 16, height: 16 }
    );
  }
}

function addRegularHonorDegreeLevelLayers(
  level: number,
  main: boolean,
  add: HonorDegreeLayerAdder
): void {
  const iconCounts = getHonorDegreeLevelIconCounts(level);
  if (!iconCounts) return;

  const x = main ? 59 : 10;
  addHonorDegreeLevelIcons("level", honorDegreeLevelIconResources.regular, iconCounts.regular, x, add);
  addHonorDegreeLevelIcons(
    "level-upgraded",
    honorDegreeLevelIconResources.upgraded,
    iconCounts.upgraded,
    x,
    add
  );
}

function addNormalHonorLevelLayers(
  honor: NormalHonorDegreeInput,
  main: boolean,
  rarity: number | null,
  frameBundlePath: string | null,
  add: HonorDegreeLayerAdder
): void {
  if (!validLevel(honor.level)) return;

  if (honor.honorType === "birthday") {
    addBirthdayHonorDegreeLevelLayers(
      honor.level,
      rarity,
      getBirthdayHonorFrameBundlePath(honor, frameBundlePath),
      main,
      add
    );
  } else if (honor.honorType !== "live-master") {
    addRegularHonorDegreeLevelLayers(honor.level, main, add);
  }
}

function addNormalHonorDetailLayers(
  honor: NormalHonorDegreeInput,
  main: boolean,
  rarity: number | null,
  frameBundlePath: string | null,
  add: HonorDegreeLayerAdder,
  addPart: (name: string, part: HonorDegreePart | null | undefined) => void
): void {
  if (honor.honorType === "event") {
    const chapterBundleName = getChapterRankAssetBundleName(honor);
    if (chapterBundleName) {
      add(
        "rank",
        honor.rankAsset ?? {
          bundlePath: `honor/${chapterBundleName}`,
          resourceName: `rank_${main ? "main" : "sub"}.png`
        }
      );
    } else {
      add("rank", honor.rankAsset, getEventRankOverlayRect(main));
    }
  } else {
    addNormalHonorLevelLayers(honor, main, rarity, frameBundlePath, add);
  }

  if (honor.honorType === "live-master") {
    honor.liveMasterParts?.forEach((part, index) => addPart(`live-master-${index}`, part));
  }
}

function addNormalHonorDegreeLayers(
  honor: NormalHonorDegreeInput,
  main: boolean,
  variant: "main" | "sub",
  add: HonorDegreeLayerAdder,
  addPart: (name: string, part: HonorDegreePart | null | undefined) => void
): void {
  if (hasName(honor.assetBundleName)) {
    add("body", {
      bundlePath: `honor/${honor.assetBundleName}`,
      resourceName: `degree_${variant}.png`
    });
  }

  const rarity = normalizeHonorDegreeRarity(honor.rarity);
  const frameBundlePath = getNormalHonorFrameBundlePath(honor);
  if (rarity !== null && frameBundlePath) {
    add("frame", {
      bundlePath: frameBundlePath,
      resourceName: getFrameResourceName(main, rarity)
    });
  }

  addNormalHonorDetailLayers(honor, main, rarity, frameBundlePath, add, addPart);
}

/**
 * Regular honors show up to five base icons. Levels 6–10 replace the first
 * slots with the upgraded icon, so the upgraded icons are emitted after the
 * base icons and paint over the matching positions. Higher levels repeat this
 * ten-level cycle.
 */
export function getHonorDegreeLevelIconCounts(
  level: number
): { readonly regular: number; readonly upgraded: number } | null {
  if (!validLevel(level)) {
    return null;
  }

  const cycleLevel = ((level - 1) % 10) + 1;
  return {
    regular: Math.min(5, cycleLevel),
    upgraded: Math.max(0, cycleLevel - 5)
  };
}

/** Pure layout builder. All asset resolution is synchronous and caller-owned. */
export function buildHonorDegreeLayout(
  honor: HonorDegreeInput | null | undefined,
  resolveAsset: HonorDegreeAssetResolver,
  slot: HonorDegreeSlot = "main",
  size: HonorDegreeSize = "L"
): HonorDegreeLayout {
  const main = slot === "main";
  const width = main ? 380 : 180;
  const layers: HonorDegreeLayer[] = [];
  const root = { x: 0, y: 0, width, height: 80 };
  const add: HonorDegreeLayerAdder = (name, asset, rect, mask) => {
    if (!asset || !hasName(asset.bundlePath) || !hasName(asset.resourceName)) return;
    const targetRect = rect ?? root;
    if (!validRect(targetRect)) return;
    const href = resolveAsset(asset.bundlePath, asset.resourceName);
    if (!hasName(href)) return;

    let resolvedMask: HonorDegreeMaskLayer | null = null;
    if (
      mask &&
      hasName(mask.bundlePath) &&
      hasName(mask.resourceName) &&
      validRect(mask)
    ) {
      const maskHref = resolveAsset(mask.bundlePath, mask.resourceName);
      if (hasName(maskHref)) {
        resolvedMask = {
          href: maskHref,
          x: mask.x,
          y: mask.y,
          width: mask.width,
          height: mask.height
        };
      }
    }

    layers.push({
      name,
      href,
      x: targetRect.x,
      y: targetRect.y,
      width: targetRect.width,
      height: targetRect.height,
      ...(resolvedMask ? { mask: resolvedMask } : {})
    });
  };
  const addPart = (name: string, part: HonorDegreePart | null | undefined): void =>
    addHonorDegreePart(add, name, part);
  const variant = main ? "main" : "sub";

  if (honor?.kind === "bonds") {
    addBondsHonorDegreeLayers(honor, main, add);
  } else if (honor?.kind === "rank-match") {
    addRankMatchHonorDegreeLayers(honor, main, variant, add);
  } else if (honor?.kind === "normal") {
    addNormalHonorDegreeLayers(honor, main, variant, add, addPart);
  }
  return {
    width,
    height: 80,
    layers,
    scale: Object.hasOwn(honorDegreeScales, size) ? honorDegreeScales[size] : 1,
    reverse: honor?.kind === "bonds" && honor.reverse === true
  };
}
