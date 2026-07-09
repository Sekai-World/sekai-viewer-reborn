type CharacterColorCode = `#${string}`;

const characterColorById = {
  1: "#33aaee",
  2: "#ffdd44",
  3: "#ee6666",
  4: "#bbdd22",
  5: "#ffccaa",
  6: "#99ccff",
  7: "#ffaacc",
  8: "#99eedd",
  9: "#ff6699",
  10: "#00bbdd",
  11: "#ff7722",
  12: "#0077dd",
  13: "#ffbb00",
  14: "#ff66bb",
  15: "#33dd99",
  16: "#bb88ee",
  17: "#bb6688",
  18: "#8888cc",
  19: "#ccaa88",
  20: "#ddaacc",
  21: "#33ccbb",
  22: "#ffcc11",
  23: "#ffee11",
  24: "#ffbbcc",
  25: "#dd4444",
  26: "#3366cc"
} as const satisfies Record<number, CharacterColorCode>;

export type GameCharacterColorId = keyof typeof characterColorById;

const isGameCharacterColorId = (value: number): value is GameCharacterColorId =>
  Number.isInteger(value) && value in characterColorById;

const normalizeCharacterId = (characterId: string | number | null | undefined): number | null => {
  if (typeof characterId === "number") {
    return Number.isFinite(characterId) ? characterId : null;
  }

  const normalizedId = characterId?.trim() ?? "";
  if (normalizedId.length === 0) {
    return null;
  }

  const numericId = Number(normalizedId);
  return Number.isFinite(numericId) ? numericId : null;
};

export const getStaticCharacterColor = (
  characterId: string | number | null | undefined
): CharacterColorCode | null => {
  const normalizedId = normalizeCharacterId(characterId);
  return normalizedId !== null && isGameCharacterColorId(normalizedId)
    ? characterColorById[normalizedId]
    : null;
};
