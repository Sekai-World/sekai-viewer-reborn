import { Howl } from "howler";
import type { Live2DMediaAdapters, Live2DResourceAdapter } from "./adapter-types.js";
import { createHowlerStoryAudioAdapter } from "./audio-adapter.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";

const toError = (reason: unknown, message: string): Error => {
  if (reason instanceof Error) return reason;

  let errorMessage = message;
  if (typeof reason === "string") errorMessage = reason;

  return new Error(errorMessage, { cause: reason });
};

const defaultAbortError = (): Error => {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
};

const abortReason = (signal: AbortSignal): Error => {
  if (signal.reason === undefined) return defaultAbortError();
  const error = toError(signal.reason, "The operation was aborted");
  if (signal.reason instanceof Error) return error;
  error.name = "AbortError";
  return error;
};

const createCompletion = (
  resolve: () => void,
  reject: (error: Error) => void,
  cleanup: () => void,
  fallbackMessage: string
): { succeed: () => void; fail: (reason: unknown) => void } => {
  let settled = false;
  const settle = (result: { success: true } | { success: false; reason: unknown }): void => {
    if (settled) return;
    settled = true;
    cleanup();
    if (result.success) resolve();
    else reject(toError(result.reason, fallbackMessage));
  };

  return {
    succeed: () => settle({ success: true }),
    fail: (reason) => settle({ success: false, reason })
  };
};

const loadImage: Live2DResourceAdapter<HTMLImageElement>["load"] = (image, url, signal) =>
  new Promise<void>((resolve, reject) => {
    const completion = createCompletion(
      resolve,
      reject,
      () => {
        image.onload = null;
        image.onerror = null;
        signal.removeEventListener("abort", onAbort);
      },
      `Failed to load image: ${url}`
    );
    const onAbort = () => completion.fail(abortReason(signal));

    if (signal.aborted) {
      onAbort();
      return;
    }

    image.onload = () => completion.succeed();
    image.onerror = () => completion.fail(new Error(`Failed to load image: ${url}`));
    signal.addEventListener("abort", onAbort, { once: true });
    image.crossOrigin = "anonymous";
    try {
      image.src = url;
    } catch (error) {
      completion.fail(error);
    }
  });

const loadVideo: Live2DResourceAdapter<HTMLVideoElement>["load"] = (video, url, signal) =>
  new Promise<void>((resolve, reject) => {
    const completion = createCompletion(
      resolve,
      reject,
      () => {
        video.onloadeddata = null;
        video.onerror = null;
        signal.removeEventListener("abort", onAbort);
      },
      `Failed to load video: ${url}`
    );
    const onAbort = () => completion.fail(abortReason(signal));

    if (signal.aborted) {
      onAbort();
      return;
    }

    video.onloadeddata = () => completion.succeed();
    video.onerror = () => completion.fail(new Error(`Failed to load video: ${url}`));
    signal.addEventListener("abort", onAbort, { once: true });
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    try {
      video.src = url;
    } catch (error) {
      completion.fail(error);
    }
  });

const loadAudio: Live2DResourceAdapter<Howl>["load"] = (sound, url, signal) =>
  new Promise<void>((resolve, reject) => {
    const completion = createCompletion(
      resolve,
      reject,
      () => {
        sound.off("load", onLoad);
        sound.off("loaderror", onLoadError);
        signal.removeEventListener("abort", onAbort);
      },
      `Failed to load sound: ${url}`
    );
    const onLoad = () => completion.succeed();
    const onLoadError = () => completion.fail(new Error(`Failed to load sound: ${url}`));
    const onAbort = () => completion.fail(abortReason(signal));

    if (signal.aborted) {
      onAbort();
      return;
    }

    sound.once("load", onLoad);
    sound.once("loaderror", onLoadError);
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      sound.load();
    } catch (error) {
      completion.fail(error);
    }
  });

const createMediaAdapters = (
  audioAdapter: PixiStoryAudioAdapter = createHowlerStoryAudioAdapter()
): Live2DMediaAdapters => ({
  image: {
    create: () => new Image(),
    load: loadImage,
    release: (image) => {
      image.onload = null;
      image.onerror = null;
      image.src = "";
      image.remove();
    }
  },
  video: {
    create: () => document.createElement("video"),
    load: loadVideo,
    release: (video) => {
      video.onloadeddata = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
    }
  },
  audio: {
    create: (url: string) => new Howl({ src: [url], preload: false, loop: false, html5: false }),
    load: loadAudio,
    release: (sound) => {
      audioAdapter.stop(sound);
      audioAdapter.unload(sound);
    }
  }
});

const browserMediaAdapters = createMediaAdapters();

export function createBrowserMediaAdapters(
  audioAdapter?: PixiStoryAudioAdapter
): Live2DMediaAdapters {
  return audioAdapter ? createMediaAdapters(audioAdapter) : browserMediaAdapters;
}
