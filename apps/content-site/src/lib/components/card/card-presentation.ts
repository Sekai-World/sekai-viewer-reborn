import { getCardThumbnailAssetURL } from "$lib/assets/index";
import type { SupportedRegion } from "$lib/domain/regions";

type CardTrainingMetadata = {
  rarityType: string | null;
  initialSpecialTrainingStatus?: string | null;
};

export const isTrainedOnlyCard = (card: CardTrainingMetadata): boolean =>
  (card.rarityType === "rarity_3" || card.rarityType === "rarity_4") &&
  card.initialSpecialTrainingStatus === "done";

// Only trained-only cards override the caller's selected artwork state.
export const resolveCardTrained = (card: CardTrainingMetadata, trained = false): boolean =>
  isTrainedOnlyCard(card) || trained;

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
