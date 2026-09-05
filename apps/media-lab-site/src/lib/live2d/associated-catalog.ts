export const LIVE2D_ASSOCIATED_CATALOG_URL =
  "https://storage.sekai.best/sekai-live2d-assets/live2d-associated/v1/model_list.json";
export const LIVE2D_ASSET_BUCKET_URL = "https://storage.sekai.best/sekai-live2d-assets/";
export const LIVE2D_CATALOG_REGION = "jp" as const;

const MODEL_FILE_SUFFIX = ".model3.json";
const MOTION_FILE_SUFFIX = ".motion3.json";
const DEFAULT_CATALOG_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_CACHE_ENTRIES = 1;
const CATALOG_CACHE_KEY = "associated";
const UNSAFE_VALUE_PATTERN = /[\\?#%]/;
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z\d+.-]*:/;

export interface Live2dMotionUrlDescriptor {
  /** The source file name, used as the stable descriptor ID. */
  id: string;
  url: string;
}

export interface Live2dAssociatedMotionSet {
  motionSetId: string;
  motionPath: string;
  motionFiles: readonly string[];
  facialPath: string;
  facialFiles: readonly string[];
  /** Body motions from `motionFiles`; these are not facial expressions. */
  bodyMotions: readonly Live2dMotionUrlDescriptor[];
  /** Facial motions from `facialFiles`; these are not Cubism expressions. */
  facialMotions: readonly Live2dMotionUrlDescriptor[];
}

export interface Live2dAssociatedModel {
  region: typeof LIVE2D_CATALOG_REGION;
  modelBase: string;
  modelFile: string;
  modelName: string;
  modelPath: string;
  modelUrl: string;
  motionSets: readonly Live2dAssociatedMotionSet[];
}

export type Live2dAssociatedCatalog = readonly Live2dAssociatedModel[];

export type ParsedLive2dAssociatedCatalog =
  { status: "ok"; catalog: Live2dAssociatedCatalog } | { status: "invalid"; reason: string };

type ValidationResult<T> = { value: T } | { reason: string };
type InvalidResult = { status: "invalid"; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0);
    return (
      code !== undefined &&
      ((code >= 0 && code <= 31) || (code >= 127 && code <= 159))
    );
  });

const hasUnsafeValue = (value: string): boolean =>
  UNSAFE_VALUE_PATTERN.test(value) || hasControlCharacter(value) || /\s/.test(value);

const readNonEmptyString = (value: unknown, label: string): ValidationResult<string> => {
  if (typeof value !== "string") return { reason: `${label} must be a string` };

  const normalized = value.trim();
  if (!normalized) return { reason: `${label} must not be empty` };
  if (hasUnsafeValue(normalized)) return { reason: `${label} contains unsafe characters` };

  return { value: normalized };
};

const readIdentifier = (value: unknown, label: string): ValidationResult<string> => {
  const result = readNonEmptyString(value, label);
  if ("reason" in result) return result;

  if (
    result.value === "." ||
    result.value === ".." ||
    result.value.includes("/") ||
    result.value.includes(":")
  ) {
    return { reason: `${label} must be a path-safe identifier` };
  }

  return result;
};

const readRelativePath = (value: unknown, label: string): ValidationResult<string> => {
  const result = readNonEmptyString(value, label);
  if ("reason" in result) return result;

  if (result.value.startsWith("/") || SCHEME_PATTERN.test(result.value)) {
    return { reason: `${label} must be bucket-relative` };
  }

  let normalizedEnd = result.value.length;
  while (normalizedEnd > 0 && result.value[normalizedEnd - 1] === "/") normalizedEnd -= 1;
  const normalized = result.value.slice(0, normalizedEnd);
  const segments = normalized.split("/");
  if (
    !normalized ||
    segments.some(
      (segment) => !segment || segment === "." || segment === ".." || segment.includes(":")
    )
  ) {
    return { reason: `${label} contains an unsafe path segment` };
  }

  return { value: normalized };
};

const readFileName = (
  value: unknown,
  label: string,
  requiredSuffix?: string
): ValidationResult<string> => {
  const result = readIdentifier(value, label);
  if ("reason" in result) return result;
  if (requiredSuffix && !result.value.endsWith(requiredSuffix)) {
    return { reason: `${label} must end with ${requiredSuffix}` };
  }

  return result;
};

const resolveAssetUrl = (
  path: string,
  fileName: string,
  fileSuffix?: string
): ValidationResult<string> => {
  const parsedPath = readRelativePath(path, "Asset path");
  if ("reason" in parsedPath) return parsedPath;

  const parsedFile = readFileName(fileName, "Asset file", fileSuffix);
  if ("reason" in parsedFile) return parsedFile;

  const bucketUrl = new URL(LIVE2D_ASSET_BUCKET_URL);
  const resolvedUrl = new URL(`${parsedPath.value}/${parsedFile.value}`, bucketUrl);
  if (
    resolvedUrl.origin !== bucketUrl.origin ||
    !resolvedUrl.pathname.startsWith(bucketUrl.pathname)
  ) {
    return { reason: "Asset path escapes the Live2D bucket" };
  }

  return { value: resolvedUrl.href };
};

/** Resolves one safe bucket-relative path/file pair, or returns null if unsafe. */
export const resolveLive2dAssetUrl = (path: string, fileName: string): string | null => {
  const result = resolveAssetUrl(path, fileName);
  return "value" in result ? result.value : null;
};

const invalid = (location: string, reason: string): InvalidResult => ({
  status: "invalid",
  reason: `${location}: ${reason}`
});

const parseMotionFiles = (
  value: unknown,
  path: string,
  location: string
): ValidationResult<{
  files: readonly string[];
  descriptors: readonly Live2dMotionUrlDescriptor[];
}> => {
  if (!Array.isArray(value)) return { reason: `${location} must be an array` };

  const ids = new Set<string>();
  const urls = new Set<string>();
  const files: string[] = [];
  const descriptors: Live2dMotionUrlDescriptor[] = [];

  for (const [index, item] of value.entries()) {
    const fileLocation = `${location}[${index}]`;
    const parsedFile = readFileName(item, fileLocation, MOTION_FILE_SUFFIX);
    if ("reason" in parsedFile) return parsedFile;
    if (ids.has(parsedFile.value)) return { reason: `${fileLocation} is a duplicate file ID` };

    const resolvedUrl = resolveAssetUrl(path, parsedFile.value, MOTION_FILE_SUFFIX);
    if ("reason" in resolvedUrl) return { reason: `${fileLocation}: ${resolvedUrl.reason}` };
    if (urls.has(resolvedUrl.value)) return { reason: `${fileLocation} is a duplicate file URL` };

    ids.add(parsedFile.value);
    urls.add(resolvedUrl.value);
    files.push(parsedFile.value);
    descriptors.push({ id: parsedFile.value, url: resolvedUrl.value });
  }

  return { value: { files, descriptors } };
};

const parseMotionSet = (
  value: unknown,
  location: string
): ValidationResult<Live2dAssociatedMotionSet> => {
  if (!isRecord(value)) return { reason: `${location} must be an object` };

  const motionSetId = readIdentifier(value.motionSetId, `${location}.motionSetId`);
  if ("reason" in motionSetId) return motionSetId;
  const motionPath = readRelativePath(value.motionPath, `${location}.motionPath`);
  if ("reason" in motionPath) return motionPath;
  const facialPath = readRelativePath(value.facialPath, `${location}.facialPath`);
  if ("reason" in facialPath) return facialPath;

  const bodyMotions = parseMotionFiles(
    value.motionFiles,
    motionPath.value,
    `${location}.motionFiles`
  );
  if ("reason" in bodyMotions) return bodyMotions;
  const facialMotions = parseMotionFiles(
    value.facialFiles,
    facialPath.value,
    `${location}.facialFiles`
  );
  if ("reason" in facialMotions) return facialMotions;

  const bodyMotionData = bodyMotions.value;
  const facialMotionData = facialMotions.value;
  const bodyUrls = new Set(bodyMotionData.descriptors.map((motion) => motion.url));
  if (facialMotionData.descriptors.some((motion) => bodyUrls.has(motion.url))) {
    return { reason: `${location} contains a duplicate body/facial file URL` };
  }

  return {
    value: {
      motionSetId: motionSetId.value,
      motionPath: motionPath.value,
      motionFiles: bodyMotionData.files,
      facialPath: facialPath.value,
      facialFiles: facialMotionData.files,
      bodyMotions: bodyMotionData.descriptors,
      facialMotions: facialMotionData.descriptors
    }
  };
};

const parseModel = (value: unknown, location: string): ValidationResult<Live2dAssociatedModel> => {
  if (!isRecord(value)) return { reason: `${location} must be an object` };

  const modelBase = readIdentifier(value.modelBase, `${location}.modelBase`);
  if ("reason" in modelBase) return modelBase;
  const modelFile = readFileName(value.modelFile, `${location}.modelFile`, MODEL_FILE_SUFFIX);
  if ("reason" in modelFile) return modelFile;
  const modelName = readIdentifier(value.modelName, `${location}.modelName`);
  if ("reason" in modelName) return modelName;
  const modelPath = readRelativePath(value.modelPath, `${location}.modelPath`);
  if ("reason" in modelPath) return modelPath;

  const modelUrl = resolveAssetUrl(modelPath.value, modelFile.value, MODEL_FILE_SUFFIX);
  if ("reason" in modelUrl) return modelUrl;
  if (!Array.isArray(value.motionSets)) {
    return { reason: `${location}.motionSets must be an array` };
  }

  const motionSetIds = new Set<string>();
  const motionSets: Live2dAssociatedMotionSet[] = [];
  for (const [index, item] of value.motionSets.entries()) {
    const motionSetLocation = `${location}.motionSets[${index}]`;
    const parsedMotionSet = parseMotionSet(item, motionSetLocation);
    if ("reason" in parsedMotionSet) return parsedMotionSet;
    if (motionSetIds.has(parsedMotionSet.value.motionSetId)) {
      return { reason: `${motionSetLocation}.motionSetId is a duplicate` };
    }

    motionSetIds.add(parsedMotionSet.value.motionSetId);
    motionSets.push(parsedMotionSet.value);
  }

  return {
    value: {
      region: LIVE2D_CATALOG_REGION,
      modelBase: modelBase.value,
      modelFile: modelFile.value,
      modelName: modelName.value,
      modelPath: modelPath.value,
      modelUrl: modelUrl.value,
      motionSets
    }
  };
};

/** Parses and resolves the verified associated-catalog array contract. */
export const parseLive2dAssociatedCatalog = (input: unknown): ParsedLive2dAssociatedCatalog => {
  if (!Array.isArray(input)) return { status: "invalid", reason: "Catalog root must be an array" };

  const modelNames = new Set<string>();
  const modelIdentities = new Set<string>();
  const modelUrls = new Set<string>();
  const models: Live2dAssociatedModel[] = [];

  for (const [index, item] of input.entries()) {
    const location = `catalog[${index}]`;
    const parsedModel = parseModel(item, location);
    if ("reason" in parsedModel) return { status: "invalid", reason: parsedModel.reason };

    const model = parsedModel.value;
    if (modelNames.has(model.modelName)) {
      return invalid(location, `modelName ${model.modelName} is a duplicate`);
    }

    const identity = `${model.modelBase}\u0000${model.modelFile}`;
    if (modelIdentities.has(identity)) {
      return invalid(location, "model identity is a duplicate");
    }
    if (modelUrls.has(model.modelUrl)) {
      return invalid(location, "model URL is a duplicate");
    }

    modelNames.add(model.modelName);
    modelIdentities.add(identity);
    modelUrls.add(model.modelUrl);
    models.push(model);
  }

  return { status: "ok", catalog: models };
};

export type Live2dCatalogFetchJson = (url: string) => Promise<unknown>;

export interface Live2dCatalogResolverOptions {
  fetchJson: Live2dCatalogFetchJson;
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export type Live2dCatalogResolution =
  | {
      status: "available";
      catalog: Live2dAssociatedCatalog;
      source: "network" | "cache" | "last-known-good";
      reason?: string;
    }
  | { status: "unavailable"; reason: string }
  | { status: "error"; error: Error };

export interface Live2dCatalogResolver {
  resolve(): Promise<Live2dCatalogResolution>;
  invalidate(): void;
}

type CatalogCacheEntry = {
  catalog: Live2dAssociatedCatalog;
  expiresAt: number;
};

const toError = (value: unknown, fallback: string): Error => {
  if (value instanceof Error) return value;
  if (typeof value === "string" && value.trim()) return new Error(value);
  return new Error(fallback);
};

const normalizeTtl = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? value : DEFAULT_CATALOG_TTL_MS;

const normalizeMaxEntries = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : DEFAULT_MAX_CACHE_ENTRIES;

/**
 * Creates a browser-free resolver for the fixed associated catalog endpoint.
 * Only successfully parsed catalogs enter the bounded cache. An expired
 * validated catalog remains available as last-known-good data when a refresh
 * fails, until `invalidate` is called.
 */
export const createLive2dCatalogResolver = (
  options: Live2dCatalogResolverOptions
): Live2dCatalogResolver => {
  const ttlMs = normalizeTtl(options.ttlMs);
  const maxEntries = normalizeMaxEntries(options.maxEntries);
  const now = options.now ?? Date.now;
  const cache = new Map<string, CatalogCacheEntry>();
  const inFlight = new Map<string, Promise<Live2dCatalogResolution>>();
  let generation = 0;

  const cacheCatalog = (catalog: Live2dAssociatedCatalog): void => {
    if (maxEntries === 0) return;
    if (!cache.has(CATALOG_CACHE_KEY) && cache.size >= maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (typeof oldestKey === "string") cache.delete(oldestKey);
    }
    cache.set(CATALOG_CACHE_KEY, { catalog, expiresAt: now() + ttlMs });
  };

  const resolveFailure = (
    previous: CatalogCacheEntry | undefined,
    requestGeneration: number,
    fallback: Live2dCatalogResolution,
    reason: string
  ): Live2dCatalogResolution => {
    if (previous && requestGeneration === generation) {
      return {
        status: "available",
        catalog: previous.catalog,
        source: "last-known-good",
        reason
      };
    }
    return fallback;
  };

  const fetchAndParse = async (
    previous: CatalogCacheEntry | undefined,
    requestGeneration: number
  ): Promise<Live2dCatalogResolution> => {
    let payload: unknown;
    try {
      payload = await options.fetchJson(LIVE2D_ASSOCIATED_CATALOG_URL);
    } catch (error) {
      const parsedError = toError(error, "Live2D catalog request failed");
      return resolveFailure(
        previous,
        requestGeneration,
        { status: "error", error: parsedError },
        parsedError.message
      );
    }

    if (payload === null || payload === undefined) {
      return resolveFailure(
        previous,
        requestGeneration,
        { status: "unavailable", reason: "Live2D catalog is unavailable" },
        "Live2D catalog is unavailable"
      );
    }

    const parsed = parseLive2dAssociatedCatalog(payload);
    if (parsed.status !== "ok") {
      const parsedError = new Error(parsed.reason);
      return resolveFailure(
        previous,
        requestGeneration,
        { status: "error", error: parsedError },
        parsedError.message
      );
    }

    if (requestGeneration === generation) cacheCatalog(parsed.catalog);
    return { status: "available", catalog: parsed.catalog, source: "network" };
  };

  const resolve = (): Promise<Live2dCatalogResolution> => {
    const cached = cache.get(CATALOG_CACHE_KEY);
    if (cached && cached.expiresAt > now()) {
      return Promise.resolve({ status: "available", catalog: cached.catalog, source: "cache" });
    }

    const pending = inFlight.get(CATALOG_CACHE_KEY);
    if (pending) return pending;

    const requestGeneration = generation;
    const request = fetchAndParse(cached, requestGeneration);
    inFlight.set(CATALOG_CACHE_KEY, request);
    void request.then(
      () => {
        if (inFlight.get(CATALOG_CACHE_KEY) === request) inFlight.delete(CATALOG_CACHE_KEY);
      },
      () => {
        if (inFlight.get(CATALOG_CACHE_KEY) === request) inFlight.delete(CATALOG_CACHE_KEY);
      }
    );
    return request;
  };

  return {
    resolve,
    invalidate: () => {
      generation += 1;
      cache.clear();
      inFlight.clear();
    }
  };
};
