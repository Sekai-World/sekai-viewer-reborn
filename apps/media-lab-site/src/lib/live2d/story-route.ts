import { supportedRegions, type SupportedRegion } from "$lib/region-selection.svelte";

/**
 * Route-level validation for the Live2D StoryReader path params.
 *
 * Deliberately independent from the draft `StoryDocument` contract in
 * `./story-document.ts`: route validation must stay stable while the player
 * adapter work finalizes the document shapes.
 */
export const storyRouteStoryTypes = [
  "unit",
  "event",
  "character",
  "card",
  "area-talk",
  "special",
  "profile"
] as const;

export type StoryRouteStoryType = (typeof storyRouteStoryTypes)[number];
export type StoryRouteRegion = SupportedRegion;

export interface StoryRouteIdentity {
  region: StoryRouteRegion;
  storyType: StoryRouteStoryType;
  storyId: string;
}

export type ParsedStoryRouteParams =
  | { status: "ok"; identity: StoryRouteIdentity }
  | { status: "invalid-region" }
  | { status: "invalid-story-type" }
  | { status: "invalid-story-id" };

// Story IDs are opaque slugs in the current mirror contracts. Keep them on a
// conservative, path-safe charset so a route param can never smuggle path
// separators or control characters into metadata rendering.
const MAX_STORY_ID_LENGTH = 128;
const STORY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const isStoryRouteRegion = (value: string): value is StoryRouteRegion =>
  (supportedRegions as readonly string[]).includes(value);

export const isStoryRouteStoryType = (value: string): value is StoryRouteStoryType =>
  (storyRouteStoryTypes as readonly string[]).includes(value);

export const isStoryRouteStoryId = (value: string): boolean =>
  value.length > 0 && value.length <= MAX_STORY_ID_LENGTH && STORY_ID_PATTERN.test(value);

export const parseStoryRouteParams = (params: {
  region?: string;
  storyType?: string;
  storyId?: string;
}): ParsedStoryRouteParams => {
  const region = params.region?.trim().toLowerCase() ?? "";
  if (!isStoryRouteRegion(region)) return { status: "invalid-region" };

  const storyType = params.storyType?.trim() ?? "";
  if (!isStoryRouteStoryType(storyType)) return { status: "invalid-story-type" };

  const storyId = params.storyId?.trim() ?? "";
  if (!isStoryRouteStoryId(storyId)) return { status: "invalid-story-id" };

  return { status: "ok", identity: { region, storyType, storyId } };
};
