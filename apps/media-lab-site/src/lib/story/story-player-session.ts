import {
  createStoryPlayer,
  Live2DAssetType,
  type ILive2DAssetUrl,
  type StoryPlayerSnapshot,
  type StoryPlayerState
} from "@platform/live2d-story-player";
import type { ILive2DLoadProgressHandler } from "@platform/live2d-story-player/pixi";
import type { StoryDocument, MediaAssetKind } from "$lib/live2d/story-document";
import { createStoryModelSource } from "./story-model-source";
import { createStoryAssetResolver } from "./story-urls";
import { getUIMediaUrls } from "./player/ui_assets";

/**
 * Browser-only composition layer between the app's asset policies and the
 * framework-neutral player lifecycle.
 */

export type StoryPlayerSessionState =
  "loading" | "ready" | "playing" | "finished" | "error" | "destroyed";

export type StoryPlayerSessionSnapshot = Omit<StoryPlayerSnapshot, "state"> & {
  state: StoryPlayerSessionState;
};

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
  onStateChange?: (state: StoryPlayerSessionState) => void;
  /** SimpleSelectable choices parked playback; null once cleared by the host. */
  onSelectable: (choices: string[]) => void;
}

export interface StoryPlayerSessionOptions {
  host: HTMLElement;
  stageSize: [number, number];
  storyDocument: StoryDocument;
  settings: StoryPlayerSettings;
  callbacks: StoryPlayerSessionCallbacks;
}

export interface StoryPlayerSession {
  readonly state: StoryPlayerSessionState;
  readonly error: Error | null;
  subscribe(listener: (snapshot: StoryPlayerSessionSnapshot) => void): () => void;
  /** Loads the session once; concurrent calls share the same promise. */
  load(): Promise<void>;
  /** Starts a new load generation after a failed load. */
  retry(): Promise<void>;
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

const toSessionState = (state: StoryPlayerState): StoryPlayerSessionState =>
  state === "idle" ? "loading" : state;

const toError = (reason: unknown, message: string): Error => {
  if (reason instanceof Error) return reason;

  let errorMessage = message;
  if (typeof reason === "string") errorMessage = reason;

  return new Error(errorMessage, { cause: reason });
};

const defaultAbortError = (): Error => {
  const error = new Error("Story player load was aborted");
  error.name = "AbortError";
  return error;
};

const getAbortError = (signal: AbortSignal): Error => {
  if (signal.reason === undefined) return defaultAbortError();
  const error = toError(signal.reason, "Story player load was aborted");
  if (signal.reason instanceof Error) return error;
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw getAbortError(signal);
};

const PLAYER_ASSET_TYPES: Record<MediaAssetKind, ILive2DAssetUrl["type"]> = {
  background: Live2DAssetType.BackgroundImage,
  bgm: Live2DAssetType.BackgroundMusic,
  se: Live2DAssetType.SoundEffect,
  voice: Live2DAssetType.Talk,
  movie: Live2DAssetType.Video
};

const waitForSignal = <T>(
  operation: Promise<T> | (() => Promise<T>),
  signal: AbortSignal
): Promise<T> => {
  if (signal.aborted) {
    if (typeof operation !== "function") void operation.catch(() => undefined);
    return Promise.reject(getAbortError(signal));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => signal.removeEventListener("abort", onAbort);
    const settle = (result: { value: T } | { error: unknown }): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if ("error" in result) reject(toError(result.error, "Story player operation failed"));
      else resolve(result.value);
    };
    const onAbort = (): void => settle({ error: getAbortError(signal) });

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();

    if (!settled) {
      const runOperation = async (): Promise<void> => {
        try {
          const value = await (typeof operation === "function" ? operation() : operation);
          settle({ value });
        } catch (error) {
          settle({ error });
        }
      };
      void runOperation();
    } else if (typeof operation !== "function") {
      void operation.catch(() => undefined);
    }
  });
};

/**
 * Creates a synchronous command handle. Pixi is imported only after Cubism is
 * ready, inside the cancellable initialization attempt.
 */
export const createStoryPlayerSession = (
  options: StoryPlayerSessionOptions
): StoryPlayerSession => {
  const player = createStoryPlayer({
    autoplay: options.settings.autoplay,
    onStateChange: ({ state }) => options.callbacks.onStateChange?.(toSessionState(state)),
    initialize: async (signal) => {
      throwIfAborted(signal);
      const { ensureCubismCore } = await waitForSignal(
        () => import("$lib/live2d/cubism-core"),
        signal
      );
      throwIfAborted(signal);
      await waitForSignal(() => ensureCubismCore(), signal);
      throwIfAborted(signal);

      const { createPixiStoryRuntime } = await waitForSignal(
        () => import("@platform/live2d-story-player/pixi"),
        signal
      );
      throwIfAborted(signal);

      const storyDocument = options.storyDocument;
      const assetUrls = createStoryAssetResolver(
        () => storyDocument.assetBase,
        storyDocument.identity.region
      );
      const mediaAssets: ILive2DAssetUrl[] = storyDocument.media.map((asset) => ({
        identifier: asset.identifier,
        type: PLAYER_ASSET_TYPES[asset.kind],
        url: asset.url
      }));
      const modelSource = createStoryModelSource({
        live2dUrl: assetUrls.model,
        signal
      });
      const uiAssets = getUIMediaUrls(storyDocument.scenarioData, assetUrls.image);
      throwIfAborted(signal);

      return createPixiStoryRuntime(
        {
          host: options.host,
          stageSize: options.stageSize,
          scenarioData: storyDocument.scenarioData,
          mediaAssets,
          uiAssets,
          modelSource,
          settings: options.settings,
          callbacks: {
            onProgress: (type, count, total, info) => {
              if (!signal.aborted) options.callbacks.onProgress(type, count, total, info);
            },
            onWarning: (reason) => {
              if (!signal.aborted) options.callbacks.onWarning(reason);
            },
            onSelectable: (choices) => {
              if (!signal.aborted) options.callbacks.onSelectable(choices);
            }
          }
        },
        signal
      );
    }
  });

  return {
    get state(): StoryPlayerSessionState {
      return toSessionState(player.state);
    },
    get error(): Error | null {
      return player.error;
    },
    subscribe: (listener): (() => void) =>
      player.subscribe((snapshot) =>
        listener({ ...snapshot, state: toSessionState(snapshot.state) })
      ),
    load: (): Promise<void> => player.load(),
    retry: (): Promise<void> => player.retry(),
    nextStep: (): Promise<void> => player.nextStep(),
    get canGoBack(): boolean {
      return player.canGoBack;
    },
    prevStep: (): Promise<void> => player.prevStep(),
    abort: (): void => player.abort(),
    setAutoplay: (enabled): void => player.setAutoplay(enabled),
    setVolume: (volume): void => player.setVolume(volume),
    setTextAnimation: (enabled): void => player.setTextAnimation(enabled),
    resize: (width, height): void => player.resize(width, height),
    destroy: (): void => player.destroy()
  };
};
