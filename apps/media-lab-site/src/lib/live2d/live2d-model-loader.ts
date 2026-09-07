import type { Ticker } from "pixi.js";
import type { Live2dModelDescriptor, Live2dModelLoader, Live2dModelResource } from "./model-viewer";

type JsonObject = Record<string, unknown>;

const MOTION_GROUP = "Motion";
const EXPRESSION_GROUP = "Expression";
const PARALLEL_MANAGER_COUNT = 2;
const BODY_MANAGER_INDEX = 0;
const FACE_MANAGER_INDEX = 1;
const CUBISM_CORE_SCRIPT_URL = "/live2d/cubism-core/live2dcubismcore.min.js";

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

const toMotionDefinitions = (options: readonly { url: string }[]): JsonObject[] =>
  options.map((option) => ({ File: option.url }));

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

  cloned.url = descriptor.modelUrl;
  fileReferences.Expressions = [];
  fileReferences.Motions = {
    [MOTION_GROUP]: toMotionDefinitions(descriptor.motions),
    [EXPRESSION_GROUP]: toMotionDefinitions(descriptor.expressions)
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

const createDefaultRuntimeFacade = (): Live2dRuntimeFacade => ({
  loadPixi: async () => {
    const pixi = await import("pixi.js");

    return {
      createApplication: (host) => {
        pixi.extensions.add(pixi.TickerPlugin);
        const app = new pixi.Application({
          antialias: true,
          backgroundAlpha: 0,
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
            app.render();
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

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

const fitModelToStage = (model: Live2dModelInstance, width: number, height: number): void => {
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

  // Live2DModel exposes a Sprite-like anchor. Using its center makes the
  // position the stage center regardless of the model's native dimensions.
  model.anchor.set(0.5, 0.5);
  model.scale.set(scale, scale);
  model.position.set(width / 2, height / 2);
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
        const [pixi, cubism4] = await waitForAbort(
          Promise.all([runtime.loadPixi(), runtime.loadCubism4()]),
          signal
        );
        onProgress(0.15);

        const response = await waitForAbort(
          runtime.fetchSettings(descriptor.modelUrl, signal),
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
        if (hostSize) fitModelToStage(model, hostSize.width, hostSize.height);
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
          reset: (): void => {
            stopAllMotionManagers(loadedModel);
          },
          resize: (width: number, height: number): void => {
            if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
              throw new Error("Live2D resize dimensions must be positive and finite");
            }
            fitModelToStage(loadedModel, width, height);
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
