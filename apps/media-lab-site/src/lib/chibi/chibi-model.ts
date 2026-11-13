/**
 * Chibi (Spine 4.1) assets were found only in the JP bucket. Region is an
 * explicit JP-only contract; there is no fallback to other regions.
 */
export const chibiModelRegions = ["jp"] as const;

export type ChibiModelRegion = (typeof chibiModelRegions)[number];

export const CHIBI_ASSET_BUCKET_URL = "https://storage.sekai.best/sekai-jp-assets/";

/** Every atlas names this texture, which sits in the same folder. */
export const CHIBI_ATLAS_TEXTURE_FILE = "sekai_atlas.png";

const CHIBI_ATLAS_FILE = "sekai_atlas.atlas.txt";

export type ChibiModelFamily = "mob" | "v2" | "main";

interface ChibiFamilyLayout {
  family: ChibiModelFamily;
  prefix: string;
  folder: string;
  skeletonPath: string;
}

/** Order matters: `sd_mob` must be tested before the generic `sd_` prefix. */
const CHIBI_FAMILY_LAYOUTS: readonly ChibiFamilyLayout[] = [
  {
    family: "mob",
    prefix: "sd_mob",
    folder: "area_sd/sd_mob",
    skeletonPath: "area_sd/sd_mob/base_model_mob/sd_mob.skel"
  },
  {
    family: "v2",
    prefix: "v2_sd_",
    folder: "area_sd/v2_sd_main",
    skeletonPath: "area_sd/v2_sd_main/v2_base_model/v2_sd_main.skel"
  },
  {
    family: "main",
    prefix: "sd_",
    folder: "area_sd/sd_main",
    skeletonPath: "area_sd/sd_main/base_model/sd_main.skel"
  }
];

const CHIBI_MODEL_NAME_PATTERN = /^[a-z0-9_]+$/;

/**
 * A fully resolved, serializable input for one Chibi model. Each family shares
 * one skeleton; every model has its own atlas and texture.
 */
export interface ChibiModelDescriptor {
  modelName: string;
  family: ChibiModelFamily;
  region: ChibiModelRegion;
  atlasUrl: string;
  textureUrl: string;
  skeletonUrl: string;
}

export type ResolvedChibiModelDescriptor =
  { status: "ok"; descriptor: ChibiModelDescriptor } | { status: "invalid"; reason: string };

const invalid = (reason: string): ResolvedChibiModelDescriptor => ({ status: "invalid", reason });

/**
 * Maps a `costume2ds.spineAssetbundleName` to its asset URLs. A name outside
 * the three known families is rejected instead of being given a guessed path.
 */
export const resolveChibiModelDescriptor = (modelName: unknown): ResolvedChibiModelDescriptor => {
  if (typeof modelName !== "string" || !CHIBI_MODEL_NAME_PATTERN.test(modelName)) {
    return invalid("Chibi model name must contain only lowercase letters, digits and underscores");
  }

  const layout = CHIBI_FAMILY_LAYOUTS.find(({ prefix }) => modelName.startsWith(prefix));
  if (!layout) return invalid("Chibi model name does not belong to a known family");
  if (modelName === layout.prefix) return invalid("Chibi model name is only a family prefix");

  const modelFolder = `${CHIBI_ASSET_BUCKET_URL}${layout.folder}/${modelName}/`;

  return {
    status: "ok",
    descriptor: {
      modelName,
      family: layout.family,
      region: "jp",
      atlasUrl: `${modelFolder}${CHIBI_ATLAS_FILE}`,
      textureUrl: `${modelFolder}${CHIBI_ATLAS_TEXTURE_FILE}`,
      skeletonUrl: `${CHIBI_ASSET_BUCKET_URL}${layout.skeletonPath}`
    }
  };
};
