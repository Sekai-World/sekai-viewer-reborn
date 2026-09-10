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
