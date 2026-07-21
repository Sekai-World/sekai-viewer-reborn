import type { CharacterRelatedCard } from "$lib/domain/character";
import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

export const parseRelatedCharacterCards = (payload: unknown): CharacterRelatedCard[] => {
  const root = getObject(payload);
  const data = getObject(root?.data);
  const items = Array.isArray(root?.items)
    ? root.items
    : Array.isArray(data?.items)
      ? data.items
      : [];
  return items
    .map((raw): CharacterRelatedCard | null => {
      const node = getObject(raw);
      const id = getString(node?.id);
      if (!node || !id) return null;
      const rarity = getObject(node.cardRarity);
      return {
        id,
        prefix: getString(node.prefix),
        assetBundleName: getString(node.assetbundleName) ?? getString(node.assetBundleName),
        attr: getString(node.attr),
        rarityType: getString(rarity?.cardRarityType),
        initialSpecialTrainingStatus: getString(node.initialSpecialTrainingStatus)
      };
    })
    .filter((item): item is CharacterRelatedCard => item !== null);
};

export const normalizeCharacterAvailability = (payload: unknown): string[] => {
  const toSupportedRegionList = (value: unknown): SupportedRegion[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (region): region is SupportedRegion =>
        typeof region === "string" && supportedRegions.includes(region as SupportedRegion)
    );
  };

  const toSupportedRegionMap = (value: unknown): SupportedRegion[] => {
    const record = getObject(value);
    if (!record) {
      return [];
    }

    return supportedRegions.filter((region) => {
      const regionValue = record[region];
      if (regionValue === true) {
        return true;
      }

      const nested = getObject(regionValue);
      return nested?.available === true || nested?.exists === true;
    });
  };

  const fromRootArray = toSupportedRegionList(payload);
  if (fromRootArray.length > 0) {
    return fromRootArray;
  }

  const root = getObject(payload);
  if (!root) {
    return [];
  }

  for (const key of ["availableRegions", "regions"]) {
    const regions = toSupportedRegionList(root[key]);
    if (regions.length > 0) {
      return regions;
    }
  }

  for (const key of ["availability", "availableRegions", "regions"]) {
    const regions = toSupportedRegionMap(root[key]);
    if (regions.length > 0) {
      return regions;
    }
  }

  const dataNode = getObject(root.data);
  if (dataNode) {
    return normalizeCharacterAvailability(dataNode);
  }

  return [];
};
