const CANONICAL_ID = /^[1-9]\d*$/;

/**
 * Parses a numeric id taken from a route segment. Only the canonical decimal
 * form of a positive safe integer is accepted, so one record answers on one
 * URL: `0x10`, `1e2`, `0180` and ` 1` are all rejected instead of being
 * coerced to another id.
 */
export const parseRouteId = (value: string | undefined): number | null => {
  if (value === undefined || !CANONICAL_ID.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};
