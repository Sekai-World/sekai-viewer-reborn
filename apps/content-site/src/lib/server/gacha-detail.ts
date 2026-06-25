import type { GachaDetail, GachaPickup } from "$lib/domain/gacha-detail";

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const pickFirstString = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const pickFirstStringLike = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const pickFirstNumber = (source: Record<string, unknown>, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = getNumber(source[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const pickFirstDateValue = (source: Record<string, unknown>, keys: readonly string[]): string | number | null => {
  for (const key of keys) {
    const value = getDateValue(source[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

export const parseGachaDetail = (payload: unknown): GachaDetail | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const gachaNode = getObject(root["data"]) ?? root;
  const id = pickFirstStringLike(gachaNode, ["id"]);

  if (!id) {
    return null;
  }

  const pickupsRaw = gachaNode["gachaPickups"];
  const gachaPickups: GachaPickup[] = Array.isArray(pickupsRaw)
    ? pickupsRaw
        .map((p) => {
          const pickup = getObject(p);
          if (!pickup) {
            return null;
          }
          return {
            cardId: pickFirstStringLike(pickup, ["cardId"]),
            weight: pickFirstNumber(pickup, ["weight"])
          };
        })
        .filter((p): p is GachaPickup => p !== null)
    : [];

  return {
    id,
    gachaType: pickFirstString(gachaNode, ["gachaType", "gacha_type"]),
    name: pickFirstString(gachaNode, ["name"]),
    assetBundleName: pickFirstString(gachaNode, ["assetbundleName", "assetBundleName"]),
    summary: pickFirstString(gachaNode, ["summary"]),
    startAt: pickFirstDateValue(gachaNode, ["startAt", "start_at"]),
    endAt: pickFirstDateValue(gachaNode, ["endAt", "end_at"]),
    costResourceType: pickFirstString(gachaNode, ["costResourceType", "costResourceType"]),
    costResourceId: pickFirstStringLike(gachaNode, ["costResourceId", "costResourceId"]),
    costCount: pickFirstNumber(gachaNode, ["costCount", "costCount"]),
    gachaPickups
  };
};
