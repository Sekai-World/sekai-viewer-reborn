import {
  getNumber,
  getObject as getResponseObject,
  getPositiveInteger,
  getString
} from "./response-values";

export { getNumber, getPositiveInteger, getString };

export type CatalogueName = "Honor" | "Mission";

export type CataloguePagination = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export type CataloguePaginationMetadata = {
  reportedPage: number | null;
  reportedPageSize: number | null;
  total: number | null;
  totalPages: number | null;
  hasNext: boolean | null;
};

const MASTER_API_PATH_PREFIX = "/api/v1";

export const getMasterApiV1BaseUrl = (baseUrl: string): string => {
  let end = baseUrl.length;
  while (end > 0 && baseUrl.charCodeAt(end - 1) === 47) {
    end -= 1;
  }

  const normalizedBaseUrl = baseUrl.slice(0, end);
  return normalizedBaseUrl.endsWith(MASTER_API_PATH_PREFIX)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}${MASTER_API_PATH_PREFIX}`;
};

export const getObject = (value: unknown): Record<string, unknown> | null =>
  Array.isArray(value) ? null : getResponseObject(value);

export const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const getBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

export const getItems = (payload: unknown): unknown[] | null => {
  const root = getObject(payload);
  if (Array.isArray(root?.items)) {
    return root.items;
  }

  const data = getObject(root?.data);
  return Array.isArray(data?.items) ? data.items : null;
};

const isAsciiDigitString = (value: string): boolean => {
  if (value.length === 0) {
    return false;
  }

  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 48 || code > 57) {
      return false;
    }
  }

  return true;
};

export const parsePositivePage = (value: string | null): number => {
  const normalized = value?.trim() ?? "";
  if (!isAsciiDigitString(normalized)) {
    return 1;
  }

  const page = Number(normalized);
  if (!Number.isSafeInteger(page) || page <= 0) {
    return 1;
  }

  return page;
};

const getCatalogueLabel = (catalogueName: CatalogueName): string => `${catalogueName} catalogue`;

const getPaginationObject = (
  payload: unknown,
  catalogueName: CatalogueName
): Record<string, unknown> | null => {
  const root = getObject(payload);
  const data = getObject(root?.data);
  const value = root?.pagination ?? data?.pagination;

  if (value === null || value === undefined) {
    return null;
  }

  const pagination = getObject(value);
  if (!pagination) {
    throw new TypeError(
      `${getCatalogueLabel(catalogueName)} returned invalid pagination metadata.`
    );
  }

  return pagination;
};

const getOptionalField = (
  source: Record<string, unknown> | null,
  keys: readonly string[]
): unknown => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    if (Object.hasOwn(source, key)) {
      const value = source[key];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
  }

  return null;
};

const parseOptionalInteger = (
  value: unknown,
  name: string,
  minimum: 0 | 1,
  catalogueName: CatalogueName
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  let parsed = Number.NaN;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && value.trim().length > 0) {
    parsed = Number(value);
  }

  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new TypeError(`${getCatalogueLabel(catalogueName)} returned an invalid ${name}.`);
  }

  return parsed;
};

const parseOptionalBoolean = (value: unknown, catalogueName: CatalogueName): boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new TypeError(`${getCatalogueLabel(catalogueName)} returned an invalid has-next value.`);
  }

  return value;
};

export const parseCataloguePaginationMetadata = (
  payload: unknown,
  catalogueName: CatalogueName
): CataloguePaginationMetadata => {
  const pagination = getPaginationObject(payload, catalogueName);

  return {
    reportedPage: parseOptionalInteger(
      getOptionalField(pagination, ["page"]),
      "page",
      1,
      catalogueName
    ),
    reportedPageSize: parseOptionalInteger(
      getOptionalField(pagination, ["page_size", "pageSize"]),
      "page size",
      1,
      catalogueName
    ),
    total: parseOptionalInteger(getOptionalField(pagination, ["total"]), "total", 0, catalogueName),
    totalPages: parseOptionalInteger(
      getOptionalField(pagination, ["total_pages", "totalPages"]),
      "total pages",
      0,
      catalogueName
    ),
    hasNext: parseOptionalBoolean(
      getOptionalField(pagination, ["has_next", "hasNext"]),
      catalogueName
    )
  };
};

export const validateCataloguePageRequest = (
  metadata: CataloguePaginationMetadata,
  requestedPage: number,
  pageSize: number,
  itemCount: number,
  catalogueName: CatalogueName
): void => {
  const label = getCatalogueLabel(catalogueName);
  if (metadata.reportedPage !== null && metadata.reportedPage !== requestedPage) {
    throw new Error(
      `${label} returned page ${metadata.reportedPage} for requested page ${requestedPage}.`
    );
  }

  if (metadata.reportedPageSize !== null && metadata.reportedPageSize !== pageSize) {
    throw new Error(`${label} returned a page with an unexpected page size.`);
  }

  if (itemCount > pageSize) {
    throw new Error(`${label} returned more items than the requested page size.`);
  }
};

export const getCatalogueHasNext = (
  metadata: CataloguePaginationMetadata,
  requestedPage: number,
  pageSize: number,
  itemCount: number,
  catalogueName: CatalogueName
): boolean => {
  let hasNext: boolean;
  if (metadata.hasNext !== null) {
    hasNext = metadata.hasNext;
  } else if (metadata.totalPages !== null) {
    hasNext = requestedPage < metadata.totalPages;
  } else {
    hasNext = itemCount >= pageSize;
  }

  if (
    metadata.hasNext !== null &&
    metadata.totalPages !== null &&
    hasNext !== requestedPage < metadata.totalPages
  ) {
    throw new Error(
      `${getCatalogueLabel(catalogueName)} returned inconsistent pagination metadata.`
    );
  }

  return hasNext;
};

export const validateCataloguePageContent = (
  total: number | null,
  requestedPage: number,
  pageSize: number,
  itemCount: number,
  hasNext: boolean,
  catalogueName: CatalogueName
): number => {
  const label = getCatalogueLabel(catalogueName);
  if (hasNext && itemCount !== pageSize) {
    throw new Error(`${label} returned an incomplete page while reporting another page.`);
  }

  const offset = (requestedPage - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) {
    throw new Error(`${label} page is outside the supported range.`);
  }

  if (total !== null) {
    validateCatalogueTotalCount(total, offset, pageSize, itemCount, hasNext, label);
  }

  return offset;
};

const validateCatalogueTotalCount = (
  total: number,
  offset: number,
  pageSize: number,
  itemCount: number,
  hasNext: boolean,
  label: string
): void => {
  if (offset > total) {
    if (itemCount > 0 || hasNext) {
      throw new Error(`${label} returned items beyond its reported total.`);
    }
    return;
  }

  const expectedItemCount = Math.min(pageSize, total - offset);
  if (itemCount !== expectedItemCount) {
    throw new Error(`${label} returned an incomplete page for its reported total.`);
  }
};
