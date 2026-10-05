import { isValidSiteVersion } from "$lib/site-updates";

export const ONBOARDING_SEEN_STORAGE_KEY = "content_site_onboarding_seen";
export const SEEN_SITE_VERSION_STORAGE_KEY = "content_site_seen_version";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const getBrowserStorage = (): StorageLike | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readOnboardingSeen = (storage: StorageLike | null = getBrowserStorage()): boolean => {
  if (!storage) return false;

  try {
    return storage.getItem(ONBOARDING_SEEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const writeOnboardingSeen = (storage: StorageLike | null = getBrowserStorage()): void => {
  if (!storage) return;

  try {
    storage.setItem(ONBOARDING_SEEN_STORAGE_KEY, "true");
  } catch {
    // Storage may be unavailable in privacy-restricted browsing contexts.
  }
};

export const readSeenSiteVersion = (
  storage: StorageLike | null = getBrowserStorage()
): string | null => {
  if (!storage) return null;

  try {
    const value = storage.getItem(SEEN_SITE_VERSION_STORAGE_KEY);
    return isValidSiteVersion(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeSeenSiteVersion = (
  version: string,
  storage: StorageLike | null = getBrowserStorage()
): void => {
  if (!storage || !isValidSiteVersion(version)) return;

  try {
    storage.setItem(SEEN_SITE_VERSION_STORAGE_KEY, version);
  } catch {
    // Storage may be unavailable in privacy-restricted browsing contexts.
  }
};
