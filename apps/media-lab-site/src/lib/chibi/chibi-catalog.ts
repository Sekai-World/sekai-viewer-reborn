import type { ChibiModelFamily } from "./chibi-model";

/** One playable model in the Chibi catalog. */
export interface ChibiCatalogModel {
  readonly modelName: string;
  readonly family: ChibiModelFamily;
  /** Set only for playable game characters; other models are listed together. */
  readonly characterId: number | null;
}

export interface ChibiCatalogCharacter {
  readonly id: number;
  readonly name: string;
}

export type ChibiCatalog =
  | {
      readonly status: "ready";
      readonly models: readonly ChibiCatalogModel[];
      readonly characters: readonly ChibiCatalogCharacter[];
    }
  | { readonly status: "unavailable" | "error" };

export interface ChibiModelLabel {
  /** Character part of the asset name, e.g. "Ichika"; null when the name has none. */
  readonly character: string | null;
  /** Costume part of the asset name, e.g. "Normal". */
  readonly variant: string;
}

const FAMILY_PREFIXES = ["v2_sd_", "sd_"] as const;
const CHARACTER_TOKEN_PATTERN = /^\d+([a-z]+)_(.+)$/;

const toTitleWords = (value: string): string =>
  value
    .split("_")
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Turns an asset name into display words. Master data has no costume names
 * for Chibi models, so the asset name is the only available label source:
 * `sd_01ichika_normal` becomes character "Ichika" and variant "Normal".
 */
export const describeChibiModelName = (modelName: string): ChibiModelLabel => {
  const prefix = FAMILY_PREFIXES.find((candidate) => modelName.startsWith(candidate));
  const rest = prefix ? modelName.slice(prefix.length) : modelName;
  const match = CHARACTER_TOKEN_PATTERN.exec(rest);

  return match
    ? { character: toTitleWords(match[1]), variant: toTitleWords(match[2]) }
    : { character: null, variant: toTitleWords(rest) };
};

/** A heading for one model, e.g. "Ichika Normal" or "Mob001". */
export const getChibiModelTitle = (modelName: string): string => {
  const { character, variant } = describeChibiModelName(modelName);
  return character ? `${character} ${variant}` : variant;
};

/** Default animation, as in the legacy viewer: the first `*pose_default`. */
export const pickDefaultChibiAnimation = (animations: readonly string[]): string =>
  animations.find((name) => name.endsWith("pose_default")) ?? animations[0] ?? "";
