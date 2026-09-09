import {
  createLive2dCatalogResolver,
  resolveLive2dAssetRelayUrl,
  type Live2dAssociatedCatalog,
  type Live2dAssociatedModel,
  type Live2dCatalogFetchJson,
  type Live2dCatalogResolution
} from "./associated-catalog";

const DEFAULT_ROUTE_DATA_CACHE_TTL_MS = 5 * 60 * 1000;

/** Serializable descriptor handed to the Live2D route pages. */
export type Live2dRouteModelDescriptor = Live2dAssociatedModel & { modelId: string };

type Live2dRouteModelSource = Live2dAssociatedModel & { modelId?: string };

export type Live2dCatalogRouteData =
  | {
      status: "ready";
      source: Extract<Live2dCatalogResolution, { status: "available" }>["source"];
      models: readonly (Live2dRouteModelDescriptor & { id: string })[];
      reason?: string;
    }
  | {
      status: "unavailable" | "error";
      reason: string;
      models: readonly [];
    };

export type Live2dCatalogResponseFetcher = (url: string) => Promise<Response>;

export interface Live2dCatalogRouteDataResolverOptions {
  ttlMs?: number;
  now?: () => number;
}

export interface Live2dCatalogRouteDataResolver {
  resolve(fetcher: Live2dCatalogResponseFetcher): Promise<Live2dCatalogRouteData>;
  invalidate(): void;
}

const toDescriptor = (
  model: Live2dRouteModelSource,
  modelId = model.modelId ?? model.modelName
): Live2dRouteModelDescriptor => ({
  ...model,
  modelId
});

export const toLive2dRouteModelDescriptor = toDescriptor;

const toErrorReason = (error: Error): string =>
  error.message.trim() || "Live2D catalog request failed";

const toRelayAssetUrl = (path: string, fileName: string): string => {
  const url = resolveLive2dAssetRelayUrl(path, fileName);
  if (!url) throw new Error("Live2D catalog contains an invalid asset reference");
  return url;
};

const toRelayModel = (model: Live2dAssociatedModel): Live2dAssociatedModel => ({
  ...model,
  modelUrl: toRelayAssetUrl(model.modelPath, model.modelFile),
  motionSets: model.motionSets.map((motionSet) => ({
    ...motionSet,
    bodyMotions: motionSet.bodyMotions.map((motion) => ({
      ...motion,
      url: toRelayAssetUrl(motionSet.motionPath, motion.id)
    })),
    facialMotions: motionSet.facialMotions.map((motion) => ({
      ...motion,
      url: toRelayAssetUrl(motionSet.facialPath, motion.id)
    }))
  }))
});

const toRouteModels = (
  catalog: Live2dAssociatedCatalog
): readonly (Live2dRouteModelDescriptor & { id: string })[] => {
  const modelNames = new Set(catalog.map((model) => model.modelName));
  const nameCounts = new Map<string, number>();
  const nameOccurrences = new Map<string, number>();
  const routeIds = new Set<string>();

  for (const model of catalog) {
    nameCounts.set(model.modelName, (nameCounts.get(model.modelName) ?? 0) + 1);
  }

  return catalog.map((model) => {
    const relayModel = toRelayModel(model);
    const occurrence = (nameOccurrences.get(relayModel.modelName) ?? 0) + 1;
    nameOccurrences.set(relayModel.modelName, occurrence);

    let modelId = relayModel.modelName;
    const hasDuplicateName = (nameCounts.get(relayModel.modelName) ?? 0) > 1;
    if (hasDuplicateName && (occurrence > 1 || routeIds.has(modelId))) {
      let suffix = occurrence;
      do {
        modelId = `${relayModel.modelName}-${suffix}`;
        suffix += 1;
      } while (routeIds.has(modelId) || modelNames.has(modelId));
    }

    routeIds.add(modelId);
    const descriptor = toDescriptor(relayModel, modelId);
    return { ...descriptor, id: modelId };
  });
};

const toRouteData = (resolution: Live2dCatalogResolution): Live2dCatalogRouteData => {
  if (resolution.status === "available") {
    return {
      status: "ready",
      source: resolution.source,
      models: toRouteModels(resolution.catalog),
      ...(resolution.reason ? { reason: resolution.reason } : {})
    };
  }

  return resolution.status === "unavailable"
    ? { status: "unavailable", reason: resolution.reason, models: [] }
    : { status: "error", reason: toErrorReason(resolution.error), models: [] };
};

const createFetchJson =
  (fetcher: Live2dCatalogResponseFetcher): Live2dCatalogFetchJson =>
  async (url) => {
    const response = await fetcher(url);
    if (!response.ok) {
      throw new Error(`Live2D catalog request failed with status ${response.status}`);
    }

    return response.json() as Promise<unknown>;
  };

const normalizeTtl = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_ROUTE_DATA_CACHE_TTL_MS;

type RouteDataCacheEntry = {
  catalog: Extract<Live2dCatalogResolution, { status: "available" }>["catalog"];
  expiresAt: number;
};

/**
 * Creates a route-data resolver with a bounded, server-module-local cache.
 *
 * The associated-catalog resolver is deliberately used as a one-shot network
 * parser here. The route-data resolver owns the longer-lived cache so each
 * refresh can use the current request's SvelteKit fetch without retaining a
 * request-specific fetch function in module state.
 */
export const createLive2dCatalogRouteDataResolver = (
  options: Live2dCatalogRouteDataResolverOptions = {}
): Live2dCatalogRouteDataResolver => {
  const ttlMs = normalizeTtl(options.ttlMs);
  const now = options.now ?? Date.now;
  let cache: RouteDataCacheEntry | undefined;
  let inFlight: Promise<Live2dCatalogRouteData> | undefined;
  let generation = 0;

  const resolveFreshCatalog = (
    fetcher: Live2dCatalogResponseFetcher
  ): Promise<Live2dCatalogResolution> =>
    createLive2dCatalogResolver({
      fetchJson: createFetchJson(fetcher),
      maxEntries: 0,
      now
    }).resolve();

  const resolve = (fetcher: Live2dCatalogResponseFetcher): Promise<Live2dCatalogRouteData> => {
    const cached = cache;
    if (cached && cached.expiresAt > now()) {
      return Promise.resolve(
        toRouteData({ status: "available", catalog: cached.catalog, source: "cache" })
      );
    }

    if (inFlight) return inFlight;

    const requestGeneration = generation;
    const request = resolveFreshCatalog(fetcher).then((resolution) => {
      if (resolution.status === "available") {
        if (requestGeneration === generation && resolution.source === "network") {
          cache = { catalog: resolution.catalog, expiresAt: now() + ttlMs };
        }

        return toRouteData(resolution);
      }

      if (cached && requestGeneration === generation) {
        const reason =
          resolution.status === "unavailable" ? resolution.reason : toErrorReason(resolution.error);
        return toRouteData({
          status: "available",
          catalog: cached.catalog,
          source: "last-known-good",
          reason
        });
      }

      return toRouteData(resolution);
    });

    inFlight = request;
    void request.then(
      () => {
        if (inFlight === request) inFlight = undefined;
      },
      () => {
        if (inFlight === request) inFlight = undefined;
      }
    );
    return request;
  };

  return {
    resolve,
    invalidate: () => {
      generation += 1;
      cache = undefined;
      inFlight = undefined;
    }
  };
};

const defaultRouteDataResolver = createLive2dCatalogRouteDataResolver();

/** Resolves catalog data for a server load without exposing Error objects to SvelteKit. */
export const resolveLive2dCatalogRouteData = (
  fetcher: Live2dCatalogResponseFetcher
): Promise<Live2dCatalogRouteData> => defaultRouteDataResolver.resolve(fetcher);
