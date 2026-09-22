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
  const validRect = (rect: Pick<HonorDegreePart, "x" | "y" | "width" | "height">): boolean =>
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height > 0;
  const add = (
    name: string,
    asset: HonorDegreeAsset | null | undefined,
    rect: Pick<HonorDegreePart, "x" | "y" | "width" | "height"> = root,
    mask?: HonorDegreeMask | null
  ): void => {
    if (!asset || !hasName(asset.bundlePath) || !hasName(asset.resourceName)) return;
    if (!validRect(rect)) return;
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
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      ...(resolvedMask ? { mask: resolvedMask } : {})
    });
  };
  const addPart = (name: string, part: HonorDegreePart | null | undefined): void => {
    if (part) add(name, part, part);
  };
  const addCharacter = (
    name: string,
    part: BondsHonorDegreeCharacter | null | undefined
  ): void => {
    if (part) add(name, part, part, part.mask);
  };
  const variant = main ? "main" : "sub";

  if (honor?.kind === "bonds") {
    if (honor.backgrounds !== undefined && honor.backgrounds !== null) {
      honor.backgrounds.forEach((background, index) => add(`background-${index}`, background));
    } else {
      add("body", honor.background);
    }
    add("pattern", honor.pattern);
    honor.characters?.forEach((part, index) => addCharacter(`character-${index}`, part));
    add("frame", honor.frame);
    addPart("word", honor.word);
  } else if (honor?.kind === "rank-match") {
    const background = honor.backgroundAssetBundleName ?? honor.assetBundleName;
    if (hasName(background))
      add("body", {
        bundlePath: `rank_live/honor/${background}`,
        resourceName: `degree_${variant}.png`
      });
    const rarity = normalizeHonorDegreeRarity(honor.rarity);
    if (hasName(honor.frameBundlePath) && rarity !== null) {
      add("frame", {
        bundlePath: honor.frameBundlePath,
        resourceName: `frame_degree_${main ? "m" : "s"}_${rarity + 1}`
      });
    }
    if (hasName(honor.assetBundleName))
      add(
        "rank",
        {
          bundlePath: `rank_live/honor/${honor.assetBundleName}`,
          resourceName: `${variant}.png`
        },
        main ? { x: 200, y: 1, width: 180, height: 78 } : { x: 11, y: 0, width: 158, height: 40 }
      );
  } else if (honor?.kind === "normal") {
    if (hasName(honor.assetBundleName))
      add("body", {
        bundlePath: `honor/${honor.assetBundleName}`,
        resourceName: `degree_${variant}.png`
      });
    const rarity = normalizeHonorDegreeRarity(honor.rarity);
    const frameName = honor.group?.frameName;
    const frameBundle = hasName(honor.frameBundlePath)
      ? honor.frameBundlePath
      : hasName(frameName)
        ? `honor_frame/${frameName}`
        : null;
    if (rarity !== null && frameBundle)
      add("frame", {
        bundlePath: frameBundle,
        resourceName: `frame_degree_${main ? "m" : "s"}_${rarity + 1}`
      });
    if (honor.honorType === "event") {
      add(
        "rank",
        honor.rankAsset,
        main ? { x: 190, y: 1, width: 150, height: 78 } : { x: 60, y: 0, width: 120, height: 38 }
      );
    } else if (validLevel(honor.level)) {
      if (honor.honorType === "birthday") {
        if (rarity !== null && frameBundle) {
          for (let i = 0; i < Math.min(5, honor.level); i++)
            add(
              `birthday-level-${i}`,
              {
                bundlePath: frameBundle,
                resourceName: `frame_degree_level_${rarity + 1}`
              },
              { x: (main ? 150 : 50) + 16 * i, y: 64, width: 16, height: 16 }
            );
        }
      } else if (honor.honorType !== "live-master") {
        const iconCounts = getHonorDegreeLevelIconCounts(honor.level);
        if (iconCounts) {
          for (let i = 0; i < iconCounts.regular; i++)
            add(
              `level-${i}`,
              {
                bundlePath: honorDegreeLevelIconResources.bundlePath,
                resourceName: honorDegreeLevelIconResources.regular
              },
              { x: (main ? 59 : 10) + 16 * i, y: 64, width: 16, height: 16 }
            );
          for (let i = 0; i < iconCounts.upgraded; i++)
            add(
              `level-upgraded-${i}`,
              {
                bundlePath: honorDegreeLevelIconResources.bundlePath,
                resourceName: honorDegreeLevelIconResources.upgraded
              },
              { x: (main ? 59 : 10) + 16 * i, y: 64, width: 16, height: 16 }
            );
        }
      }
    }
    if (honor.honorType === "live-master") {
      honor.liveMasterParts?.forEach((part, index) => addPart(`live-master-${index}`, part));
    }
  }
  return {
    width,
    height: 80,
    layers,
    scale: Object.hasOwn(honorDegreeScales, size) ? honorDegreeScales[size] : 1,
    reverse: honor?.kind === "bonds" && honor.reverse === true
  };
}
