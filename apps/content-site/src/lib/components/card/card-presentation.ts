import { getCardThumbnailAssetURL } from "$lib/assets/index";
import type { SupportedRegion } from "$lib/domain/regions";
import { resolveCardTrained, type CardTrainingMetadata } from "@platform/ui-shell/card-thumbnail";

export type { CardTrainingMetadata } from "@platform/ui-shell/card-thumbnail";
export { isTrainedOnlyCard, resolveCardTrained } from "@platform/ui-shell/card-thumbnail";

export const getCardThumbnailPresentation = (
  card: CardTrainingMetadata & { assetBundleName: string | null },
  region: SupportedRegion,
  selectedTrained = false
): { src: string | null; fallbackSrc: string | null; trained: boolean } => {
  const trained = resolveCardTrained(card, selectedTrained);
  return {
    src: card.assetBundleName
      ? getCardThumbnailAssetURL(card.assetBundleName, trained, "jp")
      : null,
    fallbackSrc:
      card.assetBundleName && region !== "jp"
        ? getCardThumbnailAssetURL(card.assetBundleName, trained, region)
        : null,
    trained
  };
};
