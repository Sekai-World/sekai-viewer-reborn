import type { StoryRouteStoryType } from "#lib/live2d/story-route.js";
import { parseStoryId, type StoryMasterCollections } from "./story-identity";

export interface StoryNeighbor {
  storyId: string;
  title: string;
}

export interface StoryNeighbors {
  previous: StoryNeighbor | null;
  next: StoryNeighbor | null;
}

export const noStoryNeighbors: StoryNeighbors = { previous: null, next: null };

/**
 * Adjacent episodes of the same unit, ordered by chapter then episode number.
 * Only unit stories have neighbours so far; other story types return none
 * until their own data adapters define an episode order.
 */
export const resolveStoryNeighbors = (
  storyType: StoryRouteStoryType,
  storyId: string,
  collections: StoryMasterCollections
): StoryNeighbors => {
  if (storyType !== "unit") return noStoryNeighbors;
  const parsed = parseStoryId(storyType, storyId);
  if (parsed?.kind !== "unit") return noStoryNeighbors;
  const unit = collections.unitStories.find((story) => story.unit === parsed.unit);
  if (!unit) return noStoryNeighbors;

  const episodes = [...unit.chapters]
    .sort((a, b) => a.chapterNo - b.chapterNo)
    .flatMap((chapter) =>
      [...chapter.episodes]
        .sort((a, b) => a.episodeNo - b.episodeNo)
        .map((episode) => ({
          storyId: `${unit.unit}-${chapter.chapterNo}-${episode.episodeNo}`,
          title: `${chapter.title} · ${episode.title}`
        }))
    );
  const index = episodes.findIndex((episode) => episode.storyId === storyId);
  if (index < 0) return noStoryNeighbors;
  return { previous: episodes[index - 1] ?? null, next: episodes[index + 1] ?? null };
};
