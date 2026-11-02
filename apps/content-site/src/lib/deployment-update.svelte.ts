/**
 * Deployed-version detection for the "new version available" prompt.
 *
 * SvelteKit's `updated` state (from `$app/state`) only says that the deployed
 * build differs from the one this tab runs. This monitor reads the deployed
 * build name from `_app/version.json` so a dismissal can be remembered for that
 * deployment, across reloads and tabs. See
 * `docs/viewer-implementation/content-site-update-notices.md`.
 */
export const DISMISSED_DEPLOYMENT_STORAGE_KEY = "content_site_dismissed_deployment";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const MAX_DEPLOYMENT_VERSION_LENGTH = 128;

export const isValidDeploymentVersion = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= MAX_DEPLOYMENT_VERSION_LENGTH &&
  value === value.trim();

const getBrowserStorage = (): StorageLike | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readDismissedDeployment = (
  storage: StorageLike | null = getBrowserStorage()
): string | null => {
  if (!storage) return null;

  try {
    const value = storage.getItem(DISMISSED_DEPLOYMENT_STORAGE_KEY);
    return isValidDeploymentVersion(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeDismissedDeployment = (
  version: string,
  storage: StorageLike | null = getBrowserStorage()
): void => {
  if (!storage || !isValidDeploymentVersion(version)) return;

  try {
    storage.setItem(DISMISSED_DEPLOYMENT_STORAGE_KEY, version);
  } catch {
    // Storage may be unavailable in privacy-restricted browsing contexts.
  }
};

/** Resolves the deployed build name, or `null` on any network, HTTP, or format failure. */
export const fetchDeployedVersion = async (
  versionUrl: string,
  fetcher: Fetcher
): Promise<string | null> => {
  try {
    const response = await fetcher(versionUrl, { cache: "no-store" });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    const version =
      typeof body === "object" && body !== null ? (body as { version?: unknown }).version : null;
    return isValidDeploymentVersion(version) ? version : null;
  } catch {
    return null;
  }
};

export type DeploymentUpdateMonitorOptions = {
  /** The build name this tab was loaded with (`version` from `$app/env`). */
  clientVersion: string;
  versionUrl: string;
  fetch?: Fetcher;
  storage?: StorageLike | null;
  reload?: () => void;
};

export class DeploymentUpdateMonitor {
  /** The newer deployed build name, once it has been read successfully. */
  deployedVersion = $state<string | null>(null);
  dismissedVersion = $state<string | null>(null);
  readonly visible = $derived(
    this.deployedVersion !== null && this.deployedVersion !== this.dismissedVersion
  );
  readonly #clientVersion: string;
  readonly #versionUrl: string;
  readonly #fetch: Fetcher | undefined;
  readonly #storage: StorageLike | null | undefined;
  readonly #reload: () => void;
  #pending: Promise<void> | null = null;

  constructor(options: DeploymentUpdateMonitorOptions) {
    this.#clientVersion = options.clientVersion;
    this.#versionUrl = options.versionUrl;
    this.#fetch = options.fetch;
    this.#storage = options.storage;
    this.#reload = options.reload ?? (() => window.location.reload());
  }

  /**
   * Reads the deployed build name once SvelteKit reports a new deployment.
   * Failures stay silent and leave the prompt hidden until a later retry.
   */
  detect(): Promise<void> {
    if (this.deployedVersion !== null) return Promise.resolve();

    this.#pending ??= fetchDeployedVersion(
      this.#versionUrl,
      this.#fetch ?? ((input, init) => fetch(input, init))
    )
      .then((version) => {
        if (version === null || version === this.#clientVersion) return;
        if (readDismissedDeployment(this.#getStorage()) === version) {
          this.dismissedVersion = version;
        }
        this.deployedVersion = version;
      })
      .finally(() => {
        this.#pending = null;
      });

    return this.#pending;
  }

  dismiss(): void {
    if (this.deployedVersion === null) return;
    this.dismissedVersion = this.deployedVersion;
    writeDismissedDeployment(this.deployedVersion, this.#getStorage());
  }

  reload(): void {
    this.#reload();
  }

  /**
   * Follows dismissals of this tab's deployment from other tabs, and retries a
   * failed read when the tab regains focus, becomes visible, or goes back
   * online. Returns the cleanup function.
   */
  listen(isUpdated: () => boolean): () => void {
    const retry = (): void => {
      if (isUpdated()) void this.detect();
    };
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") retry();
    };
    // Only another tab's dismissal of the same build hides the prompt here. A dismissal of a
    // different build is ignored, so a dismissal made in this tab stays in effect.
    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== DISMISSED_DEPLOYMENT_STORAGE_KEY) return;
      if (this.deployedVersion !== null && event.newValue === this.deployedVersion) {
        this.dismissedVersion = event.newValue;
      }
    };

    window.addEventListener("focus", retry);
    window.addEventListener("online", retry);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", retry);
      window.removeEventListener("online", retry);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }

  #getStorage(): StorageLike | null {
    return this.#storage === undefined ? getBrowserStorage() : this.#storage;
  }
}
