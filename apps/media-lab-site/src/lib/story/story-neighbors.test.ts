import { describe, expect, it } from "vitest";
import type { StoryMasterCollections } from "./story-identity";
import { noStoryNeighbors, resolveStoryNeighbors } from "./story-neighbors";

const episode = (episodeNo: number, title: string) => ({
  id: episodeNo,
  chapterNo: 0,
  episodeNo,
  title,
  assetbundleName: `ep${episodeNo}`,
  scenarioId: `sc${episodeNo}`
});

const collections = {
  unitStories: [
    {
      unit: "light_sound",
      seq: 1,
      // Deliberately out of order to prove the sort.
      chapters: [
        {
          id: 2,
          unit: "light_sound",
          chapterNo: 2,
          title: "Chapter 2",
          assetbundleName: "c2",
          episodes: [episode(1, "Second chapter opener")]
        },
        {
          id: 1,
          unit: "light_sound",
          chapterNo: 1,
          title: "Chapter 1",
          assetbundleName: "c1",
          episodes: [episode(2, "Middle"), episode(1, "Opening")]
        }
      ]
    }
  ]
} as unknown as StoryMasterCollections;

describe("resolveStoryNeighbors", () => {
  it("has no previous neighbour for the first episode", () => {
    expect(resolveStoryNeighbors("unit", "light_sound-1-1", collections)).toEqual({
      previous: null,
      next: { storyId: "light_sound-1-2", title: "Chapter 1 · Middle" }
    });
  });

  it("links across a chapter boundary in chapter order", () => {
    expect(resolveStoryNeighbors("unit", "light_sound-1-2", collections)).toEqual({
      previous: { storyId: "light_sound-1-1", title: "Chapter 1 · Opening" },
      next: { storyId: "light_sound-2-1", title: "Chapter 2 · Second chapter opener" }
    });
  });

  it("has no next neighbour for the last episode", () => {
    expect(resolveStoryNeighbors("unit", "light_sound-2-1", collections).next).toBeNull();
  });

  it("returns no neighbours for unknown ids, units and other story types", () => {
    expect(resolveStoryNeighbors("unit", "light_sound-9-9", collections)).toEqual(noStoryNeighbors);
    expect(resolveStoryNeighbors("unit", "idol-1-1", collections)).toEqual(noStoryNeighbors);
    expect(resolveStoryNeighbors("unit", "not-an-id", collections)).toEqual(noStoryNeighbors);
    expect(resolveStoryNeighbors("event", "1-1", collections)).toEqual(noStoryNeighbors);
  });
});
