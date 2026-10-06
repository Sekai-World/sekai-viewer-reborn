import { afterEach, describe, expect, it, vi } from "vitest";

import { createStoryPlayer, type StoryPlayerRuntime } from "./story-player.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createRuntime = (overrides: Partial<StoryPlayerRuntime> = {}): StoryPlayerRuntime => ({
  nextStep: async () => "ready",
  prevStep: async () => "ready",
  canGoBack: true,
  canAutoplay: true,
  abort: () => undefined,
  setVolume: () => undefined,
  setTextAnimation: () => undefined,
  resize: () => undefined,
  destroy: () => undefined,
  ...overrides
});

describe("createStoryPlayer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a synchronous handle and shares the load promise with reentrant state callbacks", async () => {
    const initialization = deferred<StoryPlayerRuntime>();
    let callbackLoad: Promise<void> | undefined;
    const initialize = vi.fn(() => initialization.promise);

    const player = createStoryPlayer({
      initialize,
      onStateChange: (snapshot) => {
        if (snapshot.state === "loading") callbackLoad = player.load();
      }
    });

    expect(player.state).toBe("idle");
    const load = player.load();
    expect(player.state).toBe("loading");
    expect(callbackLoad).toBe(load);

    await flushMicrotasks();
    expect(initialize).toHaveBeenCalledOnce();
    initialization.resolve(createRuntime());
    await load;
    expect(player.state).toBe("ready");
  });

  it("shares one promise and one initialization across concurrent load calls", async () => {
    const initialization = deferred<StoryPlayerRuntime>();
    const initialize = vi.fn(() => initialization.promise);
    const player = createStoryPlayer({ initialize });

    const firstLoad = player.load();
    const secondLoad = player.load();

    expect(secondLoad).toBe(firstLoad);
    await flushMicrotasks();
    expect(initialize).toHaveBeenCalledOnce();
    initialization.resolve(createRuntime());
    await Promise.all([firstLoad, secondLoad]);
  });

  it("dispatches a stable listener snapshot when subscriptions are added reentrantly", async () => {
    const initialization = deferred<StoryPlayerRuntime>();
    const callbackStates: string[] = [];
    const listenerStates: string[] = [];
    let subscribedFromCallback = false;
    let subscribedFromListener = false;
    const player = createStoryPlayer({
      initialize: () => initialization.promise,
      onStateChange: ({ state }) => {
        if (state !== "loading" || subscribedFromCallback) return;
        subscribedFromCallback = true;
        player.subscribe((snapshot) => callbackStates.push(snapshot.state));
      }
    });

    player.subscribe(({ state }) => {
      if (state !== "loading" || subscribedFromListener) return;
      subscribedFromListener = true;
      player.subscribe((snapshot) => listenerStates.push(snapshot.state));
    });

    const load = player.load();
    expect(callbackStates).toEqual(["loading"]);
    expect(listenerStates).toEqual(["loading"]);
    initialization.resolve(createRuntime());
    await load;
    expect(callbackStates).toEqual(["loading", "ready"]);
    expect(listenerStates).toEqual(["loading", "ready"]);
  });

  it("aborts a pending load to a stable idle state and disposes a late runtime", async () => {
    const initialization = deferred<StoryPlayerRuntime>();
    let loadSignal: AbortSignal | undefined;
    const initialize = vi.fn((signal: AbortSignal) => {
      loadSignal = signal;
      return initialization.promise;
    });
    const player = createStoryPlayer({ initialize });
    const load = player.load();
    await flushMicrotasks();

    player.abort();

    expect(loadSignal?.aborted).toBe(true);
    expect(player.state).toBe("idle");
    await expect(load).resolves.toBeUndefined();

    const lateRuntime = createRuntime({ destroy: vi.fn() });
    initialization.resolve(lateRuntime);
    await flushMicrotasks();
    expect(lateRuntime.destroy).toHaveBeenCalledOnce();
    expect(player.state).toBe("idle");
  });

  it("ignores and destroys an obsolete generation after retry", async () => {
    const firstInitialization = deferred<StoryPlayerRuntime>();
    const secondInitialization = deferred<StoryPlayerRuntime>();
    const generations: number[] = [];
    let initializeCount = 0;
    const player = createStoryPlayer({
      initialize: (_signal, generation) => {
        generations.push(generation);
        initializeCount += 1;
        return initializeCount === 1 ? firstInitialization.promise : secondInitialization.promise;
      }
    });

    const firstLoad = player.load();
    await flushMicrotasks();
    const retry = player.retry();
    await flushMicrotasks();
    expect(generations).toEqual([1, 2]);
    await expect(firstLoad).resolves.toBeUndefined();

    const obsoleteRuntime = createRuntime({ destroy: vi.fn() });
    firstInitialization.resolve(obsoleteRuntime);
    await flushMicrotasks();
    expect(obsoleteRuntime.destroy).toHaveBeenCalledOnce();
    expect(player.state).toBe("loading");
    expect(player.generation).toBe(2);

    secondInitialization.resolve(createRuntime());
    await retry;
    expect(player.state).toBe("ready");
  });

  it("retains load errors for late subscribers and retries with a new generation", async () => {
    const failure = new Error("preload failed");
    let initializeCount = 0;
    const player = createStoryPlayer({
      initialize: async () => {
        initializeCount += 1;
        if (initializeCount === 1) throw failure;
        return createRuntime();
      }
    });

    await expect(player.load()).rejects.toBe(failure);
    expect(player.state).toBe("error");
    expect(player.error).toBe(failure);

    const snapshots: Array<{ state: string; error: Error | null }> = [];
    player.subscribe(({ state, error }) => snapshots.push({ state, error }));
    expect(snapshots).toEqual([{ state: "error", error: failure }]);
    await expect(player.load()).rejects.toBe(failure);
    expect(initializeCount).toBe(1);

    await player.retry();
    expect(player.generation).toBe(2);
    expect(player.state).toBe("ready");
    expect(player.error).toBeNull();
  });

  it("applies volume, text, and resize settings requested while loading", async () => {
    const initialization = deferred<StoryPlayerRuntime>();
    const volumeCalls: Array<Parameters<StoryPlayerRuntime["setVolume"]>[0]> = [];
    const textAnimationCalls: boolean[] = [];
    const resizeCalls: Array<[number, number]> = [];
    const runtime = createRuntime({
      setVolume: (volume) => volumeCalls.push(volume),
      setTextAnimation: (enabled) => textAnimationCalls.push(enabled),
      resize: (width, height) => resizeCalls.push([width, height])
    });
    const player = createStoryPlayer({ initialize: () => initialization.promise });

    player.setVolume({ voiceVolume: 0.2 });
    player.setVolume({ bgmVolume: 0.4 });
    player.setTextAnimation(false);
    player.resize(800, 600);
    player.resize(Number.NaN, 400);
    const load = player.load();
    await flushMicrotasks();
    player.setVolume({ seVolume: 0.6 });
    initialization.resolve(runtime);
    await load;

    expect(volumeCalls).toEqual([{ voiceVolume: 0.2, bgmVolume: 0.4, seVolume: 0.6 }]);
    expect(textAnimationCalls).toEqual([false]);
    expect(resizeCalls).toEqual([[800, 600]]);
  });

  it("autoplays only after the configured delay", async () => {
    vi.useFakeTimers();
    const nextStep = vi.fn(async () => "ready" as const);
    const player = createStoryPlayer({
      initialize: async () => createRuntime({ nextStep }),
      autoplay: true,
      autoplayDelayMs: 40
    });

    await player.load();
    await vi.advanceTimersByTimeAsync(39);
    expect(nextStep).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(nextStep).toHaveBeenCalledOnce();
    expect(player.state).toBe("ready");
    player.destroy();
  });

  it("respects runtime choice gates and cancels disabled autoplay timers", async () => {
    vi.useFakeTimers();
    const gatedNext = vi.fn(async () => "ready" as const);
    const gatedPlayer = createStoryPlayer({
      initialize: async () => createRuntime({ canAutoplay: false, nextStep: gatedNext }),
      autoplay: true,
      autoplayDelayMs: 20
    });
    await gatedPlayer.load();
    await vi.advanceTimersByTimeAsync(50);
    expect(gatedNext).not.toHaveBeenCalled();
    gatedPlayer.destroy();

    const disabledNext = vi.fn(async () => "ready" as const);
    const disabledPlayer = createStoryPlayer({
      initialize: async () => createRuntime({ nextStep: disabledNext }),
      autoplay: true,
      autoplayDelayMs: 20
    });
    await disabledPlayer.load();
    disabledPlayer.setAutoplay(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(disabledNext).not.toHaveBeenCalled();
    disabledPlayer.destroy();
  });

  it("converts autoplay failures to player errors without unhandled rejections", async () => {
    vi.useFakeTimers();
    const failure = new Error("playback failed");
    const abort = vi.fn();
    const destroy = vi.fn();
    const nextStep = vi.fn(async () => {
      throw failure;
    });
    const player = createStoryPlayer({
      initialize: async () => createRuntime({ nextStep, abort, destroy }),
      autoplay: true,
      autoplayDelayMs: 10
    });

    await player.load();
    await vi.advanceTimersByTimeAsync(10);
    expect(player.state).toBe("error");
    expect(player.error).toBe(failure);
    expect(abort).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    player.destroy();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("guards navigation outside ready state while allowing previous steps when ready", async () => {
    const nextStepDeferred = deferred<"ready" | "finished">();
    const nextStep = vi.fn(() => nextStepDeferred.promise);
    const prevStep = vi.fn(async () => "ready" as const);
    const player = createStoryPlayer({
      initialize: async () => createRuntime({ nextStep, prevStep })
    });

    await player.nextStep();
    await player.prevStep();
    expect(nextStep).not.toHaveBeenCalled();
    expect(prevStep).not.toHaveBeenCalled();

    await player.load();
    const advancing = player.nextStep();
    expect(player.state).toBe("playing");
    await player.nextStep();
    await player.prevStep();
    expect(nextStep).toHaveBeenCalledOnce();
    expect(prevStep).not.toHaveBeenCalled();

    nextStepDeferred.resolve("ready");
    await advancing;
    await player.prevStep();
    expect(prevStep).toHaveBeenCalledOnce();
    expect(player.state).toBe("ready");
  });

  it("does not navigate after the runtime finishes", async () => {
    const nextStep = vi.fn(async () => "finished" as const);
    const prevStep = vi.fn(async () => "ready" as const);
    const player = createStoryPlayer({
      initialize: async () => createRuntime({ nextStep, prevStep })
    });
    await player.load();

    await player.nextStep();
    await player.nextStep();
    await player.prevStep();

    expect(player.state).toBe("finished");
    expect(nextStep).toHaveBeenCalledOnce();
    expect(prevStep).not.toHaveBeenCalled();
  });

  it("destroys a ready runtime exactly once", async () => {
    const abort = vi.fn();
    const destroy = vi.fn();
    const player = createStoryPlayer({
      initialize: async () => createRuntime({ abort, destroy })
    });
    await player.load();

    player.destroy();
    player.destroy();

    expect(player.state).toBe("destroyed");
    expect(abort).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    await player.load();
    await player.retry();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("destroys a runtime that resolves after player destruction exactly once", async () => {
    const initialization = deferred<StoryPlayerRuntime>();
    let loadSignal: AbortSignal | undefined;
    const player = createStoryPlayer({
      initialize: (signal) => {
        loadSignal = signal;
        return initialization.promise;
      }
    });
    const load = player.load();
    await flushMicrotasks();

    player.destroy();
    expect(loadSignal?.aborted).toBe(true);
    expect(player.state).toBe("destroyed");
    await expect(load).resolves.toBeUndefined();

    const lateRuntime = createRuntime({ destroy: vi.fn() });
    initialization.resolve(lateRuntime);
    await flushMicrotasks();
    expect(lateRuntime.destroy).toHaveBeenCalledOnce();
    player.destroy();
    expect(lateRuntime.destroy).toHaveBeenCalledOnce();
  });
});
