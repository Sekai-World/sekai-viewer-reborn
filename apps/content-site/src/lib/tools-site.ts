import { env } from "$env/dynamic/public";
import type { SupportedRegion } from "$lib/domain/regions";

const isTrackerSupportedRegion = (region: SupportedRegion): boolean =>
  region === "jp" || region === "tw" || region === "en" || region === "kr";

/**
 * The tools site is an optional cross-site integration. If deployment wiring
 * is not present, hide the entry point instead of making content pages fail.
 */
export const getEventTrackerHref = (
  region: SupportedRegion,
  eventId: string
): string | null => {
  if (!isTrackerSupportedRegion(region)) {
    return null;
  }

  const baseUrl = env.PUBLIC_TOOLS_SITE_BASE_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return null;
  }

  const query = new URLSearchParams({ eventId });
  return `${baseUrl}/tracker/${region}?${query.toString()}`;
};
