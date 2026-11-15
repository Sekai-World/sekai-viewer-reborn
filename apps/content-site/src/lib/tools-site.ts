import { PUBLIC_TOOLS_SITE_BASE_URL } from "$app/env/public";
import type { SupportedRegion } from "#lib/domain/regions.js";

const isTrackerSupportedRegion = (region: SupportedRegion): boolean =>
  region === "jp" || region === "tw" || region === "en" || region === "kr";

/**
 * The tools site is an optional cross-site integration. If deployment wiring
 * is not present, hide the entry point instead of making content pages fail.
 */
const getToolsSiteBaseUrl = (): string | null =>
  PUBLIC_TOOLS_SITE_BASE_URL?.trim().replace(/\/+$/, "") || null;

export const getEventTrackerSiteHref = (region: SupportedRegion): string | null => {
  if (!isTrackerSupportedRegion(region)) {
    return null;
  }

  const baseUrl = getToolsSiteBaseUrl();
  return baseUrl ? `${baseUrl}/tracker/${region}` : null;
};

export const getEventTrackerHref = (region: SupportedRegion, eventId: string): string | null => {
  const trackerHref = getEventTrackerSiteHref(region);
  if (!trackerHref) {
    return null;
  }

  const query = new URLSearchParams({ eventId });
  return `${trackerHref}?${query.toString()}`;
};

export const getMusicRecommenderHref = (): string | null => {
  const baseUrl = getToolsSiteBaseUrl();
  return baseUrl ? `${baseUrl}/music-recommender` : null;
};
