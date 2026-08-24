type RecordLike = Record<string, unknown>;

export type UnitDetail = {
  unit: string;
  unitName: string;
  profileName: string | null;
  profileSentence: string | null;
  colorCode: string | null;
};

export type UnitMember = {
  id: string | null;
  gameCharacterId: number;
  unit: string | null;
  colorCode: string | null;
  firstName: string | null;
  givenName: string | null;
  firstNameEnglish: string | null;
  givenNameEnglish: string | null;
  resourceId: string | null;
};

const asRecord = (value: unknown): RecordLike | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordLike)
    : null;

const asString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const asPositiveInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

export const parseUnitDetail = (payload: unknown): UnitDetail | null => {
  const root = asRecord(payload);
  if (!root) return null;
  const unit = asString(root.unit);
  const unitName = asString(root.unitName);
  if (!unit || !unitName) return null;

  return {
    unit: unit.toLowerCase(),
    unitName,
    profileName: asString(root.profileName ?? root.unitProfileName),
    profileSentence: asString(root.profileSentence),
    colorCode: asString(root.colorCode)
  };
};

const parseUnitMember = (payload: unknown): UnitMember | null => {
  const root = asRecord(payload);
  if (!root) return null;
  const gameCharacterId = asPositiveInteger(root.gameCharacterId);
  if (!gameCharacterId) return null;

  return {
    id: asString(root.id),
    gameCharacterId,
    unit: asString(root.unit)?.toLowerCase() ?? null,
    colorCode: asString(root.colorCode),
    firstName: asString(root.firstName),
    givenName: asString(root.givenName),
    firstNameEnglish: asString(root.firstNameEnglish),
    givenNameEnglish: asString(root.givenNameEnglish),
    resourceId: asString(root.resourceId)
  };
};

export const parseUnitMembers = (payload: unknown): UnitMember[] => {
  const root = asRecord(payload);
  const items = Array.isArray(root?.items) ? root.items : [];
  return items
    .map(parseUnitMember)
    .filter((member): member is UnitMember => member !== null)
    .sort((left, right) => left.gameCharacterId - right.gameCharacterId);
};
