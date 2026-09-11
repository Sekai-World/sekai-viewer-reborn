export type Live2dCharacterType = "game_character" | "sub_game_character" | "mob";

/** Maps only the catalog's explicit character types to visible category tabs. */
export const getLive2dCharacterTypeKey = (
  characterType: string | null
): Live2dCharacterType | null => {
  if (characterType === null || characterType === "game_character") return "game_character";
  if (characterType === "sub_game_character") return "sub_game_character";
  if (characterType === "mob") return "mob";
  return null;
};

export const getLive2dCharacterGroupKey = (
  characterId: string | number | null,
  characterType: string | null
): string => {
  if (characterId === null) return "character-uncategorized";

  const typePrefix =
    characterType && characterType !== "game_character"
      ? `${encodeURIComponent(characterType)}-`
      : "";
  return `character-${typePrefix}${encodeURIComponent(String(characterId))}`;
};
