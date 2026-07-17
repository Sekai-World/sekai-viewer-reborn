import type { CharacterRelatedCard } from "$lib/domain/character";

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
  const root = getObject(payload);
  return Array.isArray(root?.regions)
    ? root.regions.filter((region): region is string => typeof region === "string")
    : [];
};
