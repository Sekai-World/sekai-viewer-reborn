import { toTimestampMs } from "$lib/time/date-time";

export type VirtualLiveStatus = "upcoming" | "ongoing" | "ended";

export const VIRTUAL_LIVE_STATUS_VALUES: readonly VirtualLiveStatus[] = [
  "upcoming",
  "ongoing",
  "ended"
];

export const deriveVirtualLiveStatus = (
  startAt: string | number | null,
  endAt: string | number | null
): VirtualLiveStatus => {
  const now = Date.now();
  const startMs = toTimestampMs(startAt);
  const endMs = toTimestampMs(endAt);

  if (startMs !== null && now < startMs) {
    return "upcoming";
  }

  if (endMs !== null && now > endMs) {
    return "ended";
  }

  return "ongoing";
};

export type VirtualLiveListItem = {
  id: string;
  name: string | null;
  virtualLiveType: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  status: VirtualLiveStatus;
};

export type VirtualLiveListPagination = {
  page: number;
  pageSize: number;
  hasNext: boolean;
  total: number | null;
  totalPages: number | null;
};

export type VirtualLiveListPage = {
  items: VirtualLiveListItem[];
  pagination: VirtualLiveListPagination;
};

export type VirtualLiveListSortBy = "id" | "startAt";
export type VirtualLiveListSortOrder = "asc" | "desc";

export type VirtualLiveListQueryState = {
  name: string;
  id: string;
  virtualLiveType: string[];
  spoiler: boolean;
  sortBy: VirtualLiveListSortBy;
  sortOrder: VirtualLiveListSortOrder;
};

export const DEFAULT_VIRTUAL_LIVE_LIST_PAGE_SIZE = 20;
export const DEFAULT_VIRTUAL_LIVE_LIST_QUERY_STATE: VirtualLiveListQueryState = {
  name: "",
  id: "",
  virtualLiveType: [],
  spoiler: false,
  sortBy: "startAt",
  sortOrder: "desc"
};

export type VirtualLiveInformation = {
  virtualLiveId: number | null;
  description: string | null;
  summary: string | null;
};

export type VirtualLiveWaitingRoom = {
  id: number | null;
  virtualLiveId: number | null;
  assetBundleName: string | null;
  lobbyAssetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
};

export type VirtualLiveCharacter = {
  id: number | null;
  virtualLiveId: number | null;
  gameCharacterUnitId: number | null;
  subGameCharacter2dId: number | null;
  seq: number | null;
  virtualLivePerformanceType: string | null;
};

export type VirtualLiveReward = {
  id: number | null;
  virtualLiveId: number | null;
  resourceBoxId: number | null;
  virtualLiveType: string | null;
};

export type VirtualLiveSchedule = {
  id: number | null;
  virtualLiveId: number | null;
  seq: number | null;
  startAt: string | number | null;
  endAt: string | number | null;
  isAfterEvent: boolean | null;
  noticeGroupId: number | null;
};

export type VirtualLiveSetlist = {
  id: number | null;
  virtualLiveId: number | null;
  seq: number | null;
  musicId: number | null;
  musicVocalId: number | null;
  virtualLiveStageId: number | null;
  virtualLiveSetlistType: string | null;
  assetBundleName: string | null;
  character3dId1: number | null;
  character3dId2: number | null;
  character3dId3: number | null;
  character3dId4: number | null;
  character3dId5: number | null;
  character3dId6: number | null;
};

export type VirtualLiveBasic = {
  id: string;
  name: string | null;
  virtualLiveType: string | null;
  virtualLivePlatform: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  rankingAnnounceAt: string | number | null;
  seq: number | null;
  status: VirtualLiveStatus;
};

export type VirtualLiveDetail = VirtualLiveBasic & {
  information: VirtualLiveInformation | null;
  waitingRoom: VirtualLiveWaitingRoom | null;
  characters: VirtualLiveCharacter[];
  rewards: VirtualLiveReward[];
  schedules: VirtualLiveSchedule[];
  setlists: VirtualLiveSetlist[];
  virtualLiveGroup: Record<string, unknown> | null;
  screenMvMusicVocal: Record<string, unknown> | null;
  pamphlet: Record<string, unknown> | null;
  ticket: Record<string, unknown> | null;
};
