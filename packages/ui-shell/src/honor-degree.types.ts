export type HonorDegreeSlot = "main" | "sub1" | "sub2";
export type HonorDegreeSize = "S" | "M" | "L" | "LL";
export type HonorDegreeRarity = "low" | "middle" | "high" | "highest" | 0 | 1 | 2 | 3;

/** Return null for unavailable resources. No fetching or asset discovery is performed here.
 * Remote body/tier resources include .png; frame and local icon resources are sprite names
 * without an extension. The resolver owns any extension/path mapping.
 * Local level icons use bundlePath "local/honor" and resourceName "icon_degreeLv"
 * or "icon_degreeLv6" (the upgraded icon for levels 6–10 in each cycle).
 */
export type HonorDegreeAssetResolver = (bundlePath: string, resourceName: string) => string | null;

export interface HonorDegreeAsset {
  readonly bundlePath: string;
  readonly resourceName: string;
}

/** Explicit top-left geometry in root pixels; never infer unknown sprite geometry. */
export interface HonorDegreePart extends HonorDegreeAsset {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Caller-supplied mask asset with explicit geometry in root pixels. */
export type HonorDegreeMask = HonorDegreePart;

export interface BondsHonorDegreeCharacter extends HonorDegreePart {
  readonly mask?: HonorDegreeMask | null;
}

export interface NormalHonorDegree {
  readonly kind: "normal";
  readonly honorType?: "regular" | "event" | "birthday" | "live-master";
  readonly assetBundleName?: string | null;
  readonly group?: { readonly frameName?: string | null } | null;
  /** Resolver bundle path for the canonical frame; takes precedence over group.frameName. */
  readonly frameBundlePath?: string | null;
  readonly rarity?: HonorDegreeRarity | null;
  readonly level?: number | null;
  /** Slot-specific event overlay resource, rendered only for honorType event. */
  readonly rankAsset?: HonorDegreeAsset | null;
  /** Drawn last, in supplied order. Caller supplies the selected slot's geometry. */
  readonly liveMasterParts?: readonly HonorDegreePart[];
}

export interface RankMatchHonorDegree {
  readonly kind: "rank-match";
  readonly assetBundleName?: string | null;
  readonly backgroundAssetBundleName?: string | null;
  readonly rarity?: HonorDegreeRarity | null;
  /** Resolver bundle path for the canonical frame; the resource name is derived. */
  readonly frameBundlePath?: string | null;
}

export interface BondsHonorDegree {
  readonly kind: "bonds";
  /** Bonds use the selected main/sub root; reverse mirrors that root. */
  readonly reverse?: boolean;
  /**
   * Ordered full-root backgrounds, e.g. the base and color layers. When
   * supplied, this takes precedence over the legacy single `background`.
   */
  readonly backgrounds?: readonly (HonorDegreeAsset | null | undefined)[] | null;
  /** Legacy single background, used when `backgrounds` is omitted. */
  readonly background?: HonorDegreeAsset | null;
  readonly pattern?: HonorDegreeAsset | null;
  readonly frame?: HonorDegreeAsset | null;
  readonly characters?: readonly [
    BondsHonorDegreeCharacter | null,
    BondsHonorDegreeCharacter | null
  ];
  readonly word?: HonorDegreePart | null;
  /** Paint order: backgrounds, pattern, characters, frame, word. No inferred assets. */
}

export type HonorDegreeInput =
  NormalHonorDegree | RankMatchHonorDegree | BondsHonorDegree | { readonly kind: "empty" };

export interface HonorDegreeProps {
  readonly honor?: HonorDegreeInput | null;
  readonly resolveAsset: HonorDegreeAssetResolver;
  readonly slot?: HonorDegreeSlot;
  readonly size?: HonorDegreeSize;
  /** Localized accessible name and empty placeholder text; defaults to Honor. */
  readonly label?: string;
  /** Optional SVG tooltip; defaults to label. Omitted in decorative mode. */
  readonly title?: string;
  readonly decorative?: boolean;
  readonly class?: string;
}

export interface HonorDegreeLayer {
  readonly name: string;
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly mask?: HonorDegreeMaskLayer;
}

export interface HonorDegreeMaskLayer {
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HonorDegreeLayout {
  readonly width: 180 | 380;
  readonly height: 80;
  readonly scale: number;
  readonly reverse: boolean;
  readonly layers: readonly HonorDegreeLayer[];
}
