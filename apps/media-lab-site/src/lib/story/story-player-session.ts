import type { IScenarioData } from "./scenario-types";
import type { ILive2DControllerData, ILive2DLoadProgressHandler } from "./player/player-types";
import { Live2DAssetType } from "./player/player-types";
import { Live2DController } from "./player/Live2DController";
import {
  discardMotion,
  getLive2DControllerData,
  getLive2DModelData,
  preloadModelMotion,
  preloadModels
} from "./player/load";
import { createStoryModelSource } from "./story-model-source";
import { collectStoryMediaUrls } from "./story-media";
import type { StoryVoiceCharacter } from "./scenario-rows";

/**
 * Browser-only story player session: loads scenario media and models, owns
 * the Pixi application and the ported Live2D controller, and exposes a small
 * imperative command surface for the Svelte host (play/abort/settings/
 * destroy). Deliberately framework-neutral per the extraction roadmap.
 */

export type StoryPlayerSessionState =
  "loading" | "ready" | "playing" | "finished" | "error" | "destroyed";

export interface StoryPlayerSettings {
  voiceVolume: number;
  bgmVolume: number;
  seVolume: number;
  autoplay: boolean;
  textAnimation: boolean;
}

export interface StoryPlayerSessionCallbacks {
  onProgress: ILive2DLoadProgressHandler;
  onWarning: (reason: string) => void;
  onStateChange: (state: StoryPlayerSessionState) => void;
  /** SimpleSelectable choices parked playback; null once cleared. */
  onSelectable: (choices: string[] | null) => void;
}

export interface StoryPlayerSessionOptions {
  host: HTMLElement;
  stageSize: [number, number];
  /** Processed scenario data (First* synthesis already applied). */
  scenarioData: IScenarioData;
  isCardStory: boolean;
  isActionSet: boolean;
  regionBucket: string;
  regionBase: string;
  regionUrl: (path: string) => string;
  live2dUrl: (path: string) => string;
  voiceCharacters: Map<number, StoryVoiceCharacter>;
  settings: StoryPlayerSettings;
  callbacks: StoryPlayerSessionCallbacks;
}

export interface StoryPlayerSession {
  readonly state: StoryPlayerSessionState;
  /** Advances playback to the next checkpoint. */
  nextStep(): Promise<void>;
  /** Whether there is a previous checkpoint to go back to. */
  readonly canGoBack: boolean;
  /** Silently rewinds to the checkpoint before the current one. */
  prevStep(): Promise<void>;
  /** Skips the currently running animations and sounds. */
  abort(): void;
  setAutoplay(enabled: boolean): void;
  setVolume(
    volume: Partial<Pick<StoryPlayerSettings, "voiceVolume" | "bgmVolume" | "seVolume">>
  ): void;
  setTextAnimation(enabled: boolean): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

const AUTOPLAY_DELAY_MS = 1500;

interface PixiApplication {
  view: unknown;
  stage: unknown;
  renderer: { resize(width: number, height: number): void };
  destroy(
    removeView: boolean,
    options: { children: boolean; texture: boolean; baseTexture: boolean }
  ): void;
}

export const createStoryPlayerSession = async (
  options: StoryPlayerSessionOptions
): Promise<StoryPlayerSession> => {
  const { host, stageSize, scenarioData, settings, callbacks } = options;

  let state: StoryPlayerSessionState = "loading";
  let busy = false;
  let autoplayTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let autoplay = settings.autoplay;
  /** Parked checkpoint indices; [0] is the pre-first-line position. */
  const checkpointHistory: number[] = [0];

  const setState = (next: StoryPlayerSessionState): void => {
    if (destroyed && next !== "destroyed") return;
    state = next;
    callbacks.onStateChange(next);
  };
  setState("loading");

  let controller: Live2DController | null = null;
  let app: PixiApplication | null = null;
  let canvas: HTMLCanvasElement | null;

  const destroySession = (): void => {
    if (destroyed) return;
    destroyed = true;
    if (autoplayTimer !== null) {
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
    try {
      controller?.destroy();
    } catch {
      // keep teardown going
    }
    controller = null;
    try {
      app?.destroy(true, { children: true, texture: true, baseTexture: true });
    } catch {
      // keep teardown going
    }
    app = null;
    canvas = null;
    setState("destroyed");
  };

  try {
    // 1. model data + media URL collection in parallel
    const modelSource = createStoryModelSource({ live2dUrl: options.live2dUrl });
    const mediaUrlsPromise = collectStoryMediaUrls({
      scenarioData,
      isCardStory: options.isCardStory,
      isActionSet: options.isActionSet,
      regionBucket: options.regionBucket,
      regionBase: options.regionBase,
      regionUrl: options.regionUrl,
      voiceCharacters: options.voiceCharacters,
      onWarning: callbacks.onWarning
    });
    const modelDataPromise = getLive2DModelData(
      scenarioData,
      modelSource,
      callbacks.onProgress,
      callbacks.onWarning
    );

    const [mediaUrls, modelData] = await Promise.all([mediaUrlsPromise, modelDataPromise]);
    discardMotion(scenarioData, modelData);

    const controllerData: ILive2DControllerData = await getLive2DControllerData(
      scenarioData,
      mediaUrls,
      Promise.resolve(modelData),
      callbacks.onProgress,
      callbacks.onWarning,
      { regionAssetUrl: options.regionUrl }
    );
    await preloadModels(controllerData, callbacks.onProgress, callbacks.onWarning);
    await preloadModelMotion(modelData, callbacks.onProgress, callbacks.onWarning);

    if (destroyed) return { ...createDestroyedSessionStub() };

    // 2. Pixi application + controller
    const pixi = await import("pixi.js");
    pixi.extensions.add(pixi.TickerPlugin);
    const created = new pixi.Application({
      width: stageSize[0],
      height: stageSize[1],
      antialias: true,
      autoDensity: true,
      backgroundColor: 0x000000,
      backgroundAlpha: 1,
      resolution:
        typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1,
      sharedTicker: false,
      autoStart: true
    });
    app = created as unknown as PixiApplication;
    canvas = created.view as unknown as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    host.appendChild(canvas);

    controller = new Live2DController(created, stageSize, controllerData);
    controller.events.on("warn", callbacks.onWarning);
    controller.events.on("selectable", (choices) => {
      if (!destroyed) callbacks.onSelectable(choices);
    });
    controller.set_volume({
      voice_volume: settings.voiceVolume,
      bgm_volume: settings.bgmVolume,
      se_volume: settings.seVolume
    });
    controller.settings.text_animation = settings.textAnimation;
    await controller.live2d_load_model(0, callbacks.onProgress);

    setState("ready");
  } catch (error) {
    destroySession();
    setState("error");
    throw error;
  }

  function createDestroyedSessionStub(): StoryPlayerSession {
    return {
      get state(): StoryPlayerSessionState {
        return "destroyed";
      },
      nextStep: async () => undefined,
      get canGoBack(): boolean {
        return false;
      },
      prevStep: async () => undefined,
      abort: () => undefined,
      setAutoplay: () => undefined,
      setVolume: () => undefined,
      setTextAnimation: () => undefined,
      resize: () => undefined,
      destroy: () => undefined
    };
  }

  const scheduleAutoplay = (): void => {
    if (!autoplay || destroyed || state === "finished") return;
    // A parked SimpleSelectable waits for the viewer's pick.
    if (controller?.pending_selectable) return;
    if (autoplayTimer !== null) clearTimeout(autoplayTimer);
    autoplayTimer = setTimeout(() => {
      autoplayTimer = null;
      void session.nextStep();
    }, AUTOPLAY_DELAY_MS);
  };

  const session: StoryPlayerSession = {
    get state(): StoryPlayerSessionState {
      return state;
    },
    nextStep: async (): Promise<void> => {
      if (destroyed || busy || !controller) return;
      if (state === "finished") return;
      busy = true;
      if (autoplayTimer !== null) {
        clearTimeout(autoplayTimer);
        autoplayTimer = null;
      }
      setState("playing");
      try {
        const next = await controller.step_until_checkpoint(controller.step);
        if (destroyed) return;
        if (next === -1) {
          setState("finished");
          return;
        }
        controller.step = next;
        checkpointHistory.push(next);
        setState("ready");
        scheduleAutoplay();
      } finally {
        busy = false;
      }
    },
    get canGoBack(): boolean {
      // history[0] is the pre-first-line position, which cannot be restored.
      return checkpointHistory.length >= 3;
    },
    prevStep: async (): Promise<void> => {
      if (destroyed || busy || !controller) return;
      if (!session.canGoBack) return;
      busy = true;
      if (autoplayTimer !== null) {
        clearTimeout(autoplayTimer);
        autoplayTimer = null;
      }
      setState("playing");
      try {
        // prevStep only runs past canGoBack (history >= 3), so -2 exists.
        const target = checkpointHistory.at(-2)!;
        // Stop the current line's playback, then silently replay from the
        // start so every visual layer converges on the earlier checkpoint.
        controller.stop_sounds([Live2DAssetType.Talk]);
        controller.animate.abort();
        let index = 0;
        while (index !== -1 && index !== target) {
          index = await controller.step_until_checkpoint(index, {
            silent: true
          });
        }
        if (destroyed) return;
        controller.step = target;
        checkpointHistory.pop();
        // Landing back on a SimpleSelectable re-parks here; the silent
        // replay suppressed the SE's own event, so re-expose the choices.
        const parked = controller.pending_selectable;
        if (parked) controller.events.emit("selectable", parked);
        setState("ready");
        scheduleAutoplay();
      } finally {
        busy = false;
      }
    },
    abort: (): void => {
      if (destroyed || !controller) return;
      controller.animate.abort();
      if (autoplayTimer !== null) {
        clearTimeout(autoplayTimer);
        autoplayTimer = null;
      }
    },
    setAutoplay: (enabled: boolean): void => {
      autoplay = enabled;
      if (!enabled && autoplayTimer !== null) {
        clearTimeout(autoplayTimer);
        autoplayTimer = null;
      } else if (enabled && state === "ready") {
        scheduleAutoplay();
      }
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
      if (destroyed || !controller || !app) return;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return;
      }
      app.renderer.resize(width, height);
      controller.set_stage_size([width, height]);
    },
    destroy: destroySession
  };

  return session;
};
