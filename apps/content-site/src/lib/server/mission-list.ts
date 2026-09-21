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
import type { CataloguePagination, CataloguePaginationMetadata } from "./catalogue-data";
import {
  getArray,
  getBoolean,
  getCatalogueHasNext,
  getItems,
  getMasterApiV1BaseUrl,
  getNumber,
  getObject,
  getPositiveInteger,
  getString,
  parseCataloguePaginationMetadata,
  validateCataloguePageContent,
  validateCataloguePageRequest
} from "./catalogue-data";

const PAGE_SIZE = 24;
const FAMILY_PAGE_SIZE = PAGE_SIZE / missionFamilies.length;
export type MissionListPagination = CataloguePagination;

export type MissionListPage = {
  items: Mission[];
  pagination: MissionListPagination;
};

const getTotalPagesFromTotal = (total: number | null, pageSize: number): number | null =>
  total === null ? null : Math.ceil(total / pageSize);

const resolveMissionTotalPages = (
  metadata: CataloguePaginationMetadata,
  pageSize: number
): number | null => {
  const pagesFromTotal = getTotalPagesFromTotal(metadata.total, pageSize);
  if (
    metadata.totalPages !== null &&
    pagesFromTotal !== null &&
    metadata.totalPages !== pagesFromTotal &&
    !(metadata.total === 0 && metadata.totalPages === 1)
  ) {
    throw new Error("Mission catalogue returned inconsistent total counts.");
  }

  return metadata.totalPages ?? pagesFromTotal;
};

const validateMissionPageRange = (
  requestedPage: number,
  totalPages: number | null,
  itemCount: number
): void => {
  if (totalPages !== null && requestedPage > totalPages && itemCount > 0) {
    throw new Error("Mission catalogue returned items beyond its reported page count.");
  }
};

const inferMissionTotal = (
  total: number | null,
  totalPages: number | null,
  requestedPage: number,
  pageSize: number,
  itemCount: number,
  hasNext: boolean
): number | null => {
  if (total !== null) {
    return total;
  }

  if (totalPages === 0) {
    return 0;
  }

  if (totalPages === null || requestedPage !== totalPages || hasNext) {
    return null;
  }

  return (totalPages - 1) * pageSize + itemCount;
};

const parseApiPagination = (
  payload: unknown,
  requestedPage: number,
  pageSize: number,
  itemCount: number
): MissionListPagination => {
  const metadata = parseCataloguePaginationMetadata(payload, "Mission");
  validateCataloguePageRequest(metadata, requestedPage, pageSize, itemCount, "Mission");

  const totalPages = resolveMissionTotalPages(metadata, pageSize);
  const resolvedMetadata = { ...metadata, totalPages };
  const hasNext = getCatalogueHasNext(
    resolvedMetadata,
    requestedPage,
    pageSize,
    itemCount,
    "Mission"
  );
  validateMissionPageRange(requestedPage, totalPages, itemCount);
  validateCataloguePageContent(
    metadata.total,
    requestedPage,
    pageSize,
    itemCount,
    hasNext,
    "Mission"
  );

  return {
    page: requestedPage,
    pageSize,
    hasNext,
    total: inferMissionTotal(
      metadata.total,
      totalPages,
      requestedPage,
      pageSize,
      itemCount,
      hasNext
    ),
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
  pagination: MissionListPagination;
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
    throw new TypeError(`Mission catalogue returned invalid ${family} items.`);
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
