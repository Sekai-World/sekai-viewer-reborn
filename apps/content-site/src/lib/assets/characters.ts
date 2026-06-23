import { asset } from "$app/paths";

export const getLocalCharacterThumbnailAssetURL = (
  characterId: string | number | null | undefined
): string | null => {
  if (typeof characterId === "number") {
    return Number.isFinite(characterId) ? asset(`/chr_ts/chr_ts_${characterId}_g1.png`) : null;
  }

  const normalizedId = characterId?.trim() ?? "";
  if (!/^\d+$/.test(normalizedId)) {
    return null;
  }

  return asset(`/chr_ts/chr_ts_${normalizedId}_g1.png`);
};
