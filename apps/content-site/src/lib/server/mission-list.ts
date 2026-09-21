import {
  getMissionsByRegionList,
  type GetMissionsByRegionListData
} from "@platform/sekai-master-api-sdk";
import type {
  Mission,
  MissionFamily,
  MissionResourceBox,
  MissionResourceBoxDetail,
  MissionReward
} from "$lib/domain/mission";
import { missionFamilies } from "$lib/domain/mission";

const PAGE_SIZE = 24;
const FAMILY_PAGE_SIZE = PAGE_SIZE / missionFamilies.length;
const MASTER_API_PATH_PREFIX = "/api/v1";

const getMasterApiV1BaseUrl = (baseUrl: string): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return normalizedBaseUrl.endsWith(MASTER_API_PATH_PREFIX)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}${MASTER_API_PATH_PREFIX}`;
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const getString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getPositiveInteger = (value: unknown): number | null => {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : null;

  return typeof numberValue === "number" && Number.isSafeInteger(numberValue) && numberValue > 0
    ? numberValue
    : null;
};

const getBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const getItems = (payload: unknown): unknown[] | null => {
  const root = getObject(payload);
  if (root && Array.isArray(root.items)) {
    return root.items;
  }

  const data = getObject(root?.data);
  return data && Array.isArray(data.items) ? data.items : null;
};

export type MissionListPagination = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export type MissionListPage = {
  items: Mission[];
  pagination: MissionListPagination;
};

type ApiPagination = MissionListPagination;

const getPaginationObject = (payload: unknown): Record<string, unknown> | null => {
  const root = getObject(payload);
  const data = getObject(root?.data);
  const value = root?.pagination ?? data?.pagination;

  if (value === null || value === undefined) {
    return null;
  }

  const pagination = getObject(value);
  if (!pagination) {
    throw new Error("Mission catalogue returned invalid pagination metadata.");
  }

  return pagination;
};

const getOptionalField = (source: Record<string, unknown> | null, keys: string[]): unknown => {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
  }

  return null;
};

const parseOptionalInteger = (value: unknown, name: string, allowZero: boolean): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  const minimum = allowZero ? 0 : 1;

  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`Mission catalogue returned an invalid ${name}.`);
  }

  return parsed;
};

const parseApiPagination = (
  payload: unknown,
  requestedPage: number,
  pageSize: number,
  itemCount: number
): ApiPagination => {
  const pagination = getPaginationObject(payload);
  const reportedPage = parseOptionalInteger(getOptionalField(pagination, ["page"]), "page", false);
  const reportedPageSize = parseOptionalInteger(
    getOptionalField(pagination, ["page_size", "pageSize"]),
    "page size",
    false
  );
  const total = parseOptionalInteger(getOptionalField(pagination, ["total"]), "total", true);
  let totalPages = parseOptionalInteger(
    getOptionalField(pagination, ["total_pages", "totalPages"]),
    "total pages",
    true
  );
  const hasNextValue = getOptionalField(pagination, ["has_next", "hasNext"]);

  if (reportedPage !== null && reportedPage !== requestedPage) {
    throw new Error(
      `Mission catalogue returned page ${reportedPage} for requested page ${requestedPage}.`
    );
  }

  if (reportedPageSize !== null && reportedPageSize !== pageSize) {
    throw new Error("Mission catalogue returned a page with an unexpected page size.");
  }

  if (hasNextValue !== null && typeof hasNextValue !== "boolean") {
    throw new Error("Mission catalogue returned an invalid has-next value.");
  }

  if (itemCount > pageSize) {
    throw new Error("Mission catalogue returned more items than the requested page size.");
  }

  const pagesFromTotal = total === null ? null : Math.ceil(total / pageSize);
  if (
    totalPages !== null &&
    pagesFromTotal !== null &&
    totalPages !== pagesFromTotal &&
    !(total === 0 && totalPages === 1)
  ) {
    throw new Error("Mission catalogue returned inconsistent total counts.");
  }
  totalPages ??= pagesFromTotal;

  const hasNext =
    typeof hasNextValue === "boolean"
      ? hasNextValue
      : totalPages !== null
        ? requestedPage < totalPages
        : itemCount >= pageSize;

  if (
    typeof hasNextValue === "boolean" &&
    totalPages !== null &&
    hasNext !== requestedPage < totalPages
  ) {
    throw new Error("Mission catalogue returned inconsistent pagination metadata.");
  }

  if (totalPages !== null && requestedPage > totalPages && itemCount > 0) {
    throw new Error("Mission catalogue returned items beyond its reported page count.");
  }

  if (hasNext && itemCount !== pageSize) {
    throw new Error("Mission catalogue returned an incomplete page while reporting another page.");
  }

  if (itemCount === 0 && hasNext) {
    throw new Error("Mission catalogue returned an empty page while reporting another page.");
  }

  const offset = (requestedPage - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) {
    throw new Error("Mission catalogue page is outside the supported range.");
  }

  if (total !== null) {
    if (offset > total) {
      if (itemCount > 0 || hasNext) {
        throw new Error("Mission catalogue returned items beyond its reported total.");
      }
    } else {
      const expectedItemCount = Math.min(pageSize, total - offset);
      if (itemCount !== expectedItemCount) {
        throw new Error("Mission catalogue returned an incomplete page for its reported total.");
      }
    }
  }

  const normalizedTotal =
    total ??
    (totalPages === 0
      ? 0
      : totalPages !== null && requestedPage === totalPages && !hasNext
        ? (totalPages - 1) * pageSize + itemCount
        : null);

  return {
    page: requestedPage,
    pageSize,
    hasNext,
    total: normalizedTotal,
    totalPages
  };
};

const getStringList = (value: unknown): number[] =>
  getArray(value).flatMap((item) => {
    const parsed = getPositiveInteger(item);
    return parsed === null ? [] : [parsed];
  });

const parseResourceBoxDetail = (payload: unknown): MissionResourceBoxDetail | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    resourceBoxId: getPositiveInteger(root.resourceBoxId),
    resourceBoxPurpose: getString(root.resourceBoxPurpose),
    resourceId: getPositiveInteger(root.resourceId),
    resourceLevel: getNumber(root.resourceLevel),
    resourceQuantity: getNumber(root.resourceQuantity),
    resourceType: getString(root.resourceType),
    seq: getNumber(root.seq)
  };
};

const parseResourceBox = (payload: unknown): MissionResourceBox | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    id: getPositiveInteger(root.id),
    resourceBoxPurpose: getString(root.resourceBoxPurpose),
    resourceBoxType: getString(root.resourceBoxType),
    details: getArray(root.details).flatMap((item) => {
      const detail = parseResourceBoxDetail(item);
      return detail ? [detail] : [];
    })
  };
};

const parseMissionReward = (payload: unknown): MissionReward | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    id: getPositiveInteger(root.id),
    missionId: getPositiveInteger(root.missionId),
    missionType: getString(root.missionType),
    resourceBox: parseResourceBox(root.resourceBox),
    resourceBoxId: getPositiveInteger(root.resourceBoxId),
    resourceBoxIds: getStringList(root.resourceBoxIds),
    resourceBoxPurpose: getString(root.resourceBoxPurpose),
    resourceId: getPositiveInteger(root.resourceId),
    resourceLevel: getNumber(root.resourceLevel),
    resourceQuantity: getNumber(root.resourceQuantity),
    resourceType: getString(root.resourceType),
    seq: getNumber(root.seq),
    status: getString(root.status)
  };
};

export const parseMission = (payload: unknown, family: MissionFamily): Mission | null => {
  const root = getObject(payload);
  const id = getPositiveInteger(root?.id);
  if (!root || id === null) {
    return null;
  }

  return {
    id,
    family,
    characterId: getPositiveInteger(root.characterId),
    characterMissionType: getString(root.characterMissionType),
    eventId: getPositiveInteger(root.eventId),
    isAchievementMission: getBoolean(root.isAchievementMission),
    normalMissionType: getString(root.normalMissionType),
    parameterGroupId: getPositiveInteger(root.parameterGroupId),
    progressSentence: getString(root.progressSentence),
    requirement: getNumber(root.requirement),
    resourceBoxId: getPositiveInteger(root.resourceBoxId),
    rewards: getArray(root.rewards).flatMap((item) => {
      const reward = parseMissionReward(item);
      return reward ? [reward] : [];
    }),
    sentence: getString(root.sentence),
    seq: getNumber(root.seq),
    storyMissionType: getString(root.storyMissionType)
  };
};

export const parseMissionList = (payload: unknown, family: MissionFamily): Mission[] =>
  (getItems(payload) ?? []).flatMap((item) => {
    const mission = parseMission(item, family);
    return mission ? [mission] : [];
  });

const createMissionListQuery = (
  family: MissionFamily,
  page: number
): NonNullable<GetMissionsByRegionListData["query"]> => ({
  family,
  page,
  page_size: FAMILY_PAGE_SIZE,
  sort_by: "seq",
  sort_order: "asc"
});

type MissionFamilyPage = {
  items: Mission[];
  pagination: ApiPagination;
  sourceItemCount: number;
};

const fetchMissionFamilyPage = async (
  baseUrl: string,
  region: string,
  family: MissionFamily,
  page: number
): Promise<MissionFamilyPage> => {
  const response = await getMissionsByRegionList({
    baseUrl: getMasterApiV1BaseUrl(baseUrl),
    path: { region },
    query: createMissionListQuery(family, page)
  });

  if (response.error || !response.data) {
    throw new Error(`Failed to load ${family} missions.`);
  }

  const sourceItems = getItems(response.data);
  if (sourceItems === null) {
    throw new Error(`Mission catalogue returned invalid ${family} items.`);
  }

  const seen = new Set<number>();
  const items = parseMissionList(response.data, family).filter((mission) => {
    if (seen.has(mission.id)) {
      return false;
    }

    seen.add(mission.id);
    return true;
  });

  return {
    items,
    pagination: parseApiPagination(response.data, page, FAMILY_PAGE_SIZE, sourceItems.length),
    sourceItemCount: sourceItems.length
  };
};

export const parseMissionFamilies = (searchParams: URLSearchParams): MissionFamily[] => {
  const requestedFamilies = new Set(
    searchParams
      .getAll("family")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value): value is MissionFamily => missionFamilies.includes(value as MissionFamily))
  );

  return requestedFamilies.size > 0
    ? missionFamilies.filter((family) => requestedFamilies.has(family))
    : [...missionFamilies];
};

export const createEmptyMissionListPage = (page: number): MissionListPage => ({
  items: [],
  pagination: {
    page,
    pageSize: PAGE_SIZE,
    hasNext: false,
    total: null,
    totalPages: null
  }
});

export const fetchMissionListPage = async (
  baseUrl: string,
  region: string,
  families: readonly MissionFamily[] = missionFamilies,
  page = 1
): Promise<MissionListPage> => {
  const selectedFamilies = missionFamilies.filter((family) => families.includes(family));
  const familyPages = await Promise.all(
    selectedFamilies.map((family) => fetchMissionFamilyPage(baseUrl, region, family, page))
  );

  const reportedTotalPages = familyPages.flatMap(({ pagination }) =>
    pagination.totalPages === null ? [] : [pagination.totalPages]
  );
  const totalPages = reportedTotalPages.length > 0 ? Math.max(...reportedTotalPages) : null;
  const sourceItemCount = familyPages.reduce(
    (sum, familyPage) => sum + familyPage.sourceItemCount,
    0
  );

  if (
    selectedFamilies.length > 0 &&
    page > 1 &&
    sourceItemCount === 0 &&
    (totalPages === null || page > totalPages)
  ) {
    throw new Error("Mission catalogue returned a page beyond the selected families.");
  }

  const familyTotals = familyPages.map(({ pagination }) => pagination.total);
  const total =
    familyTotals.length > 0 && familyTotals.every((value): value is number => value !== null)
      ? familyTotals.reduce((sum, value) => sum + value, 0)
      : null;

  if (total !== null && !Number.isSafeInteger(total)) {
    throw new Error("Mission catalogue returned an unsupported total count.");
  }

  return {
    items: familyPages.flatMap(({ items }) => items),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      hasNext: familyPages.some(({ pagination }) => pagination.hasNext),
      total,
      totalPages
    }
  };
};
