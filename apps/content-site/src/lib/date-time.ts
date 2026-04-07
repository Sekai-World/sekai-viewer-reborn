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
