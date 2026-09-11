import type { Ticker } from "pixi.js";
import {
  isLive2dAssetRelayUrl,
  parseLive2dAssetRelayUrl,
  toLive2dAssetRelayUrlFromPath,
  toLive2dAssetRelayUrlFromUpstreamUrl,
  LIVE2D_ASSET_BUCKET_URL,
  LIVE2D_ASSET_RELAY_PREFIX
} from "./associated-catalog";
import type { Live2dModelDescriptor, Live2dModelLoader, Live2dModelResource } from "./model-viewer";

type JsonObject = Record<string, unknown>;

const MOTION_GROUP = "Motion";
const EXPRESSION_GROUP = "Expression";
const PARALLEL_MANAGER_COUNT = 2;
const BODY_MANAGER_INDEX = 0;
const FACE_MANAGER_INDEX = 1;
const CUBISM_CORE_SCRIPT_URL = "/live2d/cubism-core/live2dcubismcore.min.js";
const MODEL_FILE_REFERENCE_KEYS = ["Moc", "Physics", "Pose", "DisplayInfo", "UserData"] as const;

const DESTROY_OPTIONS = {
  children: true,
  texture: true,
  baseTexture: true
} as const;

export interface Live2dSettingsResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type Live2dSettingsFetcher = (
  url: string,
  signal: AbortSignal
) => Promise<Live2dSettingsResponse>;

export interface Live2dMotionManager {
  startMotion(group: string, index: number, priority: number): Promise<boolean>;
  stopAllMotions(): void;
}

export interface Live2dDestroyOptions {
  children?: boolean;
  texture?: boolean;
  baseTexture?: boolean;
}

export interface Live2dBreathController {
  getParameters(): unknown;
  setParameters(parameters: unknown): void;
}

export interface Live2dTransformPoint {
  set(x: number, y?: number): void;
}

export interface Live2dModelInstance {
  internalModel: {
    breath?: Live2dBreathController;
    width: number;
    height: number;
    motionManager: Live2dMotionManager;
    parallelMotionManager: Live2dMotionManager[];
    extendParallelMotionManager(managerCount: number): void;
  };
  anchor: Live2dTransformPoint;
  position: Live2dTransformPoint;
  scale: Live2dTransformPoint;
  destroy(options?: Live2dDestroyOptions): void;
}

export interface Live2dPixiApplication {
  ticker: Ticker;
  addModel(model: Live2dModelInstance): void;
  removeModel(model: Live2dModelInstance): void;
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export interface Live2dPixiRuntime {
  createApplication(host: HTMLElement): Live2dPixiApplication;
}

export interface Live2dCubismRuntime {
  forcePriority: number;
  loadModel(settings: JsonObject, options: { ticker: Ticker }): Promise<Live2dModelInstance>;
}

/**
 * Runtime boundary for browser-only dependencies and network access. Tests can
 * provide this facade without importing Pixi, creating a canvas, or requiring
 * WebGL.
 */
export interface Live2dRuntimeFacade {
  loadPixi(): Promise<Live2dPixiRuntime>;
  loadCubism4(): Promise<Live2dCubismRuntime>;
  fetchSettings: Live2dSettingsFetcher;
}

export interface Live2dModelLoaderOptions {
  runtime?: Live2dRuntimeFacade;
}

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
  }
}

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)])
  );
};

type Live2dModelAssetContext = {
  absoluteModelUrl: string;
  modelAssetPath: string | null;
  origin: string;
  relayOnly: boolean;
};

const UNSAFE_REFERENCE_PATTERN = /[\\?#%]/;
const REFERENCE_SCHEME_PATTERN = /^[A-Za-z][A-Za-z\d+.-]*:/;

const getCurrentOrigin = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  if (typeof location !== "undefined" && location.origin) return location.origin;
  return "http://localhost";
};

const isUnsafeReference = (value: string): boolean =>
  value !== value.trim() ||
  UNSAFE_REFERENCE_PATTERN.test(value) ||
  Array.from(value).some((character) => {
    const code = character.codePointAt(0);
    return code !== undefined && ((code >= 0 && code <= 31) || (code >= 127 && code <= 159));
  });

const getRawAbsoluteUrlPath = (value: string): string | null => {
  const schemeSeparator = value.indexOf("://");
  if (schemeSeparator < 1) return null;

  const pathStart = value.indexOf("/", schemeSeparator + 3);
  if (pathStart < 0) return "/";

  const pathAndQuery = value.slice(pathStart);
  const queryOrFragmentStart = pathAndQuery.search(/[?#]/);
  return queryOrFragmentStart < 0 ? pathAndQuery : pathAndQuery.slice(0, queryOrFragmentStart);
};

const toCurrentOriginRelayUrl = (value: string, origin: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (
    parsed.origin !== origin ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    return null;
  }

  const rawPath = getRawAbsoluteUrlPath(value);
  if (!rawPath) return null;

  const validation = parseLive2dAssetRelayUrl(rawPath);
  if (validation.status !== "ok") return null;

  const canonical = toLive2dAssetRelayUrlFromPath(validation.asset.path);
  return canonical && new URL(canonical, origin).href === parsed.href ? canonical : null;
};

const resolveModelAssetContext = (modelUrl: string): Live2dModelAssetContext => {
  if (modelUrl !== modelUrl.trim()) throw new Error("Live2D model URL is invalid");

  const origin = getCurrentOrigin();
  const upstreamBucketOrigin = new URL(LIVE2D_ASSET_BUCKET_URL).origin;
  let relayUrl = isLive2dAssetRelayUrl(modelUrl) ? modelUrl : null;
  relayUrl ??= toCurrentOriginRelayUrl(modelUrl, origin);
  relayUrl ??= toLive2dAssetRelayUrlFromUpstreamUrl(modelUrl);

  if (relayUrl) {
    const validation = parseLive2dAssetRelayUrl(relayUrl);
    if (validation.status !== "ok") throw new Error("Live2D model URL is invalid");

    return {
      absoluteModelUrl: new URL(relayUrl, origin).href,
      modelAssetPath: validation.asset.path,
      origin,
      relayOnly: true
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(modelUrl);
  } catch {
    throw new Error("Live2D model URL is invalid");
  }
  if (parsed.protocol !== "https:") throw new Error("Live2D model URL is invalid");
  if (parsed.origin === upstreamBucketOrigin) {
    throw new Error("Live2D model URL is not a valid asset");
  }
  if (parsed.origin === origin && parsed.pathname.startsWith(LIVE2D_ASSET_RELAY_PREFIX)) {
    throw new Error("Live2D model URL is not a canonical relay URL");
  }

  return {
    absoluteModelUrl: parsed.href,
    modelAssetPath: null,
    origin,
    relayOnly: false
  };
};

const isAbsoluteReference = (value: string): boolean =>
  value.startsWith("/") || value.startsWith("//") || REFERENCE_SCHEME_PATTERN.test(value);

const resolveLive2dAssetReference = (value: unknown, context: Live2dModelAssetContext): string => {
  if (typeof value !== "string") {
    throw new Error("Live2D asset reference is invalid");
  }

  const relayUrl = isLive2dAssetRelayUrl(value)
    ? value
    : toLive2dAssetRelayUrlFromUpstreamUrl(value);
  if (relayUrl) return new URL(relayUrl, context.origin).href;

  const currentOriginRelayUrl = toCurrentOriginRelayUrl(value, context.origin);
  if (currentOriginRelayUrl) return new URL(currentOriginRelayUrl, context.origin).href;

  if (isUnsafeReference(value)) throw new Error("Live2D asset reference is invalid");

  if (context.relayOnly) {
    if (isAbsoluteReference(value) || !context.modelAssetPath) {
      throw new Error("Live2D asset reference is outside the relay");
    }

    const baseDirectory = context.modelAssetPath.slice(0, context.modelAssetPath.lastIndexOf("/"));
    const resolvedRelayUrl = toLive2dAssetRelayUrlFromPath(`${baseDirectory}/${value}`);
    if (!resolvedRelayUrl) throw new Error("Live2D asset reference is outside the relay");
    return new URL(resolvedRelayUrl, context.origin).href;
  }

  if (isAbsoluteReference(value)) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("Live2D asset reference is invalid");
    }
    if (parsed.protocol !== "https:") throw new Error("Live2D asset reference is invalid");
    if (parsed.origin === new URL(LIVE2D_ASSET_BUCKET_URL).origin) {
      throw new Error("Live2D asset reference is not a valid asset");
    }
    return parsed.href;
  }

  let resolved: URL;
  try {
    resolved = new URL(value, context.absoluteModelUrl);
  } catch {
    throw new Error("Live2D asset reference is invalid");
  }
  if (resolved.protocol !== "https:") throw new Error("Live2D asset reference is invalid");
  return resolved.href;
};

/**
 * Clones a fetched model3.json and routes the catalog-resolved motion URLs into
 * the two mulmotion groups used by the adapter. Facial motion3.json files must
 * not be put in Cubism's separate exp3.json expression list.
 */
export const buildLive2dModelSettings = (
  payload: unknown,
  descriptor: Live2dModelDescriptor
): JsonObject => {
  const cloned = cloneJsonValue(payload);
  if (!isRecord(cloned)) throw new Error("Live2D model settings must be an object");

  const fileReferences = cloned.FileReferences;
  if (!isRecord(fileReferences)) {
    throw new Error("Live2D model settings are missing FileReferences");
  }

  const context = resolveModelAssetContext(descriptor.modelUrl);
  const resolveReference = (value: unknown): string => resolveLive2dAssetReference(value, context);

  for (const key of MODEL_FILE_REFERENCE_KEYS) {
    if (fileReferences[key] !== undefined) {
      fileReferences[key] = resolveReference(fileReferences[key]);
    }
  }

  if (fileReferences.Textures !== undefined) {
    if (!Array.isArray(fileReferences.Textures)) {
      throw new Error("Live2D model settings Textures must be an array");
    }
    fileReferences.Textures = fileReferences.Textures.map(resolveReference);
  }

  cloned.url = context.absoluteModelUrl;
  fileReferences.Expressions = [];
  fileReferences.Motions = {
    [MOTION_GROUP]: descriptor.motions.map((motion) => ({ File: resolveReference(motion.url) })),
    [EXPRESSION_GROUP]: descriptor.expressions.map((expression) => ({
      File: resolveReference(expression.url)
    }))
  };

  return cloned;
};

const createAbortError = (): Error => {
  const error = new Error("Live2D model loading was aborted");
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw createAbortError();
};

const waitForAbort = async <T>(operation: Promise<T>, signal: AbortSignal): Promise<T> => {
  throwIfAborted(signal);

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const finish = (): void => {
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      finish();
      reject(createAbortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
    void operation.then(
      (value) => {
        if (settled) return;
        settled = true;
        finish();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        finish();
        reject(error);
      }
    );
  });
};

let cubismCoreLoadPromise: Promise<void> | null = null;

export const ensureCubismCore = (): Promise<void> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Live2D Cubism Core can only be loaded in a browser"));
  }

  if (window.Live2DCubismCore !== undefined) return Promise.resolve();
  if (cubismCoreLoadPromise) return cubismCoreLoadPromise;

  let script: HTMLScriptElement | null = null;
  const loadPromise = new Promise<void>((resolve, reject) => {
    script = document.createElement("script");
    script.async = true;
    script.src = CUBISM_CORE_SCRIPT_URL;
    script.onload = () => {
      if (window.Live2DCubismCore === undefined) {
        reject(
          new Error(
            `Live2D Cubism Core script loaded but did not expose window.Live2DCubismCore: ${CUBISM_CORE_SCRIPT_URL}`
          )
        );
        return;
      }
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load Live2D Cubism Core from ${CUBISM_CORE_SCRIPT_URL}`));
    };
    document.head.appendChild(script);
  });

  cubismCoreLoadPromise = loadPromise.catch((error: unknown) => {
    cubismCoreLoadPromise = null;
    if (script?.parentNode) script.remove();
    throw error;
  });

  return cubismCoreLoadPromise;
};

const getDevicePixelRatio = (): number => {
  const devicePixelRatio = typeof window === "undefined" ? undefined : window.devicePixelRatio;
  if (
    typeof devicePixelRatio !== "number" ||
    !Number.isFinite(devicePixelRatio) ||
    devicePixelRatio <= 0
  ) {
    return 1;
  }
  return devicePixelRatio;
};

const createDefaultRuntimeFacade = (): Live2dRuntimeFacade => ({
  loadPixi: async () => {
    const pixi = await import("pixi.js");

    return {
      createApplication: (host) => {
        pixi.extensions.add(pixi.TickerPlugin);
        const app = new pixi.Application({
          antialias: true,
          autoDensity: true,
          backgroundAlpha: 0,
          resolution: getDevicePixelRatio(),
          resizeTo: host,
          sharedTicker: false,
          autoStart: true
        });
        const view = app.view as unknown as HTMLElement;
        host.appendChild(view);

        type PixiStageChild = Parameters<typeof app.stage.addChild>[0];
        const asStageChild = (model: Live2dModelInstance): PixiStageChild =>
          model as unknown as PixiStageChild;

        let destroyed = false;
        return {
          ticker: app.ticker,
          addModel: (model) => {
            app.stage.addChild(asStageChild(model));
          },
          removeModel: (model) => {
            const displayObject = asStageChild(model);
            if (displayObject.parent === app.stage) displayObject.removeFromParent();
          },
          resize: (width, height) => {
            app.renderer.resize(width, height);
          },
          pause: () => app.stop(),
          resume: () => app.start(),
          destroy: () => {
            if (destroyed) return;
            destroyed = true;
            try {
              app.destroy(true, DESTROY_OPTIONS);
            } finally {
              if (view.parentNode === host) view.remove();
            }
          }
        };
      }
    };
  },
  loadCubism4: async () => {
    await ensureCubismCore();
    const cubism4 = await import("@sekai-world/pixi-live2d-display-mulmotion/cubism4");
    cubism4.config.logLevel = cubism4.config.LOG_LEVEL_ERROR;
    cubism4.config.sound = false;

    return {
      forcePriority: cubism4.MotionPriority.FORCE,
      loadModel: async (settings, options) =>
        (await cubism4.Live2DModel.from(settings, {
          autoUpdate: true,
          ticker: options.ticker,
          autoHitTest: false,
          autoFocus: false
        })) as unknown as Live2dModelInstance
    };
  },
  fetchSettings: async (url, signal) => {
    const response = await fetch(url, { signal });
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json() as Promise<unknown>
    };
  }
});

const safeDestroyModel = (model: Live2dModelInstance | null): void => {
  if (!model) return;
  try {
    model.destroy(DESTROY_OPTIONS);
  } catch {
    // Preserve the original load or command failure while still attempting app cleanup.
  }
};

const findMotionIndex = (
  options: readonly { id: string }[],
  id: string,
  kind: "motion" | "expression"
): number => {
  const index = options.findIndex((option) => option.id === id);
  if (index < 0) throw new Error(`Unknown Live2D ${kind}: ${id}`);
  return index;
};

const MODEL_STAGE_PADDING = 0.1;
const MODEL_STAGE_CONTENT_SCALE = 1 - MODEL_STAGE_PADDING * 2;
const MIN_MODEL_ZOOM = 1;
const MAX_MODEL_ZOOM = 4;

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

interface Live2dViewportState {
  width: number;
  height: number;
  fitScale: number;
  zoomFactor: number;
  offsetX: number;
  offsetY: number;
}

interface Live2dViewportPanBounds {
  maxOffsetX: number;
  maxOffsetY: number;
}

const getViewportPanBounds = (
  model: Live2dModelInstance,
  viewport: Live2dViewportState
): Live2dViewportPanBounds => {
  const scale = viewport.fitScale * viewport.zoomFactor;
  const modelWidth = model.internalModel.width * scale;
  const modelHeight = model.internalModel.height * scale;
  const horizontalOverflow = modelWidth - viewport.width;
  const verticalOverflow = modelHeight - viewport.height;

  return {
    maxOffsetX: Number.isFinite(horizontalOverflow)
      ? Math.abs(horizontalOverflow) / 2
      : Number.MAX_VALUE,
    maxOffsetY: Number.isFinite(verticalOverflow)
      ? Math.abs(verticalOverflow) / 2
      : Number.MAX_VALUE
  };
};

const clampViewportOffset = (offset: number, maximum: number): number => {
  if (offset === Number.NEGATIVE_INFINITY) return -maximum;
  if (offset === Number.POSITIVE_INFINITY) return maximum;
  if (!Number.isFinite(offset)) return 0;
  return Math.min(maximum, Math.max(-maximum, offset));
};

const clampViewportOffsets = (model: Live2dModelInstance, viewport: Live2dViewportState): void => {
  const bounds = getViewportPanBounds(model, viewport);
  viewport.offsetX = clampViewportOffset(viewport.offsetX, bounds.maxOffsetX);
  viewport.offsetY = clampViewportOffset(viewport.offsetY, bounds.maxOffsetY);
};

const applyModelTransform = (model: Live2dModelInstance, viewport: Live2dViewportState): void => {
  const scale = viewport.fitScale * viewport.zoomFactor;
  model.anchor.set(0.5, 0.5);
  model.scale.set(scale, scale);
  model.position.set(viewport.width / 2 + viewport.offsetX, viewport.height / 2 + viewport.offsetY);
};

const fitModelToStage = (
  model: Live2dModelInstance,
  width: number,
  height: number,
  previousViewport: Live2dViewportState | null = null
): Live2dViewportState => {
  if (!isPositiveFinite(width) || !isPositiveFinite(height)) {
    throw new Error("Live2D stage dimensions must be positive and finite");
  }

  const modelWidth = model.internalModel.width;
  const modelHeight = model.internalModel.height;
  if (!isPositiveFinite(modelWidth) || !isPositiveFinite(modelHeight)) {
    throw new Error("Live2D model dimensions must be positive and finite");
  }

  const scale = Math.min(
    (width * MODEL_STAGE_CONTENT_SCALE) / modelWidth,
    (height * MODEL_STAGE_CONTENT_SCALE) / modelHeight
  );
  if (!isPositiveFinite(scale)) {
    throw new Error("Live2D model transform could not be calculated");
  }

  const viewport: Live2dViewportState = {
    width,
    height,
    fitScale: scale,
    zoomFactor: previousViewport?.zoomFactor ?? MIN_MODEL_ZOOM,
    offsetX: previousViewport?.offsetX ?? 0,
    offsetY: previousViewport?.offsetY ?? 0
  };

  clampViewportOffsets(model, viewport);
  // Live2DModel exposes a Sprite-like anchor. Using its center makes the
  // position the stage center regardless of the model's native dimensions.
  // Keep the user's zoom and pan when only the stage size changes.
  applyModelTransform(model, viewport);
  return viewport;
};

const getHostSize = (host: HTMLElement): { width: number; height: number } | null => {
  const { clientWidth: width, clientHeight: height } = host;
  return isPositiveFinite(width) && isPositiveFinite(height) ? { width, height } : null;
};

const getParallelMotionManager = (
  model: Live2dModelInstance,
  index: number,
  kind: "body" | "face"
): Live2dMotionManager => {
  const manager = model.internalModel.parallelMotionManager[index];
  if (!manager) throw new Error(`Live2D ${kind} motion slot is unavailable`);
  return manager;
};

const stopAllMotionManagers = (model: Live2dModelInstance): void => {
  const managers = new Set<Live2dMotionManager>([
    model.internalModel.motionManager,
    ...model.internalModel.parallelMotionManager
  ]);
  for (const manager of managers) manager.stopAllMotions();
};

const resetViewport = (model: Live2dModelInstance, viewport: Live2dViewportState | null): void => {
  if (!viewport) return;
  viewport.zoomFactor = MIN_MODEL_ZOOM;
  viewport.offsetX = 0;
  viewport.offsetY = 0;
  applyModelTransform(model, viewport);
};

/** Creates the browser-only loader used by the framework-agnostic viewer seam. */
export const createLive2dModelLoader = (
  host: HTMLElement,
  options: Live2dModelLoaderOptions = {}
): Live2dModelLoader => {
  const runtime = options.runtime ?? createDefaultRuntimeFacade();

  return {
    load: async (descriptor, signal, onProgress): Promise<Live2dModelResource> => {
      throwIfAborted(signal);
      onProgress(0);

      let application: Live2dPixiApplication | null = null;
      let model: Live2dModelInstance | null = null;
      let modelPromise: Promise<Live2dModelInstance> | null = null;
      let modelAdded = false;
      let viewport: Live2dViewportState | null = null;

      const cleanup = (): void => {
        if (application && model && modelAdded) {
          try {
            application.removeModel(model);
          } catch {
            // Continue teardown if the display tree was already retired.
          }
          modelAdded = false;
        }
        safeDestroyModel(model);
        model = null;
        if (application) {
          try {
            application.destroy();
          } catch {
            // Teardown must not mask the original load failure.
          }
          application = null;
        }
      };

      try {
        const modelAssetContext = resolveModelAssetContext(descriptor.modelUrl);
        const [pixi, cubism4] = await waitForAbort(
          Promise.all([runtime.loadPixi(), runtime.loadCubism4()]),
          signal
        );
        onProgress(0.15);

        const response = await waitForAbort(
          runtime.fetchSettings(modelAssetContext.absoluteModelUrl, signal),
          signal
        );
        if (!response.ok) {
          throw new Error(`Failed to load Live2D model settings (${response.status})`);
        }
        const payload = await waitForAbort(response.json(), signal);
        const settings = buildLive2dModelSettings(payload, descriptor);
        onProgress(0.3);

        throwIfAborted(signal);
        application = pixi.createApplication(host);
        modelPromise = cubism4.loadModel(settings, { ticker: application.ticker });
        model = await waitForAbort(modelPromise, signal);
        throwIfAborted(signal);

        model.internalModel.extendParallelMotionManager(PARALLEL_MANAGER_COUNT);
        getParallelMotionManager(model, BODY_MANAGER_INDEX, "body");
        getParallelMotionManager(model, FACE_MANAGER_INDEX, "face");
        const hostSize = getHostSize(host);
        if (hostSize) viewport = fitModelToStage(model, hostSize.width, hostSize.height);
        application.addModel(model);
        modelAdded = true;
        const breath = model.internalModel.breath;
        const idleBreathParameters = breath?.getParameters();
        onProgress(1);

        const loadedModel = model;
        const loadedApplication = application;
        let resourceDestroyed = false;

        return {
          playMotion: async (id: string): Promise<void> => {
            const index = findMotionIndex(descriptor.motions, id, "motion");
            // mulmotion 0.5.1 exposes no stable loop or speed controls on startMotion.
            // Keep the existing seam, but do not pretend these options are applied.
            const started = await getParallelMotionManager(
              loadedModel,
              BODY_MANAGER_INDEX,
              "body"
            ).startMotion(MOTION_GROUP, index, cubism4.forcePriority);
            if (!started) throw new Error(`Live2D motion could not start: ${id}`);
          },
          playExpression: async (id: string): Promise<void> => {
            const index = findMotionIndex(descriptor.expressions, id, "expression");
            const started = await getParallelMotionManager(
              loadedModel,
              FACE_MANAGER_INDEX,
              "face"
            ).startMotion(EXPRESSION_GROUP, index, cubism4.forcePriority);
            if (!started) throw new Error(`Live2D expression could not start: ${id}`);
          },
          setIdle: (enabled: boolean): void => {
            // Cubism 4's breath controller is the adapter's idle behavior; a
            // runtime without one keeps its existing behavior unchanged.
            if (!breath || idleBreathParameters === undefined) return;
            breath.setParameters(enabled ? idleBreathParameters : []);
          },
          pause: (): void => {
            loadedApplication.pause();
          },
          resume: (): void => {
            loadedApplication.resume();
          },
          reset: (): void => {
            stopAllMotionManagers(loadedModel);
            resetViewport(loadedModel, viewport);
          },
          pan: (deltaX: number, deltaY: number): void => {
            if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
              throw new Error("Live2D pan deltas must be finite");
            }
            if (!viewport) throw new Error("Live2D model stage has not been sized");

            const bounds = getViewportPanBounds(loadedModel, viewport);
            viewport.offsetX = clampViewportOffset(viewport.offsetX + deltaX, bounds.maxOffsetX);
            viewport.offsetY = clampViewportOffset(viewport.offsetY + deltaY, bounds.maxOffsetY);
            applyModelTransform(loadedModel, viewport);
          },
          zoom: (factor: number, focalX: number, focalY: number): void => {
            if (
              !Number.isFinite(factor) ||
              factor <= 0 ||
              !Number.isFinite(focalX) ||
              !Number.isFinite(focalY)
            ) {
              throw new Error("Live2D zoom values must be positive and finite");
            }
            if (!viewport) throw new Error("Live2D model stage has not been sized");

            const currentZoom = viewport.zoomFactor;
            const nextZoom = Math.min(
              MAX_MODEL_ZOOM,
              Math.max(MIN_MODEL_ZOOM, currentZoom * factor)
            );
            if (nextZoom === currentZoom) return;

            const scaleRatio = nextZoom / currentZoom;
            const currentPositionX = viewport.width / 2 + viewport.offsetX;
            const currentPositionY = viewport.height / 2 + viewport.offsetY;
            const nextPositionX = focalX + (currentPositionX - focalX) * scaleRatio;
            const nextPositionY = focalY + (currentPositionY - focalY) * scaleRatio;
            viewport.zoomFactor = nextZoom;
            const bounds = getViewportPanBounds(loadedModel, viewport);
            viewport.offsetX = clampViewportOffset(
              nextPositionX - viewport.width / 2,
              bounds.maxOffsetX
            );
            viewport.offsetY = clampViewportOffset(
              nextPositionY - viewport.height / 2,
              bounds.maxOffsetY
            );
            applyModelTransform(loadedModel, viewport);
          },
          resize: (width: number, height: number): void => {
            if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
              throw new Error("Live2D resize dimensions must be positive and finite");
            }
            viewport = fitModelToStage(loadedModel, width, height, viewport);
            loadedApplication.resize(width, height);
          },
          destroy: (): void => {
            if (resourceDestroyed) return;
            resourceDestroyed = true;

            let firstError: unknown;
            if (modelAdded) {
              try {
                loadedApplication.removeModel(loadedModel);
              } catch (error) {
                firstError = error;
              }
              modelAdded = false;
            }
            try {
              loadedModel.destroy(DESTROY_OPTIONS);
            } catch (error) {
              firstError ??= error;
            }
            try {
              loadedApplication.destroy();
            } catch (error) {
              firstError ??= error;
            }
            if (firstError) throw firstError;
          }
        };
      } catch (error) {
        if (modelPromise && !model) {
          void modelPromise.then(
            (lateModel) => safeDestroyModel(lateModel),
            () => undefined
          );
        }
        cleanup();
        throw error;
      }
    }
  };
};
