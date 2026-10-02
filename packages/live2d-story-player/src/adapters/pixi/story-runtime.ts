import type { Application as PixiApplication } from "pixi.js";

import { Live2DController } from "./Live2DController.js";
import type { ILive2DControllerData, ILive2DLoadProgressHandler } from "./player-types.js";
import { Live2DAssetType } from "./player-types.js";
import type {
  ILive2DAbortableStoryModelSource,
  ILive2DLoadedControllerData,
  Live2DLoadOptions
} from "./adapter-types.js";
import {
  discardMotion,
  getLive2DControllerData,
  getLive2DModelData,
  preloadModelMotion,
  preloadModels
} from "./load.js";
import type { ILive2DAssetUrl, ILive2DLoadWarningHandler } from "../../model/live2d-assets.js";
import type { ILive2DTextResolver } from "../../model/live2d-model.js";
import type { IScenarioData } from "../../model/scenario-types.js";
import type { StoryPlayerRuntime } from "../../core/story-player.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";
import type { ILive2DTextResolvedEvent } from "../../model/live2d-model.js";
import type { StoryPlayerLogger } from "../../core/log.js";

interface PixiApplicationLike {
  view: HTMLCanvasElement;
  renderer: { resize(width: number, height: number): void };
  destroy(
    removeView: boolean,
    options: { children: boolean; texture: boolean; baseTexture: boolean }
  ): void;
}

/** Minimal controller surface used by this runtime and injectable in tests. */
export interface PixiStoryRuntimeController {
  step: number;
  readonly pending_selectable: string[] | null;
  readonly events: Live2DController["events"];
  readonly animate: Pick<Live2DController["animate"], "abort">;
  readonly settings: Pick<Live2DController["settings"], "text_animation">;
  readonly live2d_load_model: Live2DController["live2d_load_model"];
  readonly step_until_checkpoint: Live2DController["step_until_checkpoint"];
  readonly stop_sounds: Live2DController["stop_sounds"];
  readonly set_volume: Live2DController["set_volume"];
  readonly set_stage_size: Live2DController["set_stage_size"];
  readonly destroy: Live2DController["destroy"];
}

export interface PixiStoryRuntimeSettings {
  voiceVolume: number;
  bgmVolume: number;
  seVolume: number;
  textAnimation: boolean;
  /** Autoplay scheduling belongs to createStoryPlayer; this value is accepted for host parity. */
  autoplay?: boolean;
}

export interface PixiStoryRuntimeCallbacks {
  onProgress?: ILive2DLoadProgressHandler;
  onWarning?: ILive2DLoadWarningHandler;
  onSelectable?: (choices: string[]) => void;
  onTextResolved?: (event: ILive2DTextResolvedEvent) => void;
}

export interface PixiStoryRuntimeOptions {
  host: HTMLElement;
  stageSize: [number, number];
  scenarioData: IScenarioData;
  /** Scenario media descriptors whose URLs have already been resolved by the host. */
  mediaAssets: ILive2DAssetUrl[];
  /** Player UI descriptors whose URLs have already been resolved by the host. */
  uiAssets: ILive2DAssetUrl[];
  modelSource: ILive2DAbortableStoryModelSource;
  /** Optional replacement for Howler playback and lip-sync audio graph operations. */
  audioAdapter?: PixiStoryAudioAdapter;
  /** Optional logger scoped to this player instance. */
  logger?: StoryPlayerLogger;
  textResolver?: ILive2DTextResolver;
  settings: PixiStoryRuntimeSettings;
  callbacks?: PixiStoryRuntimeCallbacks;
  /** Injected media, request, fetch, and logging capabilities for the loader. */
  loadOptions?: Omit<Live2DLoadOptions, "signal">;
  createApplication?: (
    stageSize: [number, number],
    signal: AbortSignal
  ) => PixiApplicationLike | Promise<PixiApplicationLike>;
  createController?: (
    application: PixiApplicationLike,
    stageSize: [number, number],
    data: ILive2DLoadedControllerData,
    signal: AbortSignal
  ) => PixiStoryRuntimeController | Promise<PixiStoryRuntimeController>;
}

const noopProgress: ILive2DLoadProgressHandler = () => undefined;
const noopWarning: ILive2DLoadWarningHandler = () => undefined;

const getAbortReason = (signal: AbortSignal): unknown => {
  if (signal.reason !== undefined) return signal.reason;
  const error = new Error("The Pixi story runtime was aborted");
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw getAbortReason(signal);
};

const awaitWithSignal = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) {
    void promise.catch(() => undefined);
    return Promise.reject(getAbortReason(signal));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => signal.removeEventListener("abort", onAbort);
    const finish = (
      result: { kind: "resolve"; value: T } | { kind: "reject"; error: unknown }
    ): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result.kind === "resolve") resolve(result.value);
      else reject(result.error);
    };
    const onAbort = (): void => finish({ kind: "reject", error: getAbortReason(signal) });

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => finish({ kind: "resolve", value }),
      (error: unknown) => finish({ kind: "reject", error })
    );
    if (signal.aborted) onAbort();
  });
};

const createPixiApplication = async (
  [width, height]: [number, number],
  signal: AbortSignal
): Promise<PixiApplicationLike> => {
  throwIfAborted(signal);
  const pixi = await import("pixi.js");
  throwIfAborted(signal);
  pixi.extensions.add(pixi.TickerPlugin);
  const application = new pixi.Application({
    width,
    height,
    antialias: true,
    autoDensity: true,
    backgroundColor: 0x000000,
    backgroundAlpha: 1,
    resolution:
      typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1,
    sharedTicker: false,
    autoStart: true
  });
  return application as unknown as PixiApplicationLike;
};

const createPixiController = async (
  application: PixiApplicationLike,
  stageSize: [number, number],
  data: ILive2DControllerData
): Promise<PixiStoryRuntimeController> => {
  return new Live2DController(application as unknown as PixiApplication, stageSize, data);
};

/**
 * Initializes the Pixi renderer and controller, then exposes the shared
 * StoryPlayerRuntime commands. Asset URL policy and browser capabilities stay
 * with the host.
 */
export const createPixiStoryRuntime = async (
  options: PixiStoryRuntimeOptions,
  signal: AbortSignal
): Promise<StoryPlayerRuntime> => {
  throwIfAborted(signal);

  const onProgress = options.callbacks?.onProgress ?? noopProgress;
  const onWarning = options.callbacks?.onWarning ?? noopWarning;
  const onSelectable = options.callbacks?.onSelectable;
  const onTextResolved = options.callbacks?.onTextResolved;
  const audioAdapter = options.audioAdapter ?? options.loadOptions?.audioAdapter;
  const logger = options.logger ?? options.loadOptions?.logger;
  const loadOptions: Live2DLoadOptions = {
    ...options.loadOptions,
    ...(audioAdapter ? { audioAdapter } : {}),
    ...(logger ? { logger } : {}),
    signal
  };

  let destroyed = false;
  let cleanupPromise: Promise<void> | null = null;
  let application: PixiApplicationLike | null = null;
  let controller: PixiStoryRuntimeController | null = null;
  let canvasAttached = false;
  let pendingApplication: Promise<PixiApplicationLike> | null = null;
  let pendingController: Promise<PixiStoryRuntimeController> | null = null;
  let pendingModelCreation: Promise<void> | null = null;
  let busy = false;
  const checkpointHistory = [0];

  const warnListener = (reason: string): void => onWarning(reason);
  const selectableListener = (choices: string[]): void => onSelectable?.(choices);
  const textResolvedListener = (event: ILive2DTextResolvedEvent): void => onTextResolved?.(event);

  let disposeScenarioResource = (): void => undefined;
  let signalListenerAttached = false;

  const cleanup = (): Promise<void> => {
    if (cleanupPromise) return cleanupPromise;
    destroyed = true;
    try {
      controller?.animate.abort();
    } catch {
      // Continue teardown when animation cancellation fails.
    }

    cleanupPromise = (async () => {
      if (pendingModelCreation) await pendingModelCreation.catch(() => undefined);
      if (pendingController) {
        try {
          controller ??= await pendingController;
        } catch {
          // A rejected controller factory has no controller to release.
        }
      }
      if (pendingApplication) {
        try {
          application ??= await pendingApplication;
        } catch {
          // A rejected application factory has no renderer to release.
        }
      }

      if (signalListenerAttached) {
        signal.removeEventListener("abort", onSignalAbort);
        signalListenerAttached = false;
      }
      controller?.events.off("warn", warnListener);
      controller?.events.off("selectable", selectableListener);
      controller?.events.off("textResolved", textResolvedListener);
      try {
        controller?.destroy();
      } catch {
        // Resource disposal and renderer destruction still need to run.
      }
      try {
        disposeScenarioResource();
      } catch {
        // Continue teardown if a host-provided disposer throws.
      }
      controller = null;

      try {
        application?.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch {
        // Remove the canvas separately if renderer destruction fails.
      }
      if (canvasAttached && application) {
        try {
          options.host.removeChild(application.view);
        } catch {
          // Pixi may already have removed the view.
        }
      }
      application = null;
      canvasAttached = false;
    })();
    return cleanupPromise;
  };

  function onSignalAbort(): void {
    void cleanup();
  }

  signal.addEventListener("abort", onSignalAbort, { once: true });
  signalListenerAttached = true;

  try {
    throwIfAborted(signal);
    const modelData = await awaitWithSignal(
      getLive2DModelData(
        options.scenarioData,
        options.modelSource,
        onProgress,
        onWarning,
        loadOptions
      ),
      signal
    );
    throwIfAborted(signal);
    discardMotion(options.scenarioData, modelData);

    const loadedData = await awaitWithSignal(
      getLive2DControllerData(
        options.scenarioData,
        [...options.mediaAssets],
        Promise.resolve(modelData),
        onProgress,
        onWarning,
        [...options.uiAssets],
        loadOptions
      ),
      signal
    );
    const resource = loadedData.scenarioResource;
    if (audioAdapter) loadedData.audioAdapter = audioAdapter;
    if (logger) loadedData.logger = logger;
    const originalDispose = resource.dispose;
    let resourceDisposed = false;
    disposeScenarioResource = (): void => {
      if (resourceDisposed) return;
      resourceDisposed = true;
      originalDispose();
    };
    resource.dispose = disposeScenarioResource;
    throwIfAborted(signal);

    await preloadModels(loadedData, onProgress, onWarning, loadOptions);
    throwIfAborted(signal);
    await preloadModelMotion(modelData, onProgress, onWarning, loadOptions);
    throwIfAborted(signal);

    pendingApplication = Promise.resolve().then(() =>
      (options.createApplication ?? createPixiApplication)(options.stageSize, signal)
    );
    pendingApplication = pendingApplication.then((created) => {
      application = created;
      return created;
    });
    const activeApplication = await awaitWithSignal(pendingApplication, signal);
    pendingApplication = null;
    throwIfAborted(signal);

    const canvas = activeApplication.view;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    options.host.appendChild(canvas);
    canvasAttached = true;
    throwIfAborted(signal);

    loadedData.textResolver = options.textResolver;
    pendingController = Promise.resolve().then(() =>
      (options.createController ?? createPixiController)(
        activeApplication,
        options.stageSize,
        loadedData,
        signal
      )
    );
    pendingController = pendingController.then((created) => {
      controller = created;
      return created;
    });
    const activeController = await awaitWithSignal(pendingController, signal);
    pendingController = null;
    throwIfAborted(signal);

    activeController.events.on("warn", warnListener);
    activeController.events.on("selectable", selectableListener);
    activeController.events.on("textResolved", textResolvedListener);
    activeController.set_volume({
      voice_volume: options.settings.voiceVolume,
      bgm_volume: options.settings.bgmVolume,
      se_volume: options.settings.seVolume
    });
    activeController.settings.text_animation = options.settings.textAnimation;

    pendingModelCreation = Promise.resolve().then(() =>
      activeController.live2d_load_model(0, onProgress)
    );
    await awaitWithSignal(pendingModelCreation, signal);
    pendingModelCreation = null;
    throwIfAborted(signal);

    signal.removeEventListener("abort", onSignalAbort);
    signalListenerAttached = false;

    const runtime: StoryPlayerRuntime = {
      nextStep: async (): Promise<"ready" | "finished"> => {
        if (destroyed || busy || !controller) return "ready";
        busy = true;
        try {
          const next = await controller.step_until_checkpoint(controller.step);
          if (destroyed) return "ready";
          if (next === -1) return "finished";
          controller.step = next;
          checkpointHistory.push(next);
          return "ready";
        } finally {
          busy = false;
        }
      },
      get canGoBack(): boolean {
        return checkpointHistory.length >= 3;
      },
      get canAutoplay(): boolean {
        return !destroyed && controller?.pending_selectable === null;
      },
      prevStep: async (): Promise<"ready"> => {
        if (destroyed || busy || !controller || checkpointHistory.length < 3) return "ready";
        busy = true;
        try {
          const target = checkpointHistory.at(-2);
          if (target === undefined) return "ready";
          controller.stop_sounds([Live2DAssetType.Talk]);
          controller.animate.abort();
          let index = 0;
          while (index !== -1 && index !== target) {
            index = await controller.step_until_checkpoint(index, { silent: true });
            if (destroyed) return "ready";
          }
          controller.step = target;
          checkpointHistory.pop();
          const parked = controller.pending_selectable;
          if (parked) controller.events.emit("selectable", parked);
          return "ready";
        } finally {
          busy = false;
        }
      },
      abort: (): void => {
        if (destroyed) return;
        controller?.animate.abort();
      },
      setVolume: (volume): void => {
        controller?.set_volume({
          voice_volume: volume.voiceVolume,
          bgm_volume: volume.bgmVolume,
          se_volume: volume.seVolume
        });
      },
      setTextAnimation: (enabled: boolean): void => {
        if (controller) controller.settings.text_animation = enabled;
      },
      resize: (width: number, height: number): void => {
        if (
          destroyed ||
          !controller ||
          !application ||
          !Number.isFinite(width) ||
          !Number.isFinite(height) ||
          width <= 0 ||
          height <= 0
        ) {
          return;
        }
        application.renderer.resize(width, height);
        controller.set_stage_size([width, height]);
      },
      destroy: (): void => {
        void cleanup();
      }
    };
    return runtime;
  } catch (error) {
    void cleanup();
    throw error;
  }
};
