import type {
  GachaDetail,
  GachaPickup,
  GachaCardRarityRate,
  GachaBehavior,
  GachaDetailSub,
  GachaInformation
} from "$lib/domain/gacha-detail";

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

const getBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

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

const pickFirstBoolean = (source: Record<string, unknown>, keys: readonly string[]): boolean | null => {
  for (const key of keys) {
    const value = getBoolean(source[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const parseFloat = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const parseGachaCardRarityRates = (raw: unknown): GachaCardRarityRate[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item: unknown): GachaCardRarityRate | null => {
      const obj = getObject(item);
      if (!obj) {
        return null;
      }
      return {
        cardRarityType: pickFirstString(obj, ["cardRarityType"]),
        rate: parseFloat(obj["rate"]),
        lotteryType: pickFirstString(obj, ["lotteryType"])
      };
    })
    .filter((item): item is GachaCardRarityRate => item !== null);
};

const parseGachaBehaviors = (raw: unknown): GachaBehavior[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item: unknown): GachaBehavior | null => {
      const obj = getObject(item);
      if (!obj) {
        return null;
      }
      return {
        id: pickFirstStringLike(obj, ["id"]),
        gachaBehaviorType: pickFirstString(obj, ["gachaBehaviorType"]),
        gachaSpinnableType: pickFirstString(obj, ["gachaSpinnableType"]),
        costResourceType: pickFirstString(obj, ["costResourceType"]),
        costResourceQuantity: pickFirstNumber(obj, ["costResourceQuantity"]),
        costResourceId: pickFirstStringLike(obj, ["costResourceId"]),
        resourceCategory: pickFirstString(obj, ["resourceCategory"]),
        spinCount: pickFirstNumber(obj, ["spinCount"]),
        executeLimit: pickFirstNumber(obj, ["executeLimit"]),
        priority: pickFirstNumber(obj, ["priority"])
      };
    })
    .filter((item): item is GachaBehavior => item !== null);
};

const parseGachaDetails = (raw: unknown): GachaDetailSub[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item: unknown): GachaDetailSub | null => {
      const obj = getObject(item);
      if (!obj) {
        return null;
      }
      return {
        cardId: pickFirstStringLike(obj, ["cardId"]),
        weight: pickFirstNumber(obj, ["weight"]),
        isWish: pickFirstBoolean(obj, ["isWish"])
      };
    })
    .filter((item): item is GachaDetailSub => item !== null);
};

const parseGachaInformation = (raw: unknown): GachaInformation | null => {
  const obj = getObject(raw);
  if (!obj) {
    return null;
  }
  return {
    summary: pickFirstString(obj, ["summary"]),
    description: pickFirstString(obj, ["description"])
  };
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
    gachaPickups,
    gachaCardRarityRates: parseGachaCardRarityRates(gachaNode["gachaCardRarityRates"]),
    gachaBehaviors: parseGachaBehaviors(gachaNode["gachaBehaviors"]),
    gachaDetails: parseGachaDetails(gachaNode["gachaDetails"]),
    gachaInformation: parseGachaInformation(gachaNode["gachaInformation"]),
    gachaCeilItemId: pickFirstStringLike(gachaNode, ["gachaCeilItemId"]),
    wishFixedSelectCount: pickFirstNumber(gachaNode, ["wishFixedSelectCount"]),
    wishLimitedSelectCount: pickFirstNumber(gachaNode, ["wishLimitedSelectCount"]),
    wishSelectCount: pickFirstNumber(gachaNode, ["wishSelectCount"]),
    isShowPeriod: pickFirstBoolean(gachaNode, ["isShowPeriod"])
  };
};
