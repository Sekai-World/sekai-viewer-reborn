import type { GlobalNotice } from "@platform/ui-shell";
import { fetchGlobalNotices as sharedFetchGlobalNotices } from "@platform/ui-shell/global-notices";
import { getSekaiApiBaseUrl } from "./config";

const resolveBaseUrl = (): string | null => {
  try {
    return getSekaiApiBaseUrl();
  } catch {
    // Notifications are best-effort: an unconfigured sekai-api must not break
    // root layout loading.
    return null;
  }
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
