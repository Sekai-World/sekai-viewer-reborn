import {
  STATIC_ASSET_RETRY_POLICY,
  type ImageRetryPhase,
  type ImageRetryPolicy,
  type ImageRetryRequestContext
} from "./policy";

const RETRY_DELAYS_MS = [300, 900] as const;
const RETRY_JITTER_RATIO = 0.2;

export type ImageRetryControllerOptions = Readonly<{
  /** Supplies the random value used for positive retry jitter. */
  random?: () => number;
}>;

export type ImageRetryRequestSnapshot = Readonly<{
  key: symbol;
  nonce: string;
  source: string;
  phase: ImageRetryPhase;
  attempt: number;
  url: string;
}>;

const createCycleNonce = (cycle: number): string =>
  globalThis.crypto?.randomUUID?.() ?? `cycle-${cycle.toString(36)}`;

const isSameOriginHttpResource = (resource: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const url = new URL(resource, window.location.href);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === window.location.origin
    );
  } catch {
    return false;
  }
};

type RetryProbe = Readonly<{
  snapshot: ImageRetryRequestSnapshot;
  controller: AbortController;
  timeout: ReturnType<typeof setTimeout>;
}>;

/**
 * Owns the retry state for one rendered image request.
 *
 * The class is implemented as a Svelte-aware module so its public state can be
 * read directly from Svelte templates while timers and probes remain private.
 * Each instance owns all mutable state; importing this module is SSR-safe.
 */
export class ImageRetryController {
  public currentSrc = $state("");
  public requestUrl = $state("");
  public requestKey = $state<symbol>(Symbol("image-retry-request"));
  public requestSnapshot = $state<ImageRetryRequestSnapshot | null>(null);
  public phase = $state<ImageRetryPhase>("primary");
  public attempt = $state(0);
  public imageLoaded = $state(false);
  public imageFailed = $state(false);

  private primarySource: string;
  private fallbackSource: string | undefined;
  private policy: ImageRetryPolicy;
  private cycle = 0;
  private cycleNonce = createCycleNonce(0);
  private cycleToken = Symbol("image-retry-cycle");
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryProbe: RetryProbe | null = null;
  private random: () => number;
  private disposed = false;

  public constructor(
    primarySource: string,
    fallbackSource: string | undefined,
    policy: ImageRetryPolicy = STATIC_ASSET_RETRY_POLICY,
    options: ImageRetryControllerOptions = {}
  ) {
    this.primarySource = primarySource;
    this.fallbackSource = fallbackSource;
    this.policy = policy;
    this.random = options.random ?? Math.random;
    this.beginCycle();
  }

  /** Update canonical sources or policy, resetting the old request cycle when needed. */
  public setSources(
    primarySource: string,
    fallbackSource: string | undefined,
    policy: ImageRetryPolicy = STATIC_ASSET_RETRY_POLICY
  ): void {
    if (this.disposed) {
      return;
    }

    if (
      this.primarySource === primarySource &&
      this.fallbackSource === fallbackSource &&
      this.policy === policy
    ) {
      return;
    }

    this.primarySource = primarySource;
    this.fallbackSource = fallbackSource;
    this.policy = policy;
    this.beginCycle();
  }

  /** Reset the current source pair and start a fresh retry cycle. */
  public reset(): void {
    if (!this.disposed) {
      this.beginCycle();
    }
  }

  /** Cancel timers/probes and reject all future image events for this instance. */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.clearRetryWork();
    this.cycleToken = Symbol("disposed-image-retry-cycle");
  }

  /** Mark the request represented by a keyed image snapshot as loaded. */
  public handleImageLoad(snapshot: ImageRetryRequestSnapshot): void {
    if (!this.isCurrentRequest(snapshot)) {
      return;
    }

    this.clearRetryWork();
    this.imageLoaded = true;
    this.imageFailed = false;
  }

  /** Handle an image error for the request represented by a keyed snapshot. */
  public handleImageError(snapshot: ImageRetryRequestSnapshot): void {
    if (!this.isCurrentRequest(snapshot)) {
      return;
    }

    if (this.attempt === 0 && this.policy.probe === "same-origin-head") {
      if (!isSameOriginHttpResource(snapshot.source)) {
        this.scheduleRetry(snapshot);
      } else if (this.retryProbe === null) {
        void this.probeCanonicalResource(snapshot);
      }
      return;
    }

    if (this.attempt < RETRY_DELAYS_MS.length) {
      this.scheduleRetry(snapshot);
      return;
    }

    this.exhaustImagePhase(snapshot);
  }

  private beginCycle(): void {
    this.clearRetryWork();
    this.cycle += 1;
    this.cycleNonce = createCycleNonce(this.cycle);
    this.cycleToken = Symbol("image-retry-cycle");
    this.phase = "primary";
    this.attempt = 0;
    this.imageLoaded = false;
    this.imageFailed = false;
    this.updateRequest();
  }

  private updateRequest(): void {
    this.currentSrc =
      this.phase === "fallback" && this.fallbackSource ? this.fallbackSource : this.primarySource;
    const context: ImageRetryRequestContext = Object.freeze({
      phase: this.phase,
      attempt: this.attempt,
      nonce: this.cycleNonce
    });
    const snapshot: ImageRetryRequestSnapshot = Object.freeze({
      key: Symbol("image-retry-request"),
      nonce: context.nonce,
      source: this.currentSrc,
      phase: context.phase,
      attempt: context.attempt,
      url: this.policy.buildRequestUrl(this.currentSrc, context)
    });
    this.requestSnapshot = snapshot;
    this.requestKey = snapshot.key;
    this.requestUrl = snapshot.url;
  }

  private isCurrentRequest(snapshot: ImageRetryRequestSnapshot): boolean {
    return !this.disposed && this.requestSnapshot === snapshot;
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearRetryProbe(): void {
    if (this.retryProbe === null) {
      return;
    }

    const activeProbe = this.retryProbe;
    this.retryProbe = null;
    clearTimeout(activeProbe.timeout);
    activeProbe.controller.abort();
  }

  private clearRetryWork(): void {
    this.clearRetryTimer();
    this.clearRetryProbe();
  }

  private scheduleRetry(snapshot: ImageRetryRequestSnapshot): void {
    if (!this.isCurrentRequest(snapshot) || this.retryTimer !== null) {
      return;
    }

    const retryAttempt = snapshot.attempt;
    const nextAttempt = retryAttempt + 1;
    const delay = RETRY_DELAYS_MS[retryAttempt];
    if (delay === undefined) {
      this.exhaustImagePhase(snapshot);
      return;
    }

    const random = this.random();
    const normalizedRandom = Number.isFinite(random) ? Math.min(1, Math.max(0, random)) : 0;
    const effectiveDelay = delay * (1 + normalizedRandom * RETRY_JITTER_RATIO);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.isCurrentRequest(snapshot)) {
        return;
      }

      this.clearRetryProbe();
      this.attempt = nextAttempt;
      this.updateRequest();
    }, effectiveDelay);
  }

  private async probeCanonicalResource(snapshot: ImageRetryRequestSnapshot): Promise<void> {
    if (!this.isCurrentRequest(snapshot) || !isSameOriginHttpResource(snapshot.source)) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.policy.probeTimeoutMs);
    const activeProbe: RetryProbe = Object.freeze({ snapshot, controller, timeout });
    this.retryProbe = activeProbe;
    let shouldRetry = false;

    try {
      const response = await fetch(snapshot.source, {
        method: "HEAD",
        credentials: "same-origin",
        signal: controller.signal,
        cache: "no-store"
      });

      if (this.retryProbe !== activeProbe || !this.isCurrentRequest(snapshot)) {
        return;
      }

      if (response.status === 404) {
        this.exhaustImagePhase(snapshot);
        return;
      }

      shouldRetry = true;
    } catch {
      shouldRetry = true;
    } finally {
      const isActiveProbe = this.retryProbe === activeProbe;
      clearTimeout(activeProbe.timeout);
      if (isActiveProbe) {
        this.retryProbe = null;
      }

      if (isActiveProbe && shouldRetry && this.isCurrentRequest(snapshot)) {
        this.scheduleRetry(snapshot);
      }
    }
  }

  private exhaustImagePhase(snapshot: ImageRetryRequestSnapshot): void {
    if (!this.isCurrentRequest(snapshot)) {
      return;
    }

    this.clearRetryWork();

    if (this.phase === "primary" && this.fallbackSource && this.fallbackSource !== snapshot.source) {
      this.phase = "fallback";
      this.attempt = 0;
      this.imageLoaded = false;
      this.imageFailed = false;
      this.updateRequest();
      return;
    }

    this.imageLoaded = true;
    this.imageFailed = true;
  }
}
