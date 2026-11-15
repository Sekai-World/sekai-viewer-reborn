/**
 * ModelBundleManifest contract (schema version 1) for the media-lab 3D Asset/Animation Lab.
 *
 * The asset pipeline writes these files; this module defines their shape and validates what was
 * fetched. Nothing here loads or renders a model. A parse result is the object that was passed in,
 * unknown fields included: read it, do not merge it into other objects.
 * See docs/media-lab/model-bundle-manifest.md.
 */

export const MODEL_BUNDLE_SCHEMA_VERSION = 1;
/** The per-region index, relative to the region's asset bucket. */
export const MODEL_BUNDLE_INDEX_PATH = "model3d-manifest/v1/index.json";
/** A model bundle's manifest, relative to the bundle directory. */
export const MODEL_BUNDLE_MANIFEST_PATH = "fbx/manifest.json";
/** The model export of a bundle, relative to the bundle directory. The name is fixed. */
export const MODEL_BUNDLE_MODEL_PATH = "fbx/model.fbx";

export const MANIFEST_REGIONS = ["jp", "en", "tw", "kr", "cn"] as const;
export type ManifestRegion = (typeof MANIFEST_REGIONS)[number];

/** Unity objects the pipeline dumps as type tree JSON, whatever the file extension says. */
export type UnityTypeTreeFormat = "unity-typetree-json";

export interface ModelBundleModelFile {
  path: typeof MODEL_BUNDLE_MODEL_PATH;
  format: "fbx-ascii";
}

export interface ModelBundleTypeTreeFile {
  /** Relative to the bundle directory. May end in `.fbx`, `.mat` or `.prefab`; it is still JSON. */
  path: string;
  format: UnityTypeTreeFormat;
}

/** Names the meshes of the model use, read at export time. The skeleton is in the Avatar file. */
export interface ModelBundleRig {
  /** Names of the bones the meshes are skinned to. */
  boneNames: string[];
  /** BlendShape channel names of the meshes; empty when the model has none. */
  blendShapeNames: string[];
}

export interface ModelBundleSource {
  /** Unity version the pipeline is configured with for this region. */
  unityVersion?: string;
  /** Names of the bundles this bundle depends on. */
  dependencies?: string[];
}

/** One model bundle: `<bundlePath>/fbx/manifest.json`. */
export interface ModelBundleManifest {
  schemaVersion: typeof MODEL_BUNDLE_SCHEMA_VERSION;
  region: ManifestRegion;
  /** The bundle directory, relative to the bucket. It is also the source bundle name. */
  bundlePath: string;
  model: ModelBundleModelFile;
  /** PNG files the model export references, in `fbx/`. */
  textures: string[];
  avatars: ModelBundleTypeTreeFile[];
  materials: ModelBundleTypeTreeFile[];
  prefabs: ModelBundleTypeTreeFile[];
  /** Absent when the exporter did not read the names; they are then read from the model. */
  rig?: ModelBundleRig;
  source?: ModelBundleSource;
}

export interface ModelBundleAnimationClip {
  name: string;
  /** Relative to the animation bundle directory. Clips are told apart by path, not by name. */
  path: string;
  format: UnityTypeTreeFormat;
}

/** One animation bundle. It has no `fbx/` directory, so its clips are listed in the index. */
export interface ModelBundleAnimationEntry {
  /** The bundle directory, relative to the bucket. */
  bundlePath: string;
  clips: ModelBundleAnimationClip[];
}

export interface ModelBundleIndexModelEntry {
  bundlePath: string;
}

/** The per-region index: `model3d-manifest/v1/index.json`. */
export interface ModelBundleIndex {
  schemaVersion: typeof MODEL_BUNDLE_SCHEMA_VERSION;
  region: ManifestRegion;
  /** When the index was written, as an ISO 8601 UTC timestamp. */
  generatedAt: string;
  /** Model bundles that have a manifest. Animation clips stay separate from them. */
  models: ModelBundleIndexModelEntry[];
  animations: ModelBundleAnimationEntry[];
}

export type ManifestParseResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Control characters, and characters that change what a URL built from the path requests. */
const isUnsafePathCharacter = (character: string): boolean => {
  const code = character.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f || "\\%?#".includes(character);
};

const isPathSegment = (segment: string): boolean =>
  segment !== "" && segment !== "." && segment !== ".." && segment === segment.trim();

/**
 * A relative path of plain segments: no leading or trailing slash, no `.` or `..`, and none of
 * backslash, `%`, `?`, `#` or a control character, so that a URL built from it stays in the bundle.
 */
export const isManifestPath = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 1024 &&
  ![...value].some(isUnsafePathCharacter) &&
  value.split("/").every(isPathSegment);

const isName = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 1024;

const isRegion = (value: unknown): value is ManifestRegion =>
  MANIFEST_REGIONS.includes(value as ManifestRegion);

/** `2026-11-15T00:00:00Z`, with optional fractional seconds, naming a real instant. */
const isIsoUtcTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?Z$/.exec(value);
  if (match === null) return false;
  const time = Date.parse(`${match[1]}Z`);
  // An impossible date such as 31 February is rolled over by Date.parse, not rejected.
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 19) === match[1];
};

class Issues {
  readonly list: string[] = [];

  add(path: string, message: string): void {
    this.list.push(`${path}: ${message}`);
  }

  /** Checks a list of strings that all pass `check`; `seen` catches a string listed twice. */
  readStrings(
    value: unknown,
    path: string,
    check: (entry: unknown) => entry is string,
    expected: string,
    seen = new Set<string>()
  ): void {
    if (!Array.isArray(value)) {
      this.add(path, "must be a list");
      return;
    }
    for (let index = 0; index < value.length; index += 1) {
      const entry: unknown = value[index];
      if (!check(entry)) this.add(`${path}[${index}]`, `must be ${expected}`);
      else if (seen.has(entry)) this.add(`${path}[${index}]`, "is listed twice");
      else seen.add(entry);
    }
  }
}

const readHeader = (value: Json, issues: Issues): void => {
  if (value.schemaVersion !== MODEL_BUNDLE_SCHEMA_VERSION) {
    issues.add("schemaVersion", `must be ${MODEL_BUNDLE_SCHEMA_VERSION}`);
  }
  if (!isRegion(value.region)) issues.add("region", "is not a known region");
};

const readTypeTreeFiles = (
  value: unknown,
  path: string,
  issues: Issues,
  seen: Set<string>
): void => {
  if (!Array.isArray(value)) {
    issues.add(path, "must be a list");
    return;
  }
  value.forEach((entry: unknown, index) => {
    const at = `${path}[${index}]`;
    if (!isRecord(entry)) {
      issues.add(at, "must be an object");
      return;
    }
    if (!isManifestPath(entry.path)) issues.add(`${at}.path`, "must be a relative path");
    else if (entry.path === MODEL_BUNDLE_MODEL_PATH) {
      issues.add(`${at}.path`, "is the model export, not a type tree file");
    } else if (entry.path === MODEL_BUNDLE_MANIFEST_PATH) {
      issues.add(`${at}.path`, "is the manifest itself");
    } else if (seen.has(entry.path)) issues.add(`${at}.path`, "is listed twice");
    else seen.add(entry.path);
    if (entry.format !== "unity-typetree-json") {
      issues.add(`${at}.format`, 'must be "unity-typetree-json"');
    }
  });
};

const isFbxTexturePath = (value: unknown): value is string =>
  isManifestPath(value) && /^fbx\/[^/]+\.png$/i.test(value);

const readRig = (value: unknown, issues: Issues): void => {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.add("rig", "must be an object");
    return;
  }
  issues.readStrings(value.boneNames, "rig.boneNames", isName, "a name");
  issues.readStrings(value.blendShapeNames, "rig.blendShapeNames", isName, "a name");
};

const readSource = (value: unknown, issues: Issues): void => {
  if (value === undefined) return;
  if (!isRecord(value)) {
    issues.add("source", "must be an object");
    return;
  }
  if (value.unityVersion !== undefined && !isName(value.unityVersion)) {
    issues.add("source.unityVersion", "must be a non-empty string");
  }
  if (value.dependencies !== undefined) {
    issues.readStrings(value.dependencies, "source.dependencies", isManifestPath, "a bundle name");
  }
};

/** Checks a fetched `<bundlePath>/fbx/manifest.json`. Unknown fields are ignored. */
export const parseModelBundleManifest = (
  value: unknown
): ManifestParseResult<ModelBundleManifest> => {
  if (!isRecord(value)) return { ok: false, issues: ["manifest: must be an object"] };
  const issues = new Issues();
  readHeader(value, issues);
  if (!isManifestPath(value.bundlePath)) issues.add("bundlePath", "must be a relative path");

  if (!isRecord(value.model)) issues.add("model", "must be an object");
  else {
    if (value.model.path !== MODEL_BUNDLE_MODEL_PATH) {
      issues.add("model.path", `must be "${MODEL_BUNDLE_MODEL_PATH}"`);
    }
    if (value.model.format !== "fbx-ascii") issues.add("model.format", 'must be "fbx-ascii"');
  }

  // One file has one role: a path may not appear twice, in one list or across them.
  const files = new Set<string>();
  issues.readStrings(value.textures, "textures", isFbxTexturePath, "a PNG file in fbx/", files);
  readTypeTreeFiles(value.avatars, "avatars", issues, files);
  readTypeTreeFiles(value.materials, "materials", issues, files);
  readTypeTreeFiles(value.prefabs, "prefabs", issues, files);
  readRig(value.rig, issues);
  readSource(value.source, issues);

  return issues.list.length === 0
    ? { ok: true, value: value as unknown as ModelBundleManifest }
    : { ok: false, issues: issues.list };
};

const readClips = (value: unknown, path: string, issues: Issues): void => {
  if (!Array.isArray(value) || value.length === 0) {
    issues.add(path, "must be a non-empty list");
    return;
  }
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const at = `${path}[${index}]`;
    if (!isRecord(entry)) {
      issues.add(at, "must be an object");
      return;
    }
    if (!isName(entry.name)) issues.add(`${at}.name`, "must be a non-empty string");
    if (!isManifestPath(entry.path)) issues.add(`${at}.path`, "must be a relative path");
    else if (seen.has(entry.path)) issues.add(`${at}.path`, "is listed twice");
    else seen.add(entry.path);
    if (entry.format !== "unity-typetree-json") {
      issues.add(`${at}.format`, 'must be "unity-typetree-json"');
    }
  });
};

const readBundleEntries = (
  value: unknown,
  path: string,
  issues: Issues,
  readEntry: (entry: Json, at: string) => void
): void => {
  if (!Array.isArray(value)) {
    issues.add(path, "must be a list");
    return;
  }
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const at = `${path}[${index}]`;
    if (!isRecord(entry)) {
      issues.add(at, "must be an object");
      return;
    }
    if (!isManifestPath(entry.bundlePath))
      issues.add(`${at}.bundlePath`, "must be a relative path");
    else if (seen.has(entry.bundlePath)) issues.add(`${at}.bundlePath`, "is listed twice");
    else seen.add(entry.bundlePath);
    readEntry(entry, at);
  });
};

/**
 * Checks a fetched `model3d-manifest/v1/index.json`. Unknown fields are ignored. One bad entry
 * fails the whole index: the pipeline writes it, so a bad entry is a generator fault to fix there.
 */
export const parseModelBundleIndex = (value: unknown): ManifestParseResult<ModelBundleIndex> => {
  if (!isRecord(value)) return { ok: false, issues: ["index: must be an object"] };
  const issues = new Issues();
  readHeader(value, issues);
  if (!isIsoUtcTimestamp(value.generatedAt)) {
    issues.add("generatedAt", "must be an ISO 8601 UTC timestamp");
  }
  readBundleEntries(value.models, "models", issues, () => {});
  readBundleEntries(value.animations, "animations", issues, (entry, at) =>
    readClips(entry.clips, `${at}.clips`, issues)
  );

  return issues.list.length === 0
    ? { ok: true, value: value as unknown as ModelBundleIndex }
    : { ok: false, issues: issues.list };
};

/** Bucket-relative path of a model bundle's manifest. */
export const modelBundleManifestPath = (bundlePath: string): string =>
  `${bundlePath}/${MODEL_BUNDLE_MANIFEST_PATH}`;

/** Bucket-relative path of a file a manifest or index entry names. */
export const modelBundleFilePath = (bundlePath: string, path: string): string =>
  `${bundlePath}/${path}`;
