/**
 * Shared rate-limited fetch pipeline for Live2D asset downloads.
 *
 * Ported from the legacy viewer's Live2D request scheduler: at most twenty
 * requests in flight, at most twenty starts per second, and bounded retries
 * (up to four) for HTTP 429 responses honoring `Retry-After` with exponential
 * backoff plus deterministic jitter as fallback.
 */

const MAX_IN_FLIGHT = 20;
const MAX_STARTS_PER_SECOND = 20;
const MAX_RETRIES = 4;

interface QueuedWork {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

class Live2dRequestScheduler {
  private readonly queue: QueuedWork[] = [];
  private inFlight = 0;
  private startTimestamps: number[] = [];

  private mayStart(): boolean {
    if (this.inFlight >= MAX_IN_FLIGHT) return false;
    const now = Date.now();
    this.startTimestamps = this.startTimestamps.filter(
      (timestamp) => now - timestamp < 1000
    );
    return this.startTimestamps.length < MAX_STARTS_PER_SECOND;
  }

  private pump(): void {
    while (this.queue.length > 0 && this.mayStart()) {
      const work = this.queue.shift()!;
      this.inFlight++;
      this.startTimestamps.push(Date.now());
      work
        .run()
        .then(work.resolve, work.reject)
        .finally(() => {
          this.inFlight--;
          this.pump();
        });
    }
    if (this.queue.length > 0) {
      const now = Date.now();
      this.startTimestamps = this.startTimestamps.filter(
        (timestamp) => now - timestamp < 1000
      );
      const waitMs =
        this.startTimestamps.length >= MAX_STARTS_PER_SECOND
          ? 1000 - (now - this.startTimestamps[0]) + 1
          : 50;
      setTimeout(() => this.pump(), waitMs);
    }
  }

  schedule<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const work: QueuedWork = {
        run,
        resolve: (value) => resolve(value as T),
        reject
      };
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
  return Number.isNaN(date)
    ? undefined
    : Math.min(30000, Math.max(0, date - Date.now()));
};

/**
 * Runs a Live2D asset request through the shared scheduler with bounded
 * retries for rate-limited (429) responses.
 */
export async function live2dRequest<T>(
  request: () => Promise<T>
): Promise<T> {
  for (let retry = 0; ; retry++) {
    try {
      return await scheduler.schedule(request);
    } catch (error) {
      const isRateLimited = error instanceof Response && error.status === 429;
      if (!isRateLimited) throw error;
      if (retry >= MAX_RETRIES) throw error;
      const retryAfter = getRetryAfterMs(error);
      const backoff = Math.min(1000 * 2 ** retry, 8000);
      const deterministicJitter = (retry * 997) % 251;
      const delay = retryAfter ?? backoff + deterministicJitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Fetches a Live2D asset while applying shared rate-limit handling.
 *
 * @param url - The resource URL
 * @param init - Optional fetch options
 * @returns The HTTP response
 */
export async function live2dFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return live2dRequest(async () => {
    const response = await fetch(url, init);
    if (response.status === 429) throw response;
    return response;
  });
}
