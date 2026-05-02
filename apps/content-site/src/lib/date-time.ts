import { normalizeUiLocale } from "$lib/region";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (localeValue: string): Intl.DateTimeFormat => {
  const locale = normalizeUiLocale(localeValue);
  const cached = formatterCache.get(locale);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  formatterCache.set(locale, formatter);
  return formatter;
};

export const formatDisplayDateTime = (
  value: string | number | null,
  localeValue: string
): string => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return getFormatter(localeValue).format(parsedDate);
};

export const toTimestampMs = (value: string | number | null): number | null => {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value > 1e12 ? value : value * 1000;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed > 1e12 ? parsed : parsed * 1000;
  }

  const dateValue = new Date(normalized).getTime();
  return Number.isNaN(dateValue) ? null : dateValue;
};
