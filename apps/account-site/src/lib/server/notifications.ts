import { env } from "$env/dynamic/private";
import type { GlobalNotice } from "@platform/ui-shell";
import {
  fetchGlobalNotices as sharedFetchGlobalNotices,
  stripTrailingSlashes
} from "@platform/ui-shell/global-notices";

const resolveBaseUrl = (): string | null => {
  const value = env.SEKAI_API_BASE_URL?.trim();
  if (!value) {
    return null;
  }

  const normalized = stripTrailingSlashes(value);
  return normalized.length > 0 ? normalized : null;
};

/**
 * Fetches active global notifications from the sekai-api `/notifications`
 * endpoint and normalizes them into the frontend `GlobalNotice` shape. Any
 * failure (unconfigured base URL, network error, non-OK status, or an invalid
 * envelope) resolves to an empty list so root layouts always render.
 */
export const fetchGlobalNotices = (
  fetcher: typeof fetch = fetch
): Promise<readonly GlobalNotice[]> => sharedFetchGlobalNotices(resolveBaseUrl(), fetcher);
