/**
 * Shared rate-limited fetch pipeline for Live2D asset downloads.
 *
 * At most twenty requests are in flight, at most twenty start per second, and
 * HTTP 429 responses receive bounded retries honoring `Retry-After` with
 * exponential backoff plus deterministic jitter as fallback.
 */

const MAX_IN_FLIGHT = 20;
const MAX_STARTS_PER_SECOND = 20;
const MAX_RETRIES = 4;

interface QueuedWork {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
  abortHandler?: () => void;
}

const getAbortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError");

const raceWithAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(getAbortReason(signal));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const settle = (result: { kind: "resolve"; value: T } | { kind: "reject"; error: unknown }) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result.kind === "resolve") resolve(result.value);
      else reject(result.error);
    };
    const onAbort = () => settle({ kind: "reject", error: getAbortReason(signal) });

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => settle({ kind: "resolve", value }),
      (error: unknown) => settle({ kind: "reject", error })
    );
    if (signal.aborted) onAbort();
  });
};

class Live2dRequestScheduler {
  private readonly queue: QueuedWork[] = [];
  private inFlight = 0;
  private startTimestamps: number[] = [];
  private pumpTimer: ReturnType<typeof setTimeout> | undefined;

  private mayStart(): boolean {
    if (this.inFlight >= MAX_IN_FLIGHT) return false;
    const now = Date.now();
    this.startTimestamps = this.startTimestamps.filter((timestamp) => now - timestamp < 1000);
    return this.startTimestamps.length < MAX_STARTS_PER_SECOND;
  }

  private pump(): void {
    if (this.pumpTimer !== undefined) {
      clearTimeout(this.pumpTimer);
      this.pumpTimer = undefined;
    }

    while (this.queue.length > 0 && this.mayStart()) {
      const work = this.queue.shift()!;
      if (work.abortHandler && work.signal) {
        work.signal.removeEventListener("abort", work.abortHandler);
      }
      this.inFlight++;
      this.startTimestamps.push(Date.now());
      void Promise.resolve()
        .then(work.run)
        .then(work.resolve, work.reject)
        .finally(() => {
          this.inFlight--;
          this.pump();
        });
    }

    if (this.queue.length > 0) {
      const now = Date.now();
      this.startTimestamps = this.startTimestamps.filter((timestamp) => now - timestamp < 1000);
      const waitMs =
        this.startTimestamps.length >= MAX_STARTS_PER_SECOND
          ? 1000 - (now - this.startTimestamps[0]!) + 1
          : 50;
      this.pumpTimer = setTimeout(() => {
        this.pumpTimer = undefined;
        this.pump();
      }, waitMs);
    }
  }

  schedule<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(getAbortReason(signal));

    return new Promise<T>((resolve, reject) => {
      const work: QueuedWork = {
        run,
        resolve: (value) => resolve(value as T),
        reject,
        ...(signal ? { signal } : {})
      };
      if (signal) {
        const abortHandler = () => {
          const index = this.queue.indexOf(work);
          if (index === -1) return;
          this.queue.splice(index, 1);
          signal.removeEventListener("abort", abortHandler);
          reject(getAbortReason(signal));
          this.pump();
        };
        work.abortHandler = abortHandler;
        signal.addEventListener("abort", abortHandler, { once: true });
        if (signal.aborted) {
          abortHandler();
          return;
        }
      }
      this.queue.push(work);
      this.pump();
    });
  }
}

const scheduler = new Live2dRequestScheduler();

const getRetryAfterMs = (error: unknown): number | undefined => {
  if (!(error instanceof Response)) return undefined;
  const raw = error.headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw.trim());
  if (Number.isFinite(seconds)) {
    return Math.min(30000, Math.max(0, seconds * 1000));
  }
  const date = Date.parse(raw);
  return Number.isNaN(date) ? undefined : Math.min(30000, Math.max(0, date - Date.now()));
};

const waitForRetry = (delayMs: number, signal?: AbortSignal): Promise<void> => {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, delayMs));
  if (signal.aborted) return Promise.reject(getAbortReason(signal));

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => finish("resolve"), delayMs);
    const onAbort = () => finish("reject", getAbortReason(signal));
    const finish = (kind: "resolve" | "reject", error?: unknown) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      if (kind === "resolve") resolve();
      else reject(error);
    };

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
};

/** Runs a Live2D asset request through the scheduler with abortable retries. */
export function live2dRequest<T>(
  request: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const runAttempt = async (retry: number): Promise<T> => {
    if (signal?.aborted) throw getAbortReason(signal);
    try {
      return await scheduler.schedule(
        () =>
          raceWithAbort(
            Promise.resolve().then(() => request(signal)),
            signal
          ),
        signal
      );
    } catch (error) {
      if (signal?.aborted) throw getAbortReason(signal);
      const isRateLimited = error instanceof Response && error.status === 429;
      if (!isRateLimited) throw error;
      if (retry >= MAX_RETRIES) throw error;
      const retryAfter = getRetryAfterMs(error);
      const backoff = Math.min(1000 * 2 ** retry, 8000);
      const deterministicJitter = (retry * 997) % 251;
      await waitForRetry(retryAfter ?? backoff + deterministicJitter, signal);
      return runAttempt(retry + 1);
    }
  };

  return runAttempt(0);
}

/** Fetches a Live2D asset while applying shared rate-limit handling. */
export async function live2dFetch(
  url: string,
  init?: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  const requestSignal = signal ?? init?.signal ?? undefined;
  return live2dRequest(async (activeSignal) => {
    const fetchOptions = activeSignal ? { ...init, signal: activeSignal } : init;
    const response = await fetch(url, fetchOptions);
    if (response.status === 429) throw response;
    return response;
  }, requestSignal);
}
