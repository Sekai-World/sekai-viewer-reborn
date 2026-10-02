import { Howl } from "howler";
import type { Live2DMediaAdapters, Live2DResourceAdapter } from "./adapter-types.js";
import { createHowlerStoryAudioAdapter } from "./audio-adapter.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError");

const loadImage: Live2DResourceAdapter<HTMLImageElement>["load"] = (image, url, signal) =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanupListeners = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      if (error === undefined) resolve();
      else reject(error);
    };
    const onAbort = () => finish(abortReason(signal));

    if (signal.aborted) {
      onAbort();
      return;
    }

    image.onload = () => finish();
    image.onerror = () => finish(new Error(`Failed to load image: ${url}`));
    signal.addEventListener("abort", onAbort, { once: true });
    image.crossOrigin = "anonymous";
    try {
      image.src = url;
    } catch (error) {
      finish(error);
    }
  });

const loadVideo: Live2DResourceAdapter<HTMLVideoElement>["load"] = (video, url, signal) =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanupListeners = () => {
      video.onloadeddata = null;
      video.onerror = null;
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      if (error === undefined) resolve();
      else reject(error);
    };
    const onAbort = () => finish(abortReason(signal));

    if (signal.aborted) {
      onAbort();
      return;
    }

    video.onloadeddata = () => finish();
    video.onerror = () => finish(new Error(`Failed to load video: ${url}`));
    signal.addEventListener("abort", onAbort, { once: true });
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    try {
      video.src = url;
    } catch (error) {
      finish(error);
    }
  });

const loadAudio: Live2DResourceAdapter<Howl>["load"] = (sound, url, signal) =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanupListeners = () => {
      sound.off("load", onLoad);
      sound.off("loaderror", onLoadError);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      if (error === undefined) resolve();
      else reject(error);
    };
    const onLoad = () => finish();
    const onLoadError = () => finish(new Error(`Failed to load sound: ${url}`));
    const onAbort = () => finish(abortReason(signal));

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
      finish(error);
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
