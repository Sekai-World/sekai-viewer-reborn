import { PUBLIC_CONTENT_SITE_BASE_URL } from "$app/env/public";

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

/** The content-site detail page of a tracked event. */
export const getContentSiteEventHref = (region: string, eventId: number | null): string | null =>
  eventId !== null && Number.isSafeInteger(eventId) && eventId > 0
    ? getContentSiteHref(`/event/${region}/${eventId}`)
    : null;
