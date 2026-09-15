export const getString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
};

export const getStringPreservingWhitespace = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  return getString(value) === null ? null : value;
};

export const getStringLikePreservingWhitespace = (value: unknown): string | null => {
  if (typeof value === "string") {
    return getStringPreservingWhitespace(value);
  }

  return getStringLike(value);
};

export const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

export const getDateValuePreservingWhitespace = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getStringPreservingWhitespace(value);
};

export const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const pickFirstValue = <T>(
  source: Record<string, unknown>,
  keys: readonly string[],
  parseValue: (value: unknown) => T | null
): T | null => {
  for (const key of keys) {
    const value = parseValue(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

export const pickFirstObject = (
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null => pickFirstValue(source, keys, getObject);

export const pickFirstNumber = (
  source: Record<string, unknown>,
  keys: readonly string[]
): number | null => pickFirstValue(source, keys, getNumber);

export const pickFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => pickFirstValue(source, keys, getString);

export const pickFirstStringLike = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => pickFirstValue(source, keys, getStringLike);

export const pickFirstStringPreservingWhitespace = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => pickFirstValue(source, keys, getStringPreservingWhitespace);

export const pickFirstStringLikePreservingWhitespace = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => pickFirstValue(source, keys, getStringLikePreservingWhitespace);

export const pickFirstDateValue = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | number | null => pickFirstValue(source, keys, getDateValue);

export const pickFirstDateValuePreservingWhitespace = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | number | null => pickFirstValue(source, keys, getDateValuePreservingWhitespace);
