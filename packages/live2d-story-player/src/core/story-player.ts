export type StoryPlayerState =
  "idle" | "loading" | "ready" | "playing" | "finished" | "error" | "destroyed";

export interface StoryPlayerSnapshot {
  state: StoryPlayerState;
  error: Error | null;
  generation: number;
}

export interface StoryPlayerRuntime {
  /** Advances from the current checkpoint and reports the resulting state. */
  nextStep(): Promise<"ready" | "finished">;
  /** Silently rewinds to the preceding checkpoint. */
  prevStep(): Promise<"ready">;
  readonly canGoBack: boolean;
  /** False while playback is parked on an explicit user choice. */
  readonly canAutoplay?: boolean;
  abort(): void;
  setVolume(volume: { voiceVolume?: number; bgmVolume?: number; seVolume?: number }): void;
  setTextAnimation(enabled: boolean): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface StoryPlayer {
  readonly state: StoryPlayerState;
  readonly error: Error | null;
  readonly generation: number;
  subscribe(listener: (snapshot: StoryPlayerSnapshot) => void): () => void;
  /** Loads once; concurrent calls share the same promise. */
  load(): Promise<void>;
  /** Starts a new load generation, aborting and disposing the prior attempt. */
  retry(): Promise<void>;
  nextStep(): Promise<void>;
  readonly canGoBack: boolean;
  prevStep(): Promise<void>;
  abort(): void;
  setAutoplay(enabled: boolean): void;
  setVolume(volume: { voiceVolume?: number; bgmVolume?: number; seVolume?: number }): void;
  setTextAnimation(enabled: boolean): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface CreateStoryPlayerOptions {
  initialize: (signal: AbortSignal, generation: number) => Promise<StoryPlayerRuntime>;
  autoplay?: boolean;
  autoplayDelayMs?: number;
  onStateChange?: (snapshot: StoryPlayerSnapshot) => void;
}

type StoryPlayerVolume = Parameters<StoryPlayerRuntime["setVolume"]>[0];

const DEFAULT_AUTOPLAY_DELAY_MS = 1500;

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason));

const createAbortError = (): Error => {
  const error = new Error("Story player load was aborted");
  error.name = "AbortError";
  return error;
};

const getAbortError = (signal: AbortSignal): Error =>
  signal.reason instanceof Error ? signal.reason : createAbortError();

const waitForAbort = <T>(operation: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) return Promise.reject(getAbortError(signal));

  return new Promise<T>((resolve, reject) => {
    const cleanup = (): void => signal.removeEventListener("abort", onAbort);
    const onAbort = (): void => {
      cleanup();
      reject(getAbortError(signal));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    void operation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (reason: unknown) => {
        cleanup();
        reject(reason);
      }
    );
  });
};

export const createStoryPlayer = (options: CreateStoryPlayerOptions): StoryPlayer => {
  let state: StoryPlayerState = "idle";
  let error: Error | null = null;
  let generation = 0;
  let runtime: StoryPlayerRuntime | null = null;
  let loadController: AbortController | null = null;
  let loadPromise: Promise<void> | null = null;
  let autoplay = options.autoplay ?? false;
  let autoplayTimer: ReturnType<typeof setTimeout> | null = null;
  let autoplayRevision = 0;
  let pendingVolume: StoryPlayerVolume = {};
  let pendingTextAnimation: boolean | undefined;
  let pendingResize: { width: number; height: number } | null = null;
  let destroyed = false;
  const listeners = new Set<(snapshot: StoryPlayerSnapshot) => void>();
  const disposedRuntimes = new WeakSet<StoryPlayerRuntime>();

  const snapshot = (): StoryPlayerSnapshot => ({ state, error, generation });

  const notifyListener = (listener: (value: StoryPlayerSnapshot) => void): void => {
    try {
      listener(snapshot());
    } catch {
      // Consumer callbacks must not corrupt the player lifecycle.
    }
  };

  const setState = (nextState: StoryPlayerState, nextError: Error | null = null): void => {
    if (destroyed && nextState !== "destroyed") return;
    state = nextState;
    error = nextError;
    const current = snapshot();
    const currentListeners = [...listeners];
    try {
      options.onStateChange?.(current);
    } catch {
      // State observers are outside the lifecycle's failure boundary.
    }
    for (const listener of currentListeners) {
      if (listeners.has(listener)) notifyListener(listener);
    }
  };

  const abortRuntime = (value: StoryPlayerRuntime): void => {
    try {
      value.abort();
    } catch {
      // Continue teardown even if an adapter cannot abort cleanly.
    }
  };

  const disposeRuntime = (value: StoryPlayerRuntime): void => {
    if (disposedRuntimes.has(value)) return;
    disposedRuntimes.add(value);
    try {
      value.destroy();
    } catch {
      // Continue cleanup even when an adapter's teardown fails.
    }
  };

  const clearAutoplayTimer = (): void => {
    autoplayRevision += 1;
    if (autoplayTimer === null) return;
    clearTimeout(autoplayTimer);
    autoplayTimer = null;
  };

  const currentRuntime = (): StoryPlayerRuntime | null =>
    state === "error" || state === "destroyed" ? null : runtime;

  const scheduleAutoplay = (): void => {
    const activeRuntime = runtime;
    if (
      !autoplay ||
      destroyed ||
      state !== "ready" ||
      !activeRuntime ||
      activeRuntime.canAutoplay === false ||
      autoplayTimer !== null
    ) {
      return;
    }
    autoplayTimer = setTimeout(
      () => {
        autoplayTimer = null;
        void player.nextStep().catch(() => undefined);
      },
      Math.max(0, options.autoplayDelayMs ?? DEFAULT_AUTOPLAY_DELAY_MS)
    );
  };

  const invalidateLoad = (): void => {
    const controller = loadController;
    loadController = null;
    loadPromise = null;
    controller?.abort();
  };

  const isCurrentLoad = (attemptGeneration: number, controller: AbortController): boolean =>
    !destroyed && generation === attemptGeneration && loadController === controller;

  const applyPendingSettings = (activeRuntime: StoryPlayerRuntime): void => {
    if (Object.keys(pendingVolume).length > 0) activeRuntime.setVolume(pendingVolume);
    if (pendingTextAnimation !== undefined) {
      activeRuntime.setTextAnimation(pendingTextAnimation);
    }
    if (pendingResize) activeRuntime.resize(pendingResize.width, pendingResize.height);
  };

  const setRuntimeError = (reason: unknown, failedRuntime: StoryPlayerRuntime): void => {
    if (runtime !== failedRuntime || destroyed) return;
    runtime = null;
    clearAutoplayTimer();
    abortRuntime(failedRuntime);
    disposeRuntime(failedRuntime);
    setState("error", toError(reason));
  };

  const runPlayback = async (
    operation: (activeRuntime: StoryPlayerRuntime) => Promise<"ready" | "finished">
  ): Promise<void> => {
    const activeRuntime = currentRuntime();
    if (!activeRuntime || state !== "ready") return;

    clearAutoplayTimer();
    const activeAutoplayRevision = autoplayRevision;
    const activeGeneration = generation;
    setState("playing");
    try {
      const nextState = await operation(activeRuntime);
      if (destroyed || generation !== activeGeneration || runtime !== activeRuntime) return;
      setState(nextState);
      if (autoplayRevision === activeAutoplayRevision) scheduleAutoplay();
    } catch (reason) {
      if (destroyed || generation !== activeGeneration || runtime !== activeRuntime) return;
      setRuntimeError(reason, activeRuntime);
    }
  };

  const performLoad = async (
    attemptGeneration: number,
    controller: AbortController
  ): Promise<void> => {
    const initialization = Promise.resolve().then(() =>
      options.initialize(controller.signal, attemptGeneration)
    );
    void initialization.then(
      (loadedRuntime) => {
        if (!isCurrentLoad(attemptGeneration, controller)) disposeRuntime(loadedRuntime);
      },
      () => undefined
    );

    try {
      const loadedRuntime = await waitForAbort(initialization, controller.signal);
      if (!isCurrentLoad(attemptGeneration, controller)) {
        disposeRuntime(loadedRuntime);
        return;
      }

      try {
        applyPendingSettings(loadedRuntime);
      } catch (reason) {
        disposeRuntime(loadedRuntime);
        throw reason;
      }
      if (!isCurrentLoad(attemptGeneration, controller)) {
        disposeRuntime(loadedRuntime);
        return;
      }

      runtime = loadedRuntime;
      const activeAutoplayRevision = autoplayRevision;
      setState("ready");
      if (
        isCurrentLoad(attemptGeneration, controller) &&
        runtime === loadedRuntime &&
        state === "ready" &&
        autoplayRevision === activeAutoplayRevision
      ) {
        scheduleAutoplay();
      }
    } catch (reason) {
      if (!isCurrentLoad(attemptGeneration, controller)) return;
      if (controller.signal.aborted) {
        setState("idle");
        return;
      }

      const failedRuntime = runtime;
      if (failedRuntime) {
        runtime = null;
        abortRuntime(failedRuntime);
        disposeRuntime(failedRuntime);
      }
      clearAutoplayTimer();
      const nextError = toError(reason);
      setState("error", nextError);
      throw nextError;
    } finally {
      if (loadController === controller) {
        loadController = null;
        loadPromise = null;
      }
    }
  };

  const player: StoryPlayer = {
    get state(): StoryPlayerState {
      return state;
    },
    get error(): Error | null {
      return error;
    },
    get generation(): number {
      return generation;
    },
    subscribe: (listener): (() => void) => {
      if (destroyed) {
        notifyListener(listener);
        return () => undefined;
      }
      listeners.add(listener);
      notifyListener(listener);
      return () => listeners.delete(listener);
    },
    load: (): Promise<void> => {
      if (
        destroyed ||
        state === "destroyed" ||
        state === "ready" ||
        state === "playing" ||
        state === "finished"
      ) {
        return Promise.resolve();
      }
      if (state === "loading" && loadPromise) return loadPromise;
      if (state === "error") {
        const failed = Promise.reject(error ?? new Error("Story player failed to load"));
        void failed.catch(() => undefined);
        return failed;
      }

      const attemptGeneration = ++generation;
      const controller = new AbortController();
      let resolveAttempt!: () => void;
      let rejectAttempt!: (reason: unknown) => void;
      const attempt = new Promise<void>((resolve, reject) => {
        resolveAttempt = resolve;
        rejectAttempt = reject;
      });
      void attempt.catch(() => undefined);
      loadController = controller;
      loadPromise = attempt;
      setState("loading");

      if (isCurrentLoad(attemptGeneration, controller)) {
        void performLoad(attemptGeneration, controller).then(resolveAttempt, rejectAttempt);
      } else {
        resolveAttempt();
      }
      return attempt;
    },
    retry: (): Promise<void> => {
      if (destroyed) return Promise.resolve();
      clearAutoplayTimer();
      invalidateLoad();
      const previousRuntime = runtime;
      runtime = null;
      if (previousRuntime) {
        abortRuntime(previousRuntime);
        disposeRuntime(previousRuntime);
      }
      setState("idle");
      return player.load();
    },
    nextStep: (): Promise<void> => runPlayback((activeRuntime) => activeRuntime.nextStep()),
    get canGoBack(): boolean {
      return runtime?.canGoBack ?? false;
    },
    prevStep: (): Promise<void> => runPlayback((activeRuntime) => activeRuntime.prevStep()),
    abort: (): void => {
      if (destroyed) return;
      clearAutoplayTimer();
      if (state === "loading" && loadController) {
        invalidateLoad();
        setState("idle");
        return;
      }
      if (runtime) abortRuntime(runtime);
    },
    setAutoplay: (enabled: boolean): void => {
      autoplay = enabled;
      if (!enabled) clearAutoplayTimer();
      else scheduleAutoplay();
    },
    setVolume: (volume): void => {
      pendingVolume = { ...pendingVolume, ...volume };
      currentRuntime()?.setVolume(volume);
    },
    setTextAnimation: (enabled): void => {
      pendingTextAnimation = enabled;
      currentRuntime()?.setTextAnimation(enabled);
    },
    resize: (width, height): void => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      pendingResize = { width, height };
      currentRuntime()?.resize(width, height);
    },
    destroy: (): void => {
      if (destroyed) return;
      destroyed = true;
      clearAutoplayTimer();
      invalidateLoad();
      const activeRuntime = runtime;
      runtime = null;
      if (activeRuntime) {
        abortRuntime(activeRuntime);
        disposeRuntime(activeRuntime);
      }
      setState("destroyed");
      listeners.clear();
    }
  };

  return player;
};
