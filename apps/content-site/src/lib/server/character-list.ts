import type { CharacterCatalogueItem, CharacterUnit } from "$lib/domain/character";
import { formatCharacterName } from "$lib/domain/character";

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const getNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getItems = (payload: unknown): unknown[] => {
  const root = getObject(payload);
  if (Array.isArray(root?.items)) return root.items;
  const data = getObject(root?.data);
  return Array.isArray(data?.items) ? data.items : [];
};

export const parseCharacterUnits = (payload: unknown): CharacterUnit[] =>
  getItems(payload)
    .map((raw): CharacterUnit | null => {
      const node = getObject(raw);
      const gameCharacterId = getString(node?.gameCharacterId);
      if (!node || !gameCharacterId) return null;
      return {
        id: getString(node.id),
        gameCharacterId,
        unit: getString(node.unit),
        colorCode: getString(node.colorCode)
      };
    })
    .filter((item): item is CharacterUnit => item !== null);

export const parseCharacter = (
  payload: unknown,
  units: readonly CharacterUnit[]
): CharacterCatalogueItem | null => {
  const node = getObject(payload);
  const id = getString(node?.id);
  if (!node || !id) return null;
  const firstName = getString(node.firstName);
  const givenName = getString(node.givenName);
  const unit = getString(node.unit);
  const matchingUnits = units.filter((item) => item.gameCharacterId === id);
  const unitRecord = matchingUnits.find((item) => item.unit === unit) ?? matchingUnits[0] ?? null;
  return {
    id,
    firstName,
    givenName,
    name: formatCharacterName(firstName, givenName, id),
    height: getNumber(node.height),
    seq: getNumber(node.seq),
    unit: unit ?? unitRecord?.unit ?? null,
    unitRecord
  };
};

export const parseCharacterList = (
  payload: unknown,
  units: readonly CharacterUnit[]
): CharacterCatalogueItem[] =>
  getItems(payload)
    .map((item) => parseCharacter(item, units))
    .filter((item): item is CharacterCatalogueItem => item !== null)
    .sort(
      (left, right) =>
        (left.seq ?? Number.MAX_SAFE_INTEGER) - (right.seq ?? Number.MAX_SAFE_INTEGER)
    );
