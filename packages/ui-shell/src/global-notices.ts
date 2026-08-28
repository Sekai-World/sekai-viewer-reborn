import type {
  GlobalNotice,
  GlobalNoticeAction,
  GlobalNoticeSeverity
} from "./global-notification-banner.types";

const NOTICE_SEVERITIES: ReadonlySet<GlobalNoticeSeverity> = new Set([
  "info",
  "success",
  "warning",
  "error"
]);

const ACTION_TARGETS: ReadonlySet<string> = new Set([
  "_blank",
  "_self",
  "_parent",
  "_top"
]);

/** Type guard: only plain objects (not arrays or null) pass. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

// Precompiled matcher for ASCII C0 control characters (U+0000–U+001F) and DEL
// (U+007F). The control characters are intentional defense-in-depth here, so the
// `no-control-regex` rule is disabled for this one expression.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = new RegExp("[\\u0000-\\u001f\\u007f]");

/**
 * Returns true for href values that are safe to render as a link target.
 *
 * Allowed values:
 * - Relative references (path, "/", "./", "../", "#", "?", or a bare path
 *   segment) which carry no scheme.
 * - Absolute `http:` / `https:` URLs (scheme matched case-insensitively).
 *
 * Rejected values (defense in depth for persisted or legacy API records that
 * may carry an executable payload in `action.href`):
 * - Any scheme other than http/https (e.g. `javascript:`, `data:`,
 *   `vbscript:`, `mailto:`, `ftp:`).
 * - Protocol-relative URLs beginning with `//`, which inherit the page's
 *   scheme and can point at an arbitrary external host.
 * - Values containing a backslash. Some URL parsers normalize backslashes to
 *   forward slashes, so `"\/\/host"` or `"\host\path"` can resolve to a
 *   protocol-relative or external URL; backslashes never appear in legitimate
 *   relative or http/https hrefs.
 * - Scheme-like tokens with embedded whitespace/control characters
 *   (e.g. `java<tab>script:`), which browsers may still treat as a scheme.
 */
export const isSafeHref = (href: unknown): boolean => {
  if (typeof href !== "string") {
    return false;
  }
  const trimmed = href.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Reject ASCII C0 control characters (U+0000–U+001F) and DEL (U+007F).
  // Browser URL parsing can normalize embedded control characters (e.g. tab,
  // newline, carriage return) into host/path separators, leaking to an
  // external or protocol-relative host even inside an otherwise-relative path.
  if (CONTROL_CHAR_RE.test(trimmed)) {
    return false;
  }

  // Backslashes are never valid in a relative or http/https href and can be
  // normalized to "/" by some parsers, leaking to an external host.
  if (trimmed.includes("\\")) {
    return false;
  }

  // Protocol-relative URLs ("//host/path") inherit the page scheme.
  if (trimmed.startsWith("//")) {
    return false;
  }

  // Detect a scheme as the token before the first ":" that occurs before any
  // "/", "?", or "#". A colon inside an authority/path/query (e.g. a port) is
  // not a scheme separator. Without a scheme the reference is relative.
  const schemeEnd = trimmed.indexOf(":");
  if (schemeEnd !== -1) {
    const beforeColon = trimmed.slice(0, schemeEnd);
    if (beforeColon.includes("/") || beforeColon.includes("?") || beforeColon.includes("#")) {
      return true;
    }
    const scheme = beforeColon.toLowerCase();
    return scheme === "http" || scheme === "https";
  }

  return true;
};

/**
 * Normalizes the optional `action` object of a global notice. Returns
 * undefined when the action is absent, null, or missing required fields so the
 * notice still renders without its action.
 */
const normalizeAction = (value: unknown): GlobalNoticeAction | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const label = value.label;
  const href = value.href;
  if (!isNonEmptyString(label) || !isNonEmptyString(href) || !isSafeHref(href)) {
    return undefined;
  }

  const action: GlobalNoticeAction = { label, href };
  if (typeof value.target === "string" && ACTION_TARGETS.has(value.target)) {
    action.target = value.target as GlobalNoticeAction["target"];
  }
  if (typeof value.rel === "string" && value.rel.trim().length > 0) {
    action.rel = value.rel;
  }

  return action;
};

/**
 * Normalizes one sekai-api notification object into the frontend `GlobalNotice`
 * shape. Entries missing required fields or carrying invalid types are dropped
 * (returns null) instead of failing the whole feed.
 */
export const normalizeGlobalNotice = (value: unknown): GlobalNotice | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { id, version, severity, title, message } = value;
  if (!isNonEmptyString(id)) {
    return null;
  }
  if (typeof version !== "string" && typeof version !== "number") {
    return null;
  }
  if (!NOTICE_SEVERITIES.has(severity as GlobalNoticeSeverity)) {
    return null;
  }
  if (!isNonEmptyString(title) || !isNonEmptyString(message)) {
    return null;
  }

  const notice: GlobalNotice = {
    id,
    version,
    severity: severity as GlobalNoticeSeverity,
    title,
    message
  };

  const action = normalizeAction(value.action);
  if (action !== undefined) {
    notice.action = action;
  }
  if (typeof value.dismissible === "boolean") {
    notice.dismissible = value.dismissible;
  }

  return notice;
};

/**
 * Unwraps the sekai-api response envelope (`{ status: "success", data: [...] }`)
 * and normalizes every entry. Invalid envelopes or malformed entries yield an
 * empty list so a broken feed never breaks page rendering.
 */
export const parseGlobalNoticesPayload = (payload: unknown): readonly GlobalNotice[] => {
  if (!isRecord(payload) || payload.status !== "success" || !Array.isArray(payload.data)) {
    return [];
  }

  const notices: GlobalNotice[] = [];
  for (const entry of payload.data) {
    const notice = normalizeGlobalNotice(entry);
    if (notice !== null) {
      notices.push(notice);
    }
  }

  return notices;
};

/**
 * Removes every trailing slash from a base URL without using a regular
 * expression (which would risk super-linear backtracking). Returns the original
 * string when no trailing slash is present, or an empty string when only
 * slashes are present so callers can treat the value as unconfigured.
 */
export const stripTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 47 /* "/" */) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
};

export const NOTIFICATION_FETCH_TIMEOUT_MS = 3_000;

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

export { fetchWithTimeout };

/**
 * Fetches active global notifications from the sekai-api `/notifications`
 * endpoint and normalizes them into the frontend `GlobalNotice` shape. Any
 * failure (null base URL, network error, non-OK status, or an invalid envelope)
 * resolves to an empty list so root layouts always render.
 */
export const fetchGlobalNotices = async (
  baseUrl: string | null,
  fetcher: typeof fetch = fetch
): Promise<readonly GlobalNotice[]> => {
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
