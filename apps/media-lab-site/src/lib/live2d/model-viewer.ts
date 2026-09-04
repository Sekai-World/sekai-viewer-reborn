import { isModelRouteId } from "./model-route";

/**
 * Live2D currently uses the independent `sekai-live2d-assets` asset bucket.
 * Region is an explicit JP-only product contract; expanding to other regions
 * requires separate confirmation. Keep this list independent from ordinary
 * story-route region support.
 */
export const live2dModelRegions = ["jp"] as const;

export type Live2dModelRegion = (typeof live2dModelRegions)[number];

export interface Live2dModelOption {
  id: string;
  url: string;
}

/**
 * A fully resolved input for one standalone model. Catalog discovery and
 * region/bucket URL construction deliberately stay outside this controller.
 */
export interface Live2dModelDescriptor {
  modelId: string;
  region: Live2dModelRegion;
  modelUrl: string;
  displayName?: string;
  motions: readonly Live2dModelOption[];
  expressions: readonly Live2dModelOption[];
}

export type ParsedLive2dModelDescriptor =
  | { status: "ok"; descriptor: Live2dModelDescriptor }
  | { status: "invalid"; reason: string };

export interface Live2dPlaybackOptions {
  loop: boolean;
  speed: number;
}

/**
 * Implemented by a browser-only Pixi/Cubism adapter. Keeping this interface
 * injected prevents WebGL imports during SSR and avoids guessing asset layout.
 */
export interface Live2dModelResource {
  playMotion(id: string, options: Live2dPlaybackOptions): void | Promise<void>;
  playExpression(id: string): void | Promise<void>;
  setIdle(enabled: boolean): void | Promise<void>;
  pause(): void | Promise<void>;
  reset(): void | Promise<void>;
  resize(width: number, height: number): void | Promise<void>;
  destroy(): void | Promise<void>;
}

export interface Live2dModelLoader {
  load(
    descriptor: Live2dModelDescriptor,
    signal: AbortSignal,
    onProgress: (progress: number) => void
  ): Promise<Live2dModelResource>;
  preload?(url: string, signal: AbortSignal): Promise<void>;
}

export type Live2dModelViewerState =
  | { status: "idle" }
  | { status: "loading"; descriptor: Live2dModelDescriptor; progress: number }
  | { status: "ready"; descriptor: Live2dModelDescriptor }
  | { status: "unavailable"; reason: string }
  | { status: "error"; descriptor: Live2dModelDescriptor; error: Error }
  | { status: "destroyed" };

export interface Live2dModelViewer {
  getState(): Live2dModelViewerState;
  subscribe(listener: (state: Live2dModelViewerState) => void): () => void;
  load(descriptor: Live2dModelDescriptor | null): Promise<Live2dModelViewerState>;
  reload(): Promise<Live2dModelViewerState>;
  abort(): void;
  setPlaybackOptions(options: Partial<Live2dPlaybackOptions>): boolean;
  playMotion(id: string): Promise<boolean>;
  playExpression(id: string): Promise<boolean>;
  setIdle(enabled: boolean): Promise<boolean>;
  pause(): Promise<boolean>;
  reset(): Promise<boolean>;
  resize(width: number, height: number): Promise<boolean>;
  destroy(): Promise<void>;
}

export interface Live2dModelViewerOptions {
  maxPreload?: number;
}

const DEFAULT_PRELOAD_LIMIT = 6;
const defaultPlaybackOptions: Live2dPlaybackOptions = { loop: false, speed: 1 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isLive2dModelRegion = (value: string): value is Live2dModelRegion =>
  (live2dModelRegions as readonly string[]).includes(value);

const isAbsoluteHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const toError = (value: unknown): Error => {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  return new Error("Model viewer failed");
};

const clampProgress = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

const normalizePreloadLimit = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const parseOptions = (
  value: unknown,
  kind: "motion" | "expression"
): { options: Live2dModelOption[] } | { reason: string } => {
  if (!Array.isArray(value)) return { reason: `${kind}s must be an array` };

  const ids = new Set<string>();
  const options: Live2dModelOption[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.url !== "string") {
      return { reason: `Each ${kind} must contain an id and URL` };
    }

    const id = item.id.trim();
    const url = item.url.trim();
    if (!isModelRouteId(id)) return { reason: `Invalid ${kind} id` };
    if (!isAbsoluteHttpsUrl(url)) return { reason: `Invalid ${kind} URL` };
    if (ids.has(id)) return { reason: `Duplicate ${kind} id` };

    ids.add(id);
    options.push({ id, url });
  }

  return { options };
};

/** Validates untrusted catalog data without fetching or resolving asset paths. */
export const parseLive2dModelDescriptor = (input: unknown): ParsedLive2dModelDescriptor => {
  if (!isRecord(input)) return { status: "invalid", reason: "Descriptor must be an object" };
  if (typeof input.modelId !== "string") return { status: "invalid", reason: "Missing model id" };
  if (typeof input.region !== "string") return { status: "invalid", reason: "Missing region" };
  if (typeof input.modelUrl !== "string") return { status: "invalid", reason: "Missing model URL" };

  const modelId = input.modelId.trim();
  const region = input.region.trim().toLowerCase();
  const modelUrl = input.modelUrl.trim();
  if (!isModelRouteId(modelId)) return { status: "invalid", reason: "Invalid model id" };
  if (!isLive2dModelRegion(region)) return { status: "invalid", reason: "Invalid region" };
  if (!isAbsoluteHttpsUrl(modelUrl)) return { status: "invalid", reason: "Invalid model URL" };
  if (input.displayName !== undefined && typeof input.displayName !== "string") {
    return { status: "invalid", reason: "Invalid display name" };
  }

  const parsedMotions = parseOptions(input.motions, "motion");
  if ("reason" in parsedMotions) return { status: "invalid", reason: parsedMotions.reason };
  const parsedExpressions = parseOptions(input.expressions, "expression");
  if ("reason" in parsedExpressions) return { status: "invalid", reason: parsedExpressions.reason };

  const allOptionIds = new Set(parsedMotions.options.map((option) => option.id));
  if (parsedExpressions.options.some((option) => allOptionIds.has(option.id))) {
    return { status: "invalid", reason: "Duplicate model option id" };
  }

  const displayName = input.displayName?.trim();
  return {
    status: "ok",
    descriptor: {
      modelId,
      region,
      modelUrl,
      ...(displayName ? { displayName } : {}),
      motions: parsedMotions.options,
      expressions: parsedExpressions.options
    }
  };
};

/** Returns the bounded, de-duplicated preload sequence in catalog order. */
export const getLive2dPreloadUrls = (
  descriptor: Live2dModelDescriptor,
  maxPreload: number
): readonly string[] => {
  const limit = normalizePreloadLimit(maxPreload);
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const option of [...descriptor.motions, ...descriptor.expressions]) {
    if (urls.length >= limit) break;
    if (seen.has(option.url)) continue;
    seen.add(option.url);
    urls.push(option.url);
  }
  return urls;
};

const safelyDestroy = async (resource: Live2dModelResource | null): Promise<void> => {
  if (!resource) return;
  try {
    await resource.destroy();
  } catch {
    // Teardown should never overwrite a newer load state.
  }
};

export const createLive2dModelViewer = (
  loader: Live2dModelLoader,
  options: Live2dModelViewerOptions = {}
): Live2dModelViewer => {
  const maxPreload = normalizePreloadLimit(options.maxPreload ?? DEFAULT_PRELOAD_LIMIT);
  const listeners = new Set<(state: Live2dModelViewerState) => void>();
  let state: Live2dModelViewerState = { status: "idle" };
  let resource: Live2dModelResource | null = null;
  let abortController: AbortController | null = null;
  let lastDescriptor: Live2dModelDescriptor | null = null;
  let playbackOptions = { ...defaultPlaybackOptions };
  let generation = 0;
  let isDestroyed = false;
  let pendingDestroy: Promise<void> | null = null;
  const pendingLoads = new Set<Promise<Live2dModelViewerState>>();

  const publish = (nextState: Live2dModelViewerState): void => {
    state = nextState;
    for (const listener of listeners) listener(state);
  };

  const invalidateActiveOperation = (): Live2dModelResource | null => {
    abortController?.abort();
    abortController = null;
    const activeResource = resource;
    resource = null;
    return activeResource;
  };

  const retireActiveOperation = (): Promise<void> | undefined => {
    const activeResource = invalidateActiveOperation();
    if (!activeResource) return pendingDestroy ?? undefined;

    const destroyPromise = safelyDestroy(activeResource);
    const trackedDestroy = destroyPromise.finally(() => {
      if (pendingDestroy === trackedDestroy) pendingDestroy = null;
    });
    pendingDestroy = trackedDestroy;
    return trackedDestroy;
  };

  const isCurrent = (token: number, controller: AbortController): boolean =>
    !isDestroyed && generation === token && abortController === controller && !controller.signal.aborted;

  const preloadModelAssets = async (
    descriptor: Live2dModelDescriptor,
    token: number,
    controller: AbortController,
    loadedResource: Live2dModelResource
  ): Promise<boolean> => {
    for (const url of getLive2dPreloadUrls(descriptor, maxPreload)) {
      if (!isCurrent(token, controller)) {
        await safelyDestroy(loadedResource);
        return false;
      }
      await loader.preload!(url, controller.signal);
    }
    return true;
  };

  const runReadyCommand = async (
    command: (activeResource: Live2dModelResource) => void | Promise<void>
  ): Promise<boolean> => {
    if (state.status !== "ready" || !resource || isDestroyed) return false;

    const activeResource = resource;
    const descriptor = state.descriptor;
    try {
      await command(activeResource);
      return !isDestroyed && state.status === "ready" && resource === activeResource;
    } catch (error) {
      if (resource === activeResource) {
        resource = null;
        await safelyDestroy(activeResource);
        if (!isDestroyed) publish({ status: "error", descriptor, error: toError(error) });
      }
      return false;
    }
  };

  const loadModel = async (
    input: Live2dModelDescriptor | null
  ): Promise<Live2dModelViewerState> => {
    if (isDestroyed) return state;

    // Reserve this operation before any async cleanup. A later load can then
    // supersede this request even while the previous model is being destroyed.
    const token = ++generation;
    const retiring = retireActiveOperation();
    if (retiring) await retiring;
    if (isDestroyed || generation !== token) return state;

    if (input === null) {
      lastDescriptor = null;
      publish({ status: "unavailable", reason: "No model descriptor is available" });
      return state;
    }

    const parsed = parseLive2dModelDescriptor(input);
    if (parsed.status !== "ok") {
      lastDescriptor = null;
      publish({ status: "unavailable", reason: parsed.reason });
      return state;
    }

    const descriptor = parsed.descriptor;
    lastDescriptor = descriptor;
    const controller = new AbortController();
    abortController = controller;
    publish({ status: "loading", descriptor, progress: 0 });

    let loadedResource: Live2dModelResource | null = null;
    try {
      loadedResource = await loader.load(descriptor, controller.signal, (progress) => {
        if (isCurrent(token, controller) && state.status === "loading") {
          publish({ status: "loading", descriptor, progress: clampProgress(progress) });
        }
      });

      if (!isCurrent(token, controller)) {
        await safelyDestroy(loadedResource);
        return state;
      }

      if (loader.preload && !(await preloadModelAssets(descriptor, token, controller, loadedResource))) {
        return state;
      }

      if (!isCurrent(token, controller)) {
        await safelyDestroy(loadedResource);
        return state;
      }

      resource = loadedResource;
      abortController = null;
      publish({ status: "ready", descriptor });
      return state;
    } catch (error) {
      if (!isCurrent(token, controller)) {
        await safelyDestroy(loadedResource);
        return state;
      }

      abortController = null;
      await safelyDestroy(loadedResource);
      publish({ status: "error", descriptor, error: toError(error) });
      return state;
    }
  };

  const load = (input: Live2dModelDescriptor | null): Promise<Live2dModelViewerState> => {
    const operation = loadModel(input);
    pendingLoads.add(operation);
    void operation.then(
      () => pendingLoads.delete(operation),
      () => pendingLoads.delete(operation)
    );
    return operation;
  };

  const waitForCleanup = async (): Promise<void> => {
    while (pendingLoads.size > 0) {
      await Promise.all(pendingLoads);
    }
    if (pendingDestroy) await pendingDestroy;
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    load,
    reload: async () =>
      lastDescriptor ? load(lastDescriptor) : load(null),
    abort: () => {
      if (isDestroyed) return;
      generation += 1;
      const activeResource = invalidateActiveOperation();
      if (activeResource) {
        const destroyPromise = safelyDestroy(activeResource);
        const trackedDestroy = destroyPromise.finally(() => {
          if (pendingDestroy === trackedDestroy) pendingDestroy = null;
        });
        pendingDestroy = trackedDestroy;
      }
      publish({ status: "idle" });
    },
    setPlaybackOptions: (nextOptions) => {
      if (isDestroyed) return false;
      if (nextOptions.loop !== undefined && typeof nextOptions.loop !== "boolean") return false;
      if (nextOptions.speed !== undefined && !isPositiveFinite(nextOptions.speed)) return false;
      playbackOptions = { ...playbackOptions, ...nextOptions };
      return true;
    },
    playMotion: async (id) => {
      if (state.status !== "ready" || !state.descriptor.motions.some((motion) => motion.id === id)) {
        return false;
      }
      return runReadyCommand((activeResource) => activeResource.playMotion(id, playbackOptions));
    },
    playExpression: async (id) => {
      if (
        state.status !== "ready" ||
        !state.descriptor.expressions.some((expression) => expression.id === id)
      ) {
        return false;
      }
      return runReadyCommand((activeResource) => activeResource.playExpression(id));
    },
    setIdle: async (enabled) =>
      typeof enabled === "boolean" && runReadyCommand((activeResource) => activeResource.setIdle(enabled)),
    pause: async () => runReadyCommand((activeResource) => activeResource.pause()),
    reset: async () => runReadyCommand((activeResource) => activeResource.reset()),
    resize: async (width, height) => {
      if (!isPositiveFinite(width) || !isPositiveFinite(height)) return false;
      return runReadyCommand((activeResource) => activeResource.resize(width, height));
    },
    destroy: async () => {
      if (isDestroyed) {
        await waitForCleanup();
        return;
      }
      generation += 1;
      isDestroyed = true;
      publish({ status: "destroyed" });
      const activeResource = invalidateActiveOperation();
      if (activeResource) {
        const destroyPromise = safelyDestroy(activeResource);
        const trackedDestroy = destroyPromise.finally(() => {
          if (pendingDestroy === trackedDestroy) pendingDestroy = null;
        });
        pendingDestroy = trackedDestroy;
      }
      await waitForCleanup();
      listeners.clear();
    }
  };
};
