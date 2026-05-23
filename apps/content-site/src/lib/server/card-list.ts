import type { GetCardsByRegionListData, SharedCardListResponse } from "@platform/sekai-master-api-sdk";
import { dev } from "$app/environment";

export type CardListItem = {
  id: string;
  prefix: string;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  characterId: number | null;
  characterName: string | null;
  unit: string | null;
  supportUnit: string | null;
  skillKey: string | null;
  cardSupplyType: string | null;
  initialSpecialTrainingStatus: string | null;
  releaseAt: string | number | null;
  archivePublishedAt: string | number | null;
  seq: string | number | null;
};

export type CardListPagination = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export type CardListPage = {
  items: CardListItem[];
  pagination: CardListPagination;
};

export type CardListFilterOption = {
  value: string;
  label: string;
};

export type CardListFilterMeta = {
  unit: CardListFilterOption[];
  character: CardListFilterOption[];
  skill: CardListFilterOption[];
  type: CardListFilterOption[];
};

export type CardListSortBy = "releaseAt" | "id";
export type CardListSortOrder = "asc" | "desc";

export type CardListQueryState = {
  sortBy: CardListSortBy;
  sortOrder: CardListSortOrder;
  name: string;
  unit: string[];
  character: string[];
  skill: string[];
  type: string[];
  attr: string[];
  rarity: string[];
  supportUnit: string[];
  has3dmvCutIn: boolean;
};

export const DEFAULT_CARD_LIST_PAGE_SIZE = 24;
export const CARD_LIST_BACKEND_PAGE_SIZE = 100;

const DEFAULT_CARD_LIST_QUERY_STATE: CardListQueryState = {
  sortBy: "releaseAt",
  sortOrder: "desc",
  name: "",
  unit: [],
  character: [],
  skill: [],
  type: [],
  attr: [],
  rarity: [],
  supportUnit: [],
  has3dmvCutIn: false
};

const getTrimmedSearchParam = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
};

const parseSortBy = (value: string | null): CardListSortBy => {
  if (value === "id") {
    return value;
  }

  return "releaseAt";
};

const parseSortOrder = (value: string | null): CardListSortOrder =>
  value === "asc" ? "asc" : "desc";

const parseMultiValueParam = (searchParams: URLSearchParams, key: string): string[] => {
  const values = searchParams.getAll(key).map((v) => v.trim()).filter((v) => v.length > 0);
  return [...new Set(values)];
};

export const parseCardListQueryState = (searchParams: URLSearchParams): CardListQueryState => ({
  sortBy: parseSortBy(searchParams.get("sort_by")),
  sortOrder: parseSortOrder(searchParams.get("sort_order")),
  name: getTrimmedSearchParam(searchParams.get("name")),
  unit: parseMultiValueParam(searchParams, "unit"),
  character: parseMultiValueParam(searchParams, "character"),
  skill: parseMultiValueParam(searchParams, "skill"),
  type: parseMultiValueParam(searchParams, "type"),
  attr: parseMultiValueParam(searchParams, "attr"),
  rarity: parseMultiValueParam(searchParams, "rarity"),
  supportUnit: parseMultiValueParam(searchParams, "support_unit"),
  has3dmvCutIn: searchParams.get("has_3dmv_cut_in") === "true"
});

export const createCardListRequestQuery = (
  queryState: CardListQueryState,
  page: number,
  pageSize: number,
  includeSpoilerContent: boolean
): GetCardsByRegionListData["query"] => {
  const query: NonNullable<GetCardsByRegionListData["query"]> = {
    page,
    page_size: pageSize,
    spoiler: includeSpoilerContent,
    sort_by: queryState.sortBy,
    sort_order: queryState.sortOrder
  };

  if (queryState.unit.length > 0) {
    query.unit = queryState.unit.join(",");
  }

  if (queryState.character.length > 0) {
    query.character = queryState.character.join(",");
  }

  if (queryState.skill.length > 0) {
    query.skill = queryState.skill.join(",");
  }

  if (queryState.type.length > 0) {
    query.type = queryState.type.join(",");
  }

  if (queryState.attr.length > 0) {
    query.attr = queryState.attr.join(",");
  }

  if (queryState.rarity.length > 0) {
    query.rarity = queryState.rarity.join(",");
  }

  if (queryState.supportUnit.length > 0) {
    query.supportUnit = queryState.supportUnit.join(",");
  }

  if (queryState.has3dmvCutIn) {
    query.has3dmvCutIn = true;
  }

  return query;
};

export const getDefaultCardListQueryState = (): CardListQueryState => ({
  ...DEFAULT_CARD_LIST_QUERY_STATE
});

export const hasCardListFilters = (queryState: CardListQueryState): boolean =>
  queryState.name.length > 0 ||
  queryState.unit.length > 0 ||
  queryState.character.length > 0 ||
  queryState.skill.length > 0 ||
  queryState.type.length > 0 ||
  queryState.attr.length > 0 ||
  queryState.rarity.length > 0 ||
  queryState.supportUnit.length > 0 ||
  queryState.has3dmvCutIn;

export const logCardListFilterDebug = (
  label: string,
  details: Record<string, unknown>
): void => {
  if (!dev) {
    return;
  }

  console.debug("[content-site:card-filter]", label, details);
};

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getNestedObject = (
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null => {
  for (const key of keys) {
    const nested = getObject(source[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const getNestedArray = (
  source: Record<string, unknown>,
  keys: readonly string[]
): unknown[] | null => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
};

const pickFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstStringLike = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstNumber = (
  source: Record<string, unknown>,
  keys: readonly string[]
): number | null => {
  for (const key of keys) {
    const value = getNumber(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const pickFirstDateValue = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | number | null => {
  for (const key of keys) {
    const value = getDateValue(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const normalizeUnitCode = (unit: string | null): string | null => {
  if (!unit) {
    return null;
  }

  const normalizedUnit = unit.trim().toLowerCase();
  return normalizedUnit === "-" ? "none" : normalizedUnit;
};

const parseCharacterName = (characterNode: Record<string, unknown> | null): string | null => {
  if (!characterNode) {
    return null;
  }

  const directName = pickFirstString(characterNode, ["name", "characterName"]);
  if (directName) {
    return directName;
  }

  const firstName = pickFirstString(characterNode, ["firstName"]);
  const givenName = pickFirstString(characterNode, ["givenName"]);
  return [firstName, givenName].filter((value): value is string => value !== null).join(" ") || null;
};

const parseSkillKey = (
  skillNode: Record<string, unknown> | null,
  cardNode: Record<string, unknown>
): string | null => {
  if (skillNode) {
    const descriptionSpriteName = pickFirstString(skillNode, [
      "descriptionSpriteName",
      "description_sprite_name"
    ]);
    const skillEffects = getNestedArray(skillNode ?? {}, ["skillEffects", "skill_effects"]);

    if (skillEffects?.length) {
      const firstEffect = getObject(skillEffects[0]);
      if (firstEffect) {
        const activateNotesJudgmentType = pickFirstString(firstEffect, [
          "activateNotesJudgmentType",
          "activate_notes_judgment_type"
        ]);
        if (activateNotesJudgmentType === "perfect") {
          return "perfect_score_up";
        }

        const skillEffectType = pickFirstString(firstEffect, ["skillEffectType", "skill_effect_type"]);
        if (skillEffectType === "score_up_condition_life") {
          return "life_score_up";
        }
      }
    }

    if (descriptionSpriteName) {
      return descriptionSpriteName;
    }
  }

  return pickFirstString(cardNode, ["cardSkillName", "card_skill_name"]);
};

const parseCardSupplyType = (cardSupplyNode: Record<string, unknown> | null): string | null => {
  if (!cardSupplyNode) {
    return null;
  }

  return pickFirstString(cardSupplyNode, ["cardSupplyType", "card_supply_type", "type"]);
};

const parseCardListItem = (payload: unknown): CardListItem | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const cardNode = getNestedObject(root, ["card", "data"]) ?? root;
  const rarityNode = getNestedObject(cardNode, ["cardRarity", "rarity"]);
  const characterNode = getNestedObject(cardNode, ["character", "gameCharacter"]);
  const skillNode = getNestedObject(cardNode, ["skill"]);
  const cardSupplyNode = getNestedObject(cardNode, ["cardSupply", "card_supply", "supply"]);
  const id = pickFirstStringLike(cardNode, ["id", "cardId"]);

  if (!id) {
    return null;
  }

  return {
    id,
    prefix: pickFirstString(cardNode, ["prefix", "name", "title"]) ?? `#${id}`,
    assetBundleName: pickFirstString(cardNode, ["assetbundleName", "assetBundleName"]),
    attr: pickFirstString(cardNode, ["attr", "attribute"]),
    rarityType: pickFirstString(rarityNode ?? cardNode, ["cardRarityType", "card_rarity_type", "rarityType"]),
    characterId:
      pickFirstNumber(characterNode ?? {}, ["gameCharacterId", "characterId", "id"]) ??
      pickFirstNumber(cardNode, ["characterId", "gameCharacterId"]),
    characterName: parseCharacterName(characterNode),
    unit: normalizeUnitCode(
      pickFirstString(characterNode ?? {}, ["unit"]) ?? pickFirstString(cardNode, ["unit"])
    ),
    supportUnit: normalizeUnitCode(pickFirstString(cardNode, ["supportUnit", "support_unit"])),
    skillKey: parseSkillKey(skillNode, cardNode),
    cardSupplyType:
      parseCardSupplyType(cardSupplyNode) ??
      pickFirstString(cardNode, ["cardSupplyType", "card_supply_type"]),
    initialSpecialTrainingStatus: pickFirstString(cardNode, [
      "initialSpecialTrainingStatus",
      "initial_special_training_status"
    ]),
    releaseAt: pickFirstDateValue(cardNode, ["releaseAt", "release_at"]),
    archivePublishedAt: pickFirstDateValue(cardNode, ["archivePublishedAt", "archive_published_at"]),
    seq: pickFirstDateValue(cardNode, ["seq"])
  };
};

const parsePagination = (
  payload: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
  itemCount: number
): CardListPagination => {
  const root = getObject(payload);
  const paginationNode =
    (root && (getNestedObject(root, ["pagination", "meta"]) ?? getNestedObject(root, ["data"]))) ??
    null;
  const page = pickFirstNumber(paginationNode ?? {}, ["page"]) ?? fallbackPage;
  const pageSize =
    pickFirstNumber(paginationNode ?? {}, ["page_size", "pageSize"]) ?? fallbackPageSize;
  const total = pickFirstNumber(paginationNode ?? {}, ["total"]);
  const totalPages = pickFirstNumber(paginationNode ?? {}, ["total_pages", "totalPages"]);
  const hasNextFlag = getBoolean((paginationNode ?? {})["has_next"]);
  const hasNext =
    hasNextFlag ??
    (totalPages !== null ? page < totalPages : pageSize > 0 && itemCount >= pageSize);

  return {
    page,
    pageSize,
    hasNext,
    total,
    totalPages
  };
};

export const parseCardListPage = (
  payload: unknown,
  page: number,
  pageSize: number
): CardListPage => {
  const root = getObject(payload);
  const itemsSource =
    (root &&
      (getNestedArray(root, ["items", "cards"]) ??
        getNestedArray(getNestedObject(root, ["data"]) ?? {}, ["items", "cards"]))) ??
    [];
  const items = itemsSource
    .map(parseCardListItem)
    .filter((item): item is CardListItem => item !== null);

  return {
    items,
    pagination: parsePagination(payload, page, pageSize, items.length)
  };
};

export const filterCardListItems = (
  items: CardListItem[],
  queryState: CardListQueryState
): CardListItem[] => {
  const lowerName = queryState.name.toLowerCase();

  return items.filter((item) => {
    if (lowerName && !item.prefix.toLowerCase().includes(lowerName)) {
      return false;
    }

    if (queryState.unit.length > 0 && (!item.unit || !queryState.unit.includes(item.unit))) {
      return false;
    }

    if (
      queryState.character.length > 0 &&
      (!item.characterId || !queryState.character.includes(String(item.characterId)))
    ) {
      return false;
    }

    if (queryState.skill.length > 0 && (!item.skillKey || !queryState.skill.includes(item.skillKey))) {
      return false;
    }

    if (
      queryState.type.length > 0 &&
      (!item.cardSupplyType || !queryState.type.includes(item.cardSupplyType))
    ) {
      return false;
    }

    if (queryState.attr.length > 0 && (!item.attr || !queryState.attr.includes(item.attr))) {
      return false;
    }

    if (
      queryState.rarity.length > 0 &&
      (!item.rarityType || !queryState.rarity.includes(item.rarityType))
    ) {
      return false;
    }

    if (
      queryState.supportUnit.length > 0 &&
      (!item.supportUnit || !queryState.supportUnit.includes(item.supportUnit))
    ) {
      return false;
    }

    return true;
  });
};

const CARD_LIST_UNIT_ORDER = [
  "light_sound",
  "idol",
  "street",
  "theme_park",
  "school_refusal",
  "piapro"
] as const;

const CARD_LIST_SKILL_ORDER = [
  "score_up",
  "judgment_up",
  "life_recovery",
  "perfect_score_up",
  "life_score_up"
] as const;

const CARD_LIST_TYPE_ORDER = [
  "normal",
  "birthday",
  "term_limited",
  "colorful_festival_limited",
  "bloom_festival_limited",
  "unit_event_limited",
  "collaboration_limited"
] as const;

const formatLabel = (value: string): string =>
  value
    .replaceAll("_", " ")
    .split(" ")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");

const toOptionList = (entries: Map<string, string>): CardListFilterOption[] =>
  [...entries.entries()].map(([value, label]) => ({ value, label }));

export const getDefaultCardListFilterMeta = (): CardListFilterMeta => ({
  unit: CARD_LIST_UNIT_ORDER.map((value) => ({ value, label: formatLabel(value) })),
  character: Array.from({ length: 26 }, (_, index) => {
    const value = String(index + 1);
    return { value, label: `Character ${value}` };
  }),
  skill: CARD_LIST_SKILL_ORDER.map((value) => ({ value, label: formatLabel(value) })),
  type: CARD_LIST_TYPE_ORDER.map((value) => ({ value, label: formatLabel(value) }))
});

export const buildCardListFilterMeta = (items: CardListItem[]): CardListFilterMeta => {
  const units = new Map<string, string>();
  const characters = new Map<string, string>();
  const skills = new Map<string, string>();
  const types = new Map<string, string>();

  for (const item of items) {
    if (item.unit && !units.has(item.unit)) {
      units.set(item.unit, formatLabel(item.unit));
    }

    if (item.characterId !== null) {
      const characterValue = String(item.characterId);
      if (!characters.has(characterValue)) {
        characters.set(characterValue, item.characterName ?? `#${characterValue}`);
      }
    }

    if (item.skillKey && !skills.has(item.skillKey)) {
      skills.set(item.skillKey, formatLabel(item.skillKey));
    }

    if (item.cardSupplyType && !types.has(item.cardSupplyType)) {
      types.set(item.cardSupplyType, formatLabel(item.cardSupplyType));
    }
  }

  const sortByOrder = (order: readonly string[], entries: Map<string, string>): CardListFilterOption[] =>
    order
      .filter((value) => entries.has(value))
      .map((value) => ({ value, label: entries.get(value) ?? formatLabel(value) }))
      .concat(
        [...entries.entries()]
          .filter(([value]) => !order.includes(value))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([value, label]) => ({ value, label }))
      );

  return {
    unit: sortByOrder(CARD_LIST_UNIT_ORDER, units),
    character: toOptionList(
      new Map([...characters.entries()].sort((left, right) => Number(left[0]) - Number(right[0])))
    ),
    skill: sortByOrder(CARD_LIST_SKILL_ORDER, skills),
    type: sortByOrder(CARD_LIST_TYPE_ORDER, types)
  };
};

export const createFilteredCardListPage = (
  filteredItems: CardListItem[],
  page: number,
  pageSize: number,
  hasMoreSourceItems: boolean
): CardListPage => {
  const offset = (page - 1) * pageSize;
  const items = filteredItems.slice(offset, offset + pageSize);
  const hasNext = filteredItems.length > offset + pageSize || hasMoreSourceItems;

  return {
    items,
    pagination: {
      page,
      pageSize,
      hasNext,
      total: null,
      totalPages: null
    }
  };
};

export type CardListFetchResponse = {
  data?: SharedCardListResponse;
  error?: unknown;
};
