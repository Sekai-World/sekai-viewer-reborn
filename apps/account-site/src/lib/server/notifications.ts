import { env } from "$env/dynamic/private";
import type { GlobalNotice } from "@platform/ui-shell";
import { parseGlobalNoticesPayload } from "$lib/global-notices";

const NOTIFICATION_FETCH_TIMEOUT_MS = 3_000;

const readSekaiApiBaseUrl = (): string | null => {
  const value = env.SEKAI_API_BASE_URL?.trim();
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : null;
};

const fetchWithTimeout = (url: string, fetcher: typeof fetch): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOTIFICATION_FETCH_TIMEOUT_MS);
  if (typeof timeout === "object" && "unref" in timeout) {
    timeout.unref();
  }

  const request = fetcher(url, {
    headers: { accept: "application/json" },
    signal: controller.signal
  });

  return request.finally(() => clearTimeout(timeout));
};

/**
 * Fetches active global notifications from the sekai-api `/notifications`
 * endpoint and normalizes them into the frontend `GlobalNotice` shape. Any
 * failure (unconfigured base URL, network error, non-OK status, or an invalid
 * envelope) resolves to an empty list so root layouts always render.
 */
export const fetchGlobalNotices = async (
  fetcher: typeof fetch = fetch
): Promise<readonly GlobalNotice[]> => {
  const baseUrl = readSekaiApiBaseUrl();
  if (baseUrl === null) {
    return [];
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/notifications`, fetcher);
    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    return parseGlobalNoticesPayload(payload);
  } catch {
    return [];
  }
};