export type CharacterUnit = {
  id: string | null;
  gameCharacterId: string;
  unit: string | null;
  colorCode: string | null;
};

export type CharacterCatalogueItem = {
  id: string;
  firstName: string | null;
  givenName: string | null;
  name: string;
  height: number | null;
  seq: number | null;
  unit: string | null;
  unitRecord: CharacterUnit | null;
};

export type CharacterRelatedCard = {
  id: string;
  prefix: string | null;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  initialSpecialTrainingStatus: string | null;
};

export type CharacterDetail = CharacterCatalogueItem & {
  unitName: string | null;
  relatedCards: CharacterRelatedCard[];
};

export const formatCharacterName = (
  firstName: string | null,
  givenName: string | null,
  fallbackId: string
): string => [firstName, givenName].filter(Boolean).join(" ") || `#${fallbackId}`;
