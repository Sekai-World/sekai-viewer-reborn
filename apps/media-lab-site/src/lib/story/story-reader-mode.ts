export type StoryReaderMode = "text" | "player";

const STORAGE_KEY = "media-lab:story-reader-mode";

const isStoryReaderMode = (value: unknown): value is StoryReaderMode =>
  value === "text" || value === "player";

/**
 * Returns the mode the user asked to remember on the picker dialog, or null
 * when it is unset, corrupt, or storage is unavailable (SSR, private mode).
 */
export const readRememberedStoryReaderMode = (): StoryReaderMode | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isStoryReaderMode(value) ? value : null;
  } catch {
    return null;
  }
};

/** Best-effort persist of the dialog choice; a failed write just means the
 * dialog reappears on the next story. */
export const rememberStoryReaderMode = (mode: StoryReaderMode): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable; ignore.
  }
};
