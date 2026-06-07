import {
  getUnitProfilesByRegionList,
  getVersionsByRegion
} from "@platform/sekai-master-api-sdk";
import { formatUnitFallbackLabel } from "$lib/unit-profile";
export {
  formatUnitFallbackLabel,
  musicTagByUnitCode,
  UNIT_CODE_ORDER,
  unitCodeByMusicTag
} from "$lib/unit-profile";

export type UnitProfile = {
  unit: string;
  unitName: string;
};

export type UnitProfileMap = Record<string, string>;

type UnitProfileCacheEntry = {
  items: UnitProfile[];
  promise?: Promise<UnitProfile[]>;
  versionKey: string | null;
};

const unitProfileCache = new Map<string, UnitProfileCacheEntry>();

const getStringLike = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const parseUnitProfile = (payload: unknown): UnitProfile | null => {
  if (payload === null || typeof payload !== "object") {
    return null;
  }

  const root = payload as Record<string, unknown>;
  const unit = getStringLike(root.unit);
  const unitName = getStringLike(root.unitName);

  return unit && unitName ? { unit, unitName } : null;
};

export const getUnitName = (
  unitProfiles: UnitProfileMap,
  unit: string | null | undefined,
  mixedUnitLabel = "Mixed"
): string | null => {
  if (!unit) {
    return null;
  }

  const normalizedUnit = unit.trim().toLowerCase();
  if (normalizedUnit === "none" || normalizedUnit === "-") {
    return mixedUnitLabel;
  }

  return unitProfiles[normalizedUnit] ?? formatUnitFallbackLabel(normalizedUnit);
};

export const toUnitProfileMap = (items: readonly UnitProfile[]): UnitProfileMap =>
  items.reduce<UnitProfileMap>((accumulator, item) => {
    accumulator[item.unit] = item.unitName;
    return accumulator;
  }, {});

const getUnitProfileVersionKey = async (
  baseUrl: string,
  region: string
): Promise<string | null> => {
  const response = await getVersionsByRegion({
    baseUrl,
    path: { region }
  });

  if (response.error) {
    return null;
  }

  const { dataVersion, appVersion, assetVersion, cdnVersion } = response.data ?? {};
  if (dataVersion) {
    return dataVersion;
  }

  return [appVersion, assetVersion, cdnVersion].filter((value) => value !== undefined).join("|");
};

const fetchUnitProfilesForCache = async (
  baseUrl: string,
  region: string,
  key: string,
  versionKey: string | null
): Promise<UnitProfile[]> => {
  const response = await getUnitProfilesByRegionList({
    baseUrl,
    path: { region },
    query: {
      page: 1,
      page_size: 100,
      sort_by: "id",
      sort_order: "asc"
    }
  });

  if (response.error) {
    return unitProfileCache.get(key)?.items ?? [];
  }

  const items = (response.data?.items ?? [])
    .map(parseUnitProfile)
    .filter((item): item is UnitProfile => item !== null);

  unitProfileCache.set(key, {
    items,
    versionKey
  });

  return items;
};

export const fetchUnitProfiles = async (
  baseUrl: string,
  region: string
): Promise<UnitProfile[]> => {
  const key = `${baseUrl}|${region}`;
  const cached = unitProfileCache.get(key);
  const versionKey = await getUnitProfileVersionKey(baseUrl, region).catch(() => null);

  if (cached && versionKey !== null && cached.versionKey === versionKey) {
    return cached.items;
  }

  if (cached && versionKey === null) {
    return cached.items;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = fetchUnitProfilesForCache(baseUrl, region, key, versionKey).finally(() => {
    const latest = unitProfileCache.get(key);
    if (latest?.promise === promise) {
      delete latest.promise;
    }
  });
  unitProfileCache.set(key, {
    items: cached?.items ?? [],
    promise,
    versionKey
  });

  return promise;
};
