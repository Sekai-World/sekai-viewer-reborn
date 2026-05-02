export type EventListItem = {
  id: string;
  title: string;
  eventType: string | null;
  unit: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
};

export type EventListPagination = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export type EventListPage = {
  items: EventListItem[];
  pagination: EventListPagination;
};

export const DEFAULT_EVENT_LIST_PAGE_SIZE = 20;

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
  return normalizedUnit === "none" || normalizedUnit === "-" ? "mixed" : normalizedUnit;
};

const parseEventListItem = (payload: unknown): EventListItem | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const eventNode = getNestedObject(root, ["event", "data"]) ?? root;
  const unitNode = getNestedObject(eventNode, ["unit"]);
  const id = pickFirstStringLike(eventNode, ["id", "eventId"]);
  const title = pickFirstString(eventNode, ["name", "title", "eventName"]);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    eventType: pickFirstString(eventNode, ["eventType", "event_type"]),
    unit: normalizeUnitCode(pickFirstString(unitNode ?? eventNode, ["unit"])),
    assetBundleName: pickFirstString(eventNode, ["assetbundleName", "assetBundleName"]),
    startAt: pickFirstDateValue(eventNode, ["startAt", "start_at", "startDate"])
  };
};

const parsePagination = (
  payload: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
  itemCount: number
): EventListPagination => {
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

export const parseEventListPage = (
  payload: unknown,
  page: number,
  pageSize: number
): EventListPage => {
  const root = getObject(payload);
  const itemsSource =
    (root &&
      (getNestedArray(root, ["items", "events"]) ??
        getNestedArray(getNestedObject(root, ["data"]) ?? {}, ["items", "events"]))) ??
    [];
  const items = itemsSource
    .map(parseEventListItem)
    .filter((item): item is EventListItem => item !== null);

  return {
    items,
    pagination: parsePagination(payload, page, pageSize, items.length)
  };
};
