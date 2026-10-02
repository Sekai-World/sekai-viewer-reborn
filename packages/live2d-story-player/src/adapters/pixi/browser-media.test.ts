import { afterEach, describe, expect, it, vi } from "vitest";

interface FakeSoundReference {
  emit(event: string): void;
  listenerCount(event: string): number;
  loadCalls: number;
  stopCalls: number;
  unloadCalls: number;
}

const soundFixtures = vi.hoisted(() => ({ sounds: [] as FakeSoundReference[] }));

vi.mock("howler", () => ({
  Howl: class {
    private readonly listeners = new Map<string, (() => void)[]>();
    loadCalls = 0;
    stopCalls = 0;
    unloadCalls = 0;

    constructor() {
      soundFixtures.sounds.push(this);
    }

    once(event: string, listener: () => void) {
      const eventListeners = this.listeners.get(event) ?? [];
      eventListeners.push(listener);
      this.listeners.set(event, eventListeners);
      return this;
    }

    off(event: string, listener?: () => void) {
      if (!listener) this.listeners.delete(event);
      else
        this.listeners.set(
          event,
          (this.listeners.get(event) ?? []).filter((item) => item !== listener)
        );
      return this;
    }

    load() {
      this.loadCalls++;
      return this;
    }

    stop() {
      this.stopCalls++;
      return this;
    }

    unload() {
      this.unloadCalls++;
      return this;
    }

    emit(event: string) {
      for (const listener of this.listeners.get(event) ?? []) listener();
      this.listeners.delete(event);
    }

    listenerCount(event: string) {
      return this.listeners.get(event)?.length ?? 0;
    }
  }
}));

import { createBrowserMediaAdapters } from "./browser-media.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = "";
  source = "";
  removeCalls = 0;

  set src(value: string) {
    this.source = value;
  }

  get src(): string {
    return this.source;
  }

  remove() {
    this.removeCalls++;
  }
}

class FakeVideo {
  onloadeddata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = "";
  preload = "";
  source = "";
  pauseCalls = 0;
  loadCalls = 0;
  removeCalls = 0;

  set src(value: string) {
    this.source = value;
  }

  get src(): string {
    return this.source;
  }

  pause() {
    this.pauseCalls++;
  }

  removeAttribute(name: string) {
    if (name === "src") this.source = "";
  }

  load() {
    this.loadCalls++;
  }

  remove() {
    this.removeCalls++;
  }
}

afterEach(() => {
  soundFixtures.sounds.length = 0;
  vi.unstubAllGlobals();
});

describe("browser media adapters", () => {
  it("clears image listeners and releases the element after a load error", async () => {
    const image = new FakeImage();
    vi.stubGlobal(
      "Image",
      class extends FakeImage {
        constructor() {
          super();
          return image;
        }
      }
    );
    const adapter = createBrowserMediaAdapters().image;
    const signal = new AbortController().signal;
    const resource = await adapter.create("https://assets.example.test/image.png", signal);
    const loading = adapter.load(resource, "https://assets.example.test/image.png", signal);
    image.onerror?.();

    await expect(loading).rejects.toThrow("Failed to load image");
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    adapter.release(resource);
    expect(image.src).toBe("");
    expect(image.removeCalls).toBe(1);
  });

  it("clears image listeners after cancellation", async () => {
    const image = new FakeImage();
    vi.stubGlobal(
      "Image",
      class extends FakeImage {
        constructor() {
          super();
          return image;
        }
      }
    );
    const adapter = createBrowserMediaAdapters().image;
    const controller = new AbortController();
    const resource = await adapter.create(
      "https://assets.example.test/image.png",
      controller.signal
    );
    const loading = adapter.load(
      resource,
      "https://assets.example.test/image.png",
      controller.signal
    );
    controller.abort();

    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    adapter.release(resource);
    expect(image.removeCalls).toBe(1);
  });

  it("clears video listeners and resets the element when loading is aborted", async () => {
    const video = new FakeVideo();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => video)
    });
    const adapter = createBrowserMediaAdapters().video;
    const controller = new AbortController();
    const resource = await adapter.create(
      "https://assets.example.test/video.mp4",
      controller.signal
    );
    const loading = adapter.load(
      resource,
      "https://assets.example.test/video.mp4",
      controller.signal
    );
    controller.abort();

    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
    expect(video.onloadeddata).toBeNull();
    expect(video.onerror).toBeNull();
    adapter.release(resource);
    expect(video.source).toBe("");
    expect(video.pauseCalls).toBe(1);
    expect(video.loadCalls).toBe(1);
    expect(video.removeCalls).toBe(1);
  });

  it("clears video listeners after a load error", async () => {
    const video = new FakeVideo();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => video)
    });
    const adapter = createBrowserMediaAdapters().video;
    const signal = new AbortController().signal;
    const resource = await adapter.create("https://assets.example.test/video.mp4", signal);
    const loading = adapter.load(resource, "https://assets.example.test/video.mp4", signal);
    video.onerror?.();

    await expect(loading).rejects.toThrow("Failed to load video");
    expect(video.onloadeddata).toBeNull();
    expect(video.onerror).toBeNull();
    adapter.release(resource);
    expect(video.pauseCalls).toBe(1);
    expect(video.removeCalls).toBe(1);
  });

  it("removes audio load listeners and unloads the sound after a load error", async () => {
    const adapters = createBrowserMediaAdapters();
    const controller = new AbortController();
    const sound = await adapters.audio.create(
      "https://assets.example.test/voice.ogg",
      controller.signal
    );
    const fixture = soundFixtures.sounds[0]!;
    const loading = adapters.audio.load(
      sound,
      "https://assets.example.test/voice.ogg",
      controller.signal
    );
    fixture.emit("loaderror");

    await expect(loading).rejects.toThrow("Failed to load sound");
    expect(fixture.loadCalls).toBe(1);
    expect(fixture.listenerCount("load")).toBe(0);
    expect(fixture.listenerCount("loaderror")).toBe(0);
    adapters.audio.release(sound);
    expect(fixture.stopCalls).toBe(1);
    expect(fixture.unloadCalls).toBe(1);
  });

  it("removes audio load listeners when loading is aborted", async () => {
    const adapters = createBrowserMediaAdapters();
    const controller = new AbortController();
    const sound = await adapters.audio.create(
      "https://assets.example.test/voice.ogg",
      controller.signal
    );
    const fixture = soundFixtures.sounds[0]!;
    const loading = adapters.audio.load(
      sound,
      "https://assets.example.test/voice.ogg",
      controller.signal
    );
    controller.abort();

    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
    expect(fixture.listenerCount("load")).toBe(0);
    expect(fixture.listenerCount("loaderror")).toBe(0);
    adapters.audio.release(sound);
    expect(fixture.unloadCalls).toBe(1);
  });

  it("releases browser audio through the injected story audio adapter", async () => {
    const audioAdapter = {
      isPlaying: vi.fn(() => false),
      play: vi.fn(),
      stop: vi.fn(),
      unload: vi.fn(),
      setVolume: vi.fn(),
      getVolume: vi.fn(() => 1),
      setLoop: vi.fn(),
      fade: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      connectLipSync: vi.fn(() => null)
    } satisfies PixiStoryAudioAdapter;
    const adapters = createBrowserMediaAdapters(audioAdapter);
    const sound = await adapters.audio.create(
      "https://assets.example.test/voice.ogg",
      new AbortController().signal
    );

    adapters.audio.release(sound);

    expect(audioAdapter.stop).toHaveBeenCalledWith(sound);
    expect(audioAdapter.unload).toHaveBeenCalledWith(sound);
    expect(soundFixtures.sounds[0]?.stopCalls).toBe(0);
    expect(soundFixtures.sounds[0]?.unloadCalls).toBe(0);
  });
});
