import type {
  GlobalNotice,
  GlobalNoticeAction,
  GlobalNoticeSeverity
} from "@platform/ui-shell";

const NOTICE_SEVERITIES: readonly GlobalNoticeSeverity[] = [
  "info",
  "success",
  "warning",
  "error"
];

const ACTION_TARGETS: readonly string[] = ["_blank", "_self", "_parent", "_top"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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
  if (!isNonEmptyString(label) || !isNonEmptyString(href)) {
    return undefined;
  }

  const action: GlobalNoticeAction = { label, href };
  if (typeof value.target === "string" && ACTION_TARGETS.includes(value.target)) {
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
  if (!NOTICE_SEVERITIES.includes(severity as GlobalNoticeSeverity)) {
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