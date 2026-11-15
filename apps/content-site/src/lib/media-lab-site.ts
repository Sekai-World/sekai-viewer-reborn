import { PUBLIC_MEDIA_LAB_SITE_BASE_URL } from "$app/env/public";
import type { SupportedRegion } from "#lib/domain/regions.js";

/**
 * The media lab site is an optional cross-site integration. If deployment
 * wiring is not present, hide the entry point instead of making content pages
 * fail. Story Reader ids follow `apps/media-lab-site/src/lib/story/story-identity.ts`.
 */
const getMediaLabSiteBaseUrl = (): string | null =>
  PUBLIC_MEDIA_LAB_SITE_BASE_URL?.trim().replace(/\/+$/, "") || null;

const getMediaLabSiteHref = (path: string): string | null => {
  const baseUrl = getMediaLabSiteBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : null;
};

const isMasterDataId = (id: string): boolean => /^[1-9]\d*$/.test(id);

const getStoryHref = (
  region: SupportedRegion,
  storyType: "event" | "card" | "character",
  id: string,
  suffix = ""
): string | null =>
  isMasterDataId(id)
    ? getMediaLabSiteHref(`/story-reader/${region}/${storyType}/${id}${suffix}`)
    : null;

export const getStoryReaderHref = (): string | null => getMediaLabSiteHref("/story-reader");

export const getLive2dHref = (): string | null => getMediaLabSiteHref("/live2d");

export const getChibiHref = (): string | null => getMediaLabSiteHref("/chibi");

/** Opens the first episode of the event story. */
export const getEventStoryReaderHref = (region: SupportedRegion, eventId: string): string | null =>
  getStoryHref(region, "event", eventId, "-1");

/** `cardEpisodeId` is the master `cardEpisodes.id`, not the card id. */
export const getCardStoryReaderHref = (
  region: SupportedRegion,
  cardEpisodeId: string
): string | null => getStoryHref(region, "card", cardEpisodeId);

/** `characterId` is the game character id that keys `characterProfiles`. */
export const getCharacterStoryReaderHref = (
  region: SupportedRegion,
  characterId: string
): string | null => getStoryHref(region, "character", characterId);
