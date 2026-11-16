import { PUBLIC_CONTENT_SITE_BASE_URL } from "$app/env/public";
import type { StorySource } from "#lib/story/story-identity.js";

/**
 * The content site is an optional cross-site integration. If deployment wiring
 * is not present, hide the links instead of pointing at a missing site.
 */
const getContentSiteBaseUrl = (): string | null =>
  PUBLIC_CONTENT_SITE_BASE_URL?.trim().replace(/\/+$/, "") || null;

const getContentSiteHref = (path: string): string | null => {
  const baseUrl = getContentSiteBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : null;
};

export const getContentSiteHomeHref = (): string | null => getContentSiteHref("/");

/** The event, card, or character detail page a story belongs to. */
export const getContentSiteSourceHref = (
  region: string,
  source: StorySource | undefined
): string | null =>
  source && Number.isSafeInteger(source.id) && source.id > 0
    ? getContentSiteHref(`/${source.kind}/${region}/${source.id}`)
    : null;
