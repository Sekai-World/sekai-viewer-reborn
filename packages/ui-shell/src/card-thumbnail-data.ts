/**
 * Pure presentation helpers shared by card artwork UI. Kept free of asset
 * imports so server-side code and node-env tests can use it through the
 * `@platform/ui-shell/card-thumbnail` subpath.
 */

export interface CardTrainingMetadata {
  /** `rarity_1`…`rarity_4` or `rarity_birthday`. */
  rarityType: string | null;
  /** `"done"` marks cards whose only artwork is the trained variant. */
  initialSpecialTrainingStatus?: string | null;
}

export const isTrainedOnlyCard = (card: CardTrainingMetadata): boolean =>
  (card.rarityType === "rarity_3" || card.rarityType === "rarity_4") &&
  card.initialSpecialTrainingStatus === "done";

/** Only trained-only cards override the caller's selected artwork state. */
export const resolveCardTrained = (card: CardTrainingMetadata, trained = false): boolean =>
  isTrainedOnlyCard(card) || trained;

/**
 * Number of rarity stars a card shows: 1–4 for the regular rarities,
 * 1 for birthday cards, 0 when the type is unknown.
 */
export const resolveCardRarityCount = (rarityType: string | null): number => {
  if (rarityType === "rarity_birthday") {
    return 1;
  }

  const match = /^rarity_([1-4])$/.exec(rarityType ?? "");
  return match ? Number(match[1]) : 0;
};
