import { Live2DMediaLoadError } from "@platform/live2d-story-player";

/**
 * `media-missing`: the bucket confirmed a file the story needs does not exist
 * (a deterministic gap in the region's assets, so retrying cannot help).
 * `failed`: anything else, including a transient or unverifiable failure.
 */
export type StoryLoadFailureKind = "media-missing" | "failed";

/**
 * Classifies a story load failure. Only a media failure is probed, and only a
 * definite 404 from the asset host counts as missing; an unreachable probe is
 * reported as a generic failure rather than guessed.
 */
export const classifyStoryLoadFailure = async (
  error: unknown,
  fetchFn: typeof fetch = fetch
): Promise<StoryLoadFailureKind> => {
  if (!(error instanceof Live2DMediaLoadError)) return "failed";
  try {
    const response = await fetchFn(error.url, { method: "HEAD" });
    return response.status === 404 ? "media-missing" : "failed";
  } catch {
    return "failed";
  }
};
