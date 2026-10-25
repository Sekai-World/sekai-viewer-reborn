export type FilterGuideScope = "cards" | "musics" | "virtual-lives";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const getBrowserStorage = (): StorageLike | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

const getStorageKey = (scope: FilterGuideScope): string =>
  `content_site_filter_guide_seen_${scope}`;

export const readFilterGuideSeen = (
  scope: FilterGuideScope,
  storage: StorageLike | null = getBrowserStorage()
): boolean => {
  if (!storage) return false;

  try {
    return storage.getItem(getStorageKey(scope)) === "true";
  } catch {
    return false;
  }
};

export const writeFilterGuideSeen = (
  scope: FilterGuideScope,
  storage: StorageLike | null = getBrowserStorage()
): void => {
  if (!storage) return;

  try {
    storage.setItem(getStorageKey(scope), "true");
  } catch {
    // Storage may be unavailable in privacy-restricted browsing contexts.
  }
};
