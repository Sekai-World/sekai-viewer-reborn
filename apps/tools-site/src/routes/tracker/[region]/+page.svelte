<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { SharedEventRewardRangeResponse } from "@platform/sekai-master-api-sdk";
  import Icon from "@iconify/svelte";
  import { onMount, tick } from "svelte";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import RankingHistoryChart from "$lib/components/RankingHistoryChart.svelte";
  import { getTrackerChapterCountdown, getTrackerCountdown } from "$lib/tracker-countdown";
  import { getTrackerRankLadder, type TrackerRankLadder } from "$lib/tracker-ladders";
  import {
    getNextTrackerRefreshDeadline,
    getTrackerPhase,
    parseTrackerTimestamp
  } from "$lib/tracker-phase";
  import { createTrackerRows, type TrackerRow } from "$lib/tracker-rows";
  import { createChapterRows, type ChapterRow } from "$lib/tracker-chapter-rows";
  import { calculateRecentRates, sortTrackerRatePoints } from "$lib/tracker-rates";
  import { calculateChapterElapsedMs, calculateScorePerElapsedHour } from "$lib/tracker-math";
  import { resolveTrackerEventId } from "$lib/tracker-event-identity";
  import type { EventRewardsResult } from "$lib/server/event-rewards";
  import type { EventTrackerResult } from "$lib/server/event-tracker";
  import type { ChapterTrackerResult } from "$lib/server/chapter-tracker";
  import type { WorldBloomMetadata } from "$lib/server/world-bloom";
  import type { PageData } from "./$types";

  type EventMetadata = {
    id: number;
    name: string;
    startAt: string | number | null;
    aggregateAt: string | number | null;
    closedAt: string | number | null;
  };
  type CatalogStatus = "available" | "sdk-error" | "network-error" | "invalid-data";
  type Catalog = {
    status: CatalogStatus;
    currentStatus?: CatalogStatus;
    listStatus?: CatalogStatus;
    currentEvent: EventMetadata | null;
    selectedEvent?: EventMetadata | null;
    eligibleEvents: EventMetadata[];
  };
  type GraphPoint = {
    rank: number;
    score: number;
    timestamp: string | null;
    userId: string | null | undefined;
    userName: string | null | undefined;
  };
  type RankingContext = { chapterId: number; chapterNo: number; charaId: number } | null;
  type TimePointGroup = {
    id: number;
    day: number;
    points: Array<{ timestamp: string; index: number }>;
  };
  type SnapshotLocalDateGroup = {
    label: string;
    points: TimePointGroup["points"];
  };
  type TimeTravelStatus =
    | "idle"
    | "loading"
    | "available"
    | "unavailable"
    | "sdk-error"
    | "network-error"
    | "invalid-data";
  type ExtendedData = PageData & {
    trackerResult?: Promise<EventTrackerResult>;
    catalog?: Promise<Catalog>;
    rewards?: Promise<EventRewardsResult | null>;
    chapters?: Promise<{
      metadata: WorldBloomMetadata | null;
      rankings: Array<{ chapter: WorldBloomMetadata["chapters"][number]; result: ChapterTrackerResult }>;
    } | null>;
    status?: string;
    isWorldBloom?: boolean;
  };

  let { data }: { data: ExtendedData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "tracker"]);
  let messages = $state(fallbackMessages);
  let ladder = $state<TrackerRankLadder>("critical");
  let now = $state(Date.now());
  let hasMounted = $state(false);
  let trackerResult = $state<EventTrackerResult | null>(null);
  let trackerRequestIdentity = $state<string | null>(null);
  let catalog = $state<Catalog | null>(null);
  let eventQuery = $state("");
  let isEventPickerOpen = $state(false);
  let isEventPickerFocused = $state(false);
  let activeEventIndex = $state(-1);
  let rewards = $state<EventRewardsResult | null>(null);
  let chapters = $state<Awaited<ExtendedData["chapters"]> | null>(null);
  let selectedChapterId = $state<number | null>(null);
  let selectedRankingTab = $state<"event" | number>("event");
  let selectedChapterRows = $state<ChapterRow[]>([]);
  let isTimeTravelActive = $state(false);
  let timePoints = $state<string[]>([]);
  let timePointsStatus = $state<TimeTravelStatus>("idle");
  let timePointIndex = $state(0);
  let snapshotRankings = $state<EventTrackerResult["rankings"] | null>(null);
  let snapshotTimestamp = $state<string | null>(null);
  let snapshotStatus = $state<TimeTravelStatus>("idle");
  let selectedRow = $state<TrackerRow<SharedEventRewardRangeResponse> | null>(null);
  let selectedRankingContext = $state<RankingContext>(null);
  let graphPoints = $state<GraphPoint[]>([]);
  let activeGraphPoint = $state<GraphPoint | null>(null);
  let graphMode = $state<"snapshot" | "trend">("snapshot");
  let graphStatus = $state<"idle" | "loading" | "available" | "empty" | "error">("idle");
  let isRefreshing = $state(false);
  let eventPickerInput = $state<HTMLInputElement>();
  let detailsDialog = $state<HTMLDialogElement>();
  let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshTimer: number | undefined;
  let refreshedDeadline: number | null = null;
  let timePointsRequestToken = 0;
  let snapshotRequestToken = 0;
  let graphRequestToken = 0;
  let graphIdentity: { eventId: number; rank: number } | null = null;
  let observedEventKey: number | null = null;
  let chapterRequestToken = 0;
  let isDetailsDialogClosing = $state(false);
  let isDetailsDialogOpening = $state(false);
  let isDetailsIdentityVisible = $state(false);
  let detailsModalBox = $state<HTMLDivElement>();
  let detailsPlayerEntry = $state<HTMLElement>();
  let detailsIdentityObserver: IntersectionObserver | undefined;
  let detailsCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let detailsOpenFrame: number | undefined;
  let removeDetailsDialogResizeListener: (() => void) | undefined;

  const extendedData = $derived(data as ExtendedData);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const trackerPath = $derived(resolve("/tracker/[region]", { region: data.region }));
  const trackerStatus = $derived(trackerResult?.status ?? null);
  const isTrackerLoading = $derived(trackerResult === null);
  const trackerIdentity = $derived(
    `${data.region}:${data.selectionStatus}:${data.selection.eventId ?? "live"}`
  );
  const isExplicitSelection = $derived(data.selection.eventId !== null);
  const catalogStatus = $derived(catalog?.status ?? null);
  const listStatus = $derived(catalog?.listStatus ?? catalogStatus);
  const hasEventCatalog = $derived(
    listStatus === "available" && (catalog?.eligibleEvents.length ?? 0) > 0
  );
  const matchingEvents = $derived.by(() => {
    const query = eventQuery.trim().toLocaleLowerCase();
    const events = catalog?.eligibleEvents ?? [];
    return query
      ? events.filter((event) => `${event.name} ${event.id}`.toLocaleLowerCase().includes(query))
      : events;
  });
  const visibleMatchingEvents = $derived(matchingEvents.slice(0, 10));
  const isInvalidSelection = $derived(data.selectionStatus === "invalid-event-id");
  const selectedEvent = $derived.by(() =>
    data.selection.eventId === null
      ? (catalog?.selectedEvent ?? null)
      : catalog?.selectedEvent?.id === data.selection.eventId
        ? catalog.selectedEvent
        : null
  );
  const pickerValue = $derived(
    data.selection.eventId !== null
      ? `${selectedEvent?.name ?? translate("tracker.historicalMetadataUnavailable").replace("{eventId}", String(data.selection.eventId))} #${data.selection.eventId}`
      : (catalog?.currentEvent?.name ?? "")
  );
  const isCurrentEventKnown = $derived(
    !isExplicitSelection || (catalog?.currentEvent !== null && catalog?.currentEvent !== undefined)
  );
  const isCurrentEvent = $derived(
    !isExplicitSelection ||
      (isCurrentEventKnown && catalog?.currentEvent?.id === data.selection.eventId)
  );
  const isHistoricalEvent = $derived(isExplicitSelection && isCurrentEventKnown && !isCurrentEvent);
  const queryEventId = $derived.by(() => {
    // This route's `selection` field may be shadowed by the parent layout's
    // live selection in PageData, so the browser URL is authoritative here.
    const value =
      typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("eventId");
    if (!value || !/^\d+$/.test(value)) return null;
    const eventId = Number(value);
    return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : null;
  });
  /**
   * The ranking result is available before catalog metadata in the live flow,
   * so it must identify graph and chapter-detail requests when the catalog is
   * still pending or unavailable. Explicit historical selections still win.
   */
  const eventKey = $derived(
    resolveTrackerEventId({
      selectedEventId: queryEventId ?? data.selection.eventId,
      resultSelectionEventId:
        trackerResult?.selection.mode === "history" ? trackerResult.selection.eventId : null,
      resolvedCurrentEventId: trackerResult?.resolvedCurrentEventId,
      rankingEventIds: trackerResult?.rankings.map((ranking) => ranking.eventId),
      catalogCurrentEventId: catalog?.currentEvent?.id
    })
  );
  const phase = $derived(
    getTrackerPhase({
      startAt: selectedEvent?.startAt,
      aggregateAt: selectedEvent?.aggregateAt,
      now
    })
  );
  const activityLabel = $derived(
    isHistoricalEvent
      ? translate("tracker.historical")
      : !isCurrentEvent
        ? translate("tracker.phaseUnavailable")
        : phase === "live"
          ? translate("tracker.live")
          : phase === "finished"
            ? translate("tracker.savedRankings")
            : translate("tracker.phaseUnavailable")
  );
  const countdown = $derived(
    isCurrentEvent
      ? getTrackerCountdown({
          startAt: selectedEvent?.startAt,
          aggregateAt: selectedEvent?.aggregateAt,
          closedAt: selectedEvent?.closedAt,
          now
        })
      : null
  );
  const countdownLabel = $derived(
    countdown?.mode === "ends"
      ? translate("tracker.countdownEndsIn")
      : translate("tracker.countdownStartsIn")
  );
  const elapsedMs = $derived.by(() => {
    const start = parseTrackerTimestamp(selectedEvent?.startAt);
    const aggregateAt = parseTrackerTimestamp(selectedEvent?.aggregateAt);
    const reference = parseTrackerTimestamp(snapshotTimestamp) ?? parseTrackerTimestamp(trackerResult?.loadedAt);
    if (start === null || reference === null || reference <= start) return null;
    return aggregateAt === null ? reference - start : Math.min(reference, aggregateAt) - start;
  });
  const displayRankings = $derived(snapshotRankings ?? trackerResult?.rankings ?? []);
  const getReward = (rank: number): SharedEventRewardRangeResponse | null =>
    rewards?.status === "available"
      ? (rewards.items.find((reward) => {
          const fromRank = reward.fromRank;
          const toRank = reward.toRank;
          return (
            typeof fromRank === "number" &&
            typeof toRank === "number" &&
            rank >= fromRank &&
            rank <= toRank
          );
        }) ?? null)
      : null;
  const rows = $derived(
    createTrackerRows({
      ladderRanks: getTrackerRankLadder(ladder),
      rankings: displayRankings,
      elapsedMs,
      getReward
    })
  );
  const chapterIsCurrent = (chapter: WorldBloomMetadata["chapters"][number]): boolean => {
    const startAt = parseTrackerTimestamp(chapter.chapterStartAt);
    const endAt = parseTrackerTimestamp(chapter.chapterEndAt);
    return startAt !== null && now >= startAt && (endAt === null || now < endAt);
  };
  const selectedChapter = $derived(
    chapters?.rankings.find(({ chapter }) => chapter.id === selectedChapterId) ??
      chapters?.rankings.find(({ chapter }) => chapterIsCurrent(chapter)) ??
      chapters?.rankings[0] ??
      null
  );
  const currentChapter = $derived(
    chapters?.rankings.find(({ chapter }) => chapterIsCurrent(chapter)) ??
      chapters?.rankings
        .filter(({ chapter }) => {
          const startAt = parseTrackerTimestamp(chapter.chapterStartAt);
          return startAt !== null && startAt <= now;
        })
        .at(-1) ??
      chapters?.rankings[0] ??
      null
  );
  const isWorldBloom = $derived(data.isWorldBloom === true);
  const chapterElapsedMs = $derived(
    selectedRankingTab !== "event" && selectedChapter
      ? calculateChapterElapsedMs({
          startAt: selectedChapter.chapter.chapterStartAt,
          endAt: selectedChapter.chapter.chapterEndAt,
          now,
          isCurrent: chapterIsCurrent(selectedChapter.chapter),
          snapshotAt: snapshotTimestamp
        })
      : null
  );
  const chapterRows = $derived<TrackerRow<SharedEventRewardRangeResponse>[]>(
    selectedChapterRows.map((row) => ({
      ladderRank: row.rank,
      status: row.status,
      ranking: row,
      score: row.score,
      speedPerHour: calculateScorePerElapsedHour({ score: row.score, elapsedMs: chapterElapsedMs }),
      reward: getReward(row.rank),
      graphPoint: row.score === null ? null : { rank: row.rank, score: row.score, timestamp: row.timestamp }
    }))
  );
  const activeRankingRows = $derived(
    selectedRankingTab === "event" || !selectedChapter ? rows : chapterRows
  );
  const activeRankingContext = $derived<RankingContext>(
    selectedRankingTab === "event" || !selectedChapter
      ? null
      : {
          chapterId: selectedChapter.chapter.id,
          chapterNo: selectedChapter.chapter.chapterNo,
          charaId: selectedChapter.chapter.gameCharacterId
        }
  );
  const handleRankingTabKeydown = (event: KeyboardEvent, index: number): void => {
    const tabCount = (chapters?.rankings.length ?? 0) + 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabCount;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabCount) % tabCount;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabCount - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    if (nextIndex === 0) {
      selectRankingTab("event");
      document.getElementById("tracker-event-ranking-tab")?.focus();
    } else {
      const chapter = chapters?.rankings[nextIndex - 1];
      if (chapter) {
        selectRankingTab(chapter.chapter.id);
        document.getElementById(`tracker-chapter-tab-${chapter.chapter.id}`)?.focus();
      }
    }
  };
  const chapterCountdown = $derived(
    selectedChapter
      ? getTrackerChapterCountdown({
          currentStartAt: selectedChapter.chapter.chapterStartAt,
          nextStartAt:
            chapters?.rankings[
              chapters.rankings.findIndex(({ chapter }) => chapter.id === selectedChapter.chapter.id) + 1
            ]?.chapter.chapterStartAt ?? null,
          currentEndAt: selectedChapter.chapter.aggregateAt ?? selectedChapter.chapter.chapterEndAt,
          now
        })
      : null
  );
  const selectRankingTab = (tab: "event" | number): void => {
    selectedRankingTab = tab;
    if (typeof tab === "number") selectedChapterId = tab;
  };
  const nextRefreshAt = $derived(
    isCurrentEvent && phase !== "upcoming"
      ? getNextTrackerRefreshDeadline({ aggregateAt: selectedEvent?.aggregateAt ?? null, now })
      : null
  );
  const nextRefreshSeconds = $derived(
    nextRefreshAt === null ? null : Math.max(0, Math.ceil((nextRefreshAt - now) / 1000))
  );
  const selectedTimePoint = $derived(timePoints[timePointIndex] ?? null);
  const rankingLoading = $derived(isRefreshing || snapshotStatus === "loading");
  const sortedGraphPoints = $derived(sortTrackerRatePoints(graphPoints));
  const recentRateTarget = $derived(activeGraphPoint ?? sortedGraphPoints.at(-1) ?? null);
  const recentRates = $derived(calculateRecentRates(graphPoints, recentRateTarget));

  const rankTier = (rank: number): "top" | "elite" | "high" | "mid" | "long" =>
    rank === 1 ? "top" : rank <= 10 ? "elite" : rank <= 100 ? "high" : rank <= 1000 ? "mid" : "long";
  const rankTierLabel = (rank: number): string => translate(`tracker.tier.${rankTier(rank)}`);

  const formatNumber = (value: number | null): string =>
    value === null
      ? translate("tracker.unavailable")
      : new Intl.NumberFormat(data.uiLocale).format(value);
  const formatSpeed = (value: number | null): string =>
    value === null
      ? translate("tracker.speedUnavailable")
      : `${new Intl.NumberFormat(data.uiLocale, { maximumFractionDigits: 0 }).format(value)} /h`;
  const formatTimestamp = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return translate("tracker.unavailable");
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? translate("tracker.unavailable")
      : new Intl.DateTimeFormat(data.uiLocale, {
          dateStyle: "medium",
          timeStyle: "short",
          // Keep SSR and the first hydrated render deterministic, then show the viewer's own local time.
          timeZone: hasMounted ? undefined : "UTC"
        }).format(date);
  };
  const formatSnapshotDate = (value: string): string | null => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat(data.uiLocale, {
          dateStyle: "medium",
          timeZone: hasMounted ? undefined : "UTC"
        }).format(date);
  };
  const formatSnapshotGroupLabel = (value: string): string | null => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat(data.uiLocale, {
          dateStyle: "medium",
          timeZone: hasMounted ? undefined : "UTC"
        }).format(date);
  };
  const formatSnapshotOption = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? translate("tracker.unavailable")
      : new Intl.DateTimeFormat(data.uiLocale, {
          timeStyle: "short",
          timeZone: hasMounted ? undefined : "UTC"
        }).format(date);
  };
  const timePointGroups = $derived.by<TimePointGroup[]>(() => {
    const eventStart = parseTrackerTimestamp(selectedEvent?.startAt);
    const groups: TimePointGroup[] = [];
    for (const [index, timestamp] of timePoints.entries()) {
      const pointAt = parseTrackerTimestamp(timestamp);
      // A day is a continuous 24-hour event interval; local midnight is display-only.
      const day =
        eventStart !== null && pointAt !== null
          ? Math.max(1, Math.floor((pointAt - eventStart) / 86_400_000) + 1)
          : index + 1;
      const group = groups.at(-1);
      if (group?.day === day) group.points.push({ timestamp, index });
      else groups.push({ id: groups.length, day, points: [{ timestamp, index }] });
    }
    return groups;
  });
  const selectedTimePointGroup = $derived(
    timePointGroups.find((group) => group.points.some((point) => point.index === timePointIndex)) ??
      timePointGroups.at(-1) ??
      null
  );
  const selectedTimePointLocalDateGroups = $derived.by<SnapshotLocalDateGroup[]>(() => {
    const groups: SnapshotLocalDateGroup[] = [];
    for (const point of selectedTimePointGroup?.points ?? []) {
      const label =
        formatSnapshotGroupLabel(point.timestamp) ?? translate("tracker.unavailable");
      const group = groups.at(-1);
      if (group?.label === label) group.points.push(point);
      else groups.push({ label, points: [point] });
    }
    return groups;
  });
  const formatActivityDay = (group: TimePointGroup): string => {
    const start = group.points[0]?.timestamp;
    const end = group.points.at(-1)?.timestamp;
    const startDate = start ? formatSnapshotDate(start) : null;
    const endDate = end ? formatSnapshotDate(end) : null;
    const label = interpolate("tracker.activityDay", { day: group.day });
    return startDate && endDate && startDate !== endDate
      ? `${label} · ${startDate}–${endDate}`
      : label;
  };
  const interpolate = (key: string, values: Record<string, string | number>): string =>
    Object.entries(values).reduce(
      (message, [name, value]) => message.replace(`{${name}}`, String(value)),
      translate(key)
    );
  const endpoint = (path: string, params: Record<string, string>): string =>
    `${trackerPath}/${path}?${new URLSearchParams(params)}`;
  async function fetchJsonWithDeadline<Payload>(url: string): Promise<{
    response: Response;
    payload: Payload;
  }> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const payload = (await response.json()) as Payload;
      return { response, payload };
    } finally {
      window.clearTimeout(timeout);
    }
  }
  const isTimeTravelStatus = (
    value: unknown
  ): value is Exclude<TimeTravelStatus, "idle" | "loading"> =>
    value === "available" ||
    value === "unavailable" ||
    value === "sdk-error" ||
    value === "network-error" ||
    value === "invalid-data";
  const timeTravelMessage = (
    status: TimeTravelStatus,
    subject: "timePoint" | "snapshot"
  ): string =>
    status === "unavailable"
      ? translate(`tracker.${subject}Unavailable`)
      : translate(`tracker.${subject}Error.${status}`);
  const navigateToEvent = (eventId: number | null): void => {
    isEventPickerOpen = false;
    isEventPickerFocused = false;
    activeEventIndex = -1;
    void goto(
      eventId === null
        ? trackerPath
        : `${trackerPath}?${new URLSearchParams({ eventId: String(eventId) })}`
    );
  };
  const selectEvent = (event: EventMetadata): void => {
    eventQuery = `${event.name} #${event.id}`;
    navigateToEvent(event.id);
  };
  const handleEventPickerInput = (value: string): void => {
    eventQuery = value;
    activeEventIndex = -1;
    isEventPickerOpen = hasEventCatalog;
  };
  const clearEventSearch = (): void => {
    eventQuery = "";
    activeEventIndex = -1;
    isEventPickerFocused = true;
    isEventPickerOpen = hasEventCatalog;
    eventPickerInput?.focus();
  };
  const handleEventPickerKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      isEventPickerOpen = false;
      activeEventIndex = -1;
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hasEventCatalog) return;
      event.preventDefault();
      isEventPickerOpen = true;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      activeEventIndex = visibleMatchingEvents.length
        ? (activeEventIndex + direction + visibleMatchingEvents.length) %
          visibleMatchingEvents.length
        : -1;
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const activeEvent = activeEventIndex >= 0 ? visibleMatchingEvents[activeEventIndex] : null;
    if (activeEvent) {
      selectEvent(activeEvent);
      return;
    }
    const trimmedQuery = eventQuery.trim();
    if (!trimmedQuery) {
      navigateToEvent(null);
      return;
    }
    if (/^[1-9]\d*$/.test(trimmedQuery)) navigateToEvent(Number(trimmedQuery));
  };
  const formatRewardRange = (reward: SharedEventRewardRangeResponse | null): string => {
    if (reward === null) return translate("tracker.degreeUnavailable");
    const honor = reward.eventRankingRewards
      ?.flatMap((rankingReward) => rankingReward.resourceBox?.details ?? [])
      .map((detail) => detail.honor?.name?.trim())
      .find((name): name is string => Boolean(name));
    return honor ?? translate("tracker.degreeUnavailable");
  };
  const refresh = async (): Promise<void> => {
    isRefreshing = true;
    try {
      await invalidate("tools-site:tracker:rankings");
    } finally {
      isRefreshing = false;
    }
  };
  const createTrackerNetworkFailure = (): EventTrackerResult => ({
    selection:
      data.selection.eventId === null
        ? { mode: "live", eventId: null }
        : { mode: "history", eventId: data.selection.eventId },
    resolvedCurrentEventId: null,
    loadedAt: new Date().toISOString(),
    status: "network-error",
    rankings: []
  });
  const toNumber = (value: unknown): number | null => {
    const parsed =
      typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const normalizePoint = (value: unknown, rank: number): GraphPoint | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const score = toNumber(record.score ?? record.eventPoint ?? record.rankingScore);
    return score === null
      ? null
      : {
          rank: toNumber(record.rank ?? record.ranking) ?? rank,
          score,
          timestamp: typeof record.timestamp === "string" ? record.timestamp : null,
          userId: typeof record.userId === "string" ? record.userId : null,
          userName: typeof record.userName === "string" ? record.userName : null
        };
  };
  const fetchGraphPoints = async (
    eventId: number,
    rank: number,
    timestamp?: string,
    context: RankingContext = null
  ): Promise<GraphPoint[]> => {
    const params: Record<string, string> = { eventId: String(eventId), rank: String(rank) };
    if (timestamp) params.timestamp = timestamp;
    if (context) params.charaId = String(context.charaId);
    const { response, payload } = await fetchJsonWithDeadline<{
      status?: string;
      points?: unknown;
    }>(endpoint("graph", params));
    if (!response.ok || payload.status !== "available" || !Array.isArray(payload.points))
      throw new Error("Ranking graph unavailable");
    return payload.points
      .map((point) => normalizePoint(point, rank))
      .filter((point): point is GraphPoint => point !== null);
  };
  const resetDetailsDialogCentering = (): void => {
    removeDetailsDialogResizeListener?.();
    removeDetailsDialogResizeListener = undefined;
    detailsDialog?.style.removeProperty("margin-left");
    detailsDialog?.style.removeProperty("margin-right");
  };
  const disconnectDetailsIdentityObserver = (): void => {
    detailsIdentityObserver?.disconnect();
    detailsIdentityObserver = undefined;
  };
  const observeDetailsIdentity = (): void => {
    disconnectDetailsIdentityObserver();
    if (typeof IntersectionObserver === "undefined" || !detailsModalBox || !detailsPlayerEntry) return;
    detailsIdentityObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry) isDetailsIdentityVisible = !entry.isIntersecting;
      },
      { root: detailsModalBox, threshold: 0 }
    );
    detailsIdentityObserver.observe(detailsPlayerEntry);
  };
  const centerDetailsDialog = (): void => {
    if (typeof window === "undefined" || !detailsDialog) return;

    try {
      // Measure from the CSS baseline on every pass. Keeping the previous
      // compensation in place would make resize measurements cumulative.
      detailsDialog.style.removeProperty("margin-left");
      detailsDialog.style.removeProperty("margin-right");

      const rect = detailsDialog.getBoundingClientRect();
      const targetLeft = (window.innerWidth - rect.width) / 2;
      const shift = targetLeft - rect.left;
      if (Math.abs(shift) < 0.5) {
        detailsDialog.style.removeProperty("margin-left");
        detailsDialog.style.removeProperty("margin-right");
      } else {
        detailsDialog.style.marginLeft = `${shift}px`;
        detailsDialog.style.marginRight = "0px";
      }
      if (!removeDetailsDialogResizeListener) {
        const handleResize = (): void => centerDetailsDialog();
        window.addEventListener("resize", handleResize);
        removeDetailsDialogResizeListener = () => window.removeEventListener("resize", handleResize);
      }
    } catch {
      // Keep the CSS baseline usable if the browser blocks layout measurements.
    }
  };
  const openDetails = (row: TrackerRow<SharedEventRewardRangeResponse>, context: RankingContext = null): void => {
    if (row.status === "unavailable") return;
    selectedRow = row;
    selectedRankingContext = context;
    graphRequestToken += 1;
    graphIdentity = null;
    graphPoints = [];
    activeGraphPoint = null;
    graphStatus = "idle";
    if (detailsCloseTimer) clearTimeout(detailsCloseTimer);
    if (detailsOpenFrame !== undefined) cancelAnimationFrame(detailsOpenFrame);
    detailsCloseTimer = undefined;
    isDetailsDialogClosing = false;
    isDetailsIdentityVisible = false;
    if (!detailsDialog?.open) {
      isDetailsDialogOpening = true;
      detailsDialog?.showModal();
      detailsOpenFrame = requestAnimationFrame(() => {
        centerDetailsDialog();
        // The first frame can still expose the pre-top-layer 100vw geometry.
        // Measure once more after that layout has settled.
        detailsOpenFrame = requestAnimationFrame(() => {
          detailsOpenFrame = undefined;
          centerDetailsDialog();
          isDetailsDialogOpening = false;
          void tick().then(observeDetailsIdentity);
        });
      });
    } else {
      isDetailsDialogOpening = false;
      centerDetailsDialog();
      void tick().then(observeDetailsIdentity);
    }
    void openGraph(row);
  };
  const handleRankingRowClick = (
    event: MouseEvent,
    row: TrackerRow<SharedEventRewardRangeResponse>,
    context: RankingContext = null
  ): void => {
    if (event.target instanceof Element && event.target.closest("button, a, input")) return;
    openDetails(row, context);
  };
  const closeDetails = (): void => {
    if (!detailsDialog?.open || isDetailsDialogClosing) return;
    isDetailsDialogClosing = true;
    detailsCloseTimer = setTimeout(() => detailsDialog?.close(), 180);
  };
  const handleDetailsClosed = (): void => {
    if (detailsCloseTimer) clearTimeout(detailsCloseTimer);
    if (detailsOpenFrame !== undefined) cancelAnimationFrame(detailsOpenFrame);
    detailsCloseTimer = undefined;
    detailsOpenFrame = undefined;
    isDetailsDialogOpening = false;
    isDetailsIdentityVisible = false;
    disconnectDetailsIdentityObserver();
    resetDetailsDialogCentering();
    // Keep the collapsed state through native dialog reconciliation. The next
    // open clears it immediately before showModal() starts a fresh entrance.
  };
  const openGraph = async (row = selectedRow): Promise<void> => {
    if (!row || eventKey === null) return;
    const requestToken = ++graphRequestToken;
    const requestEventKey = eventKey;
    const requestRank = row.ladderRank;
    graphIdentity = { eventId: requestEventKey, rank: requestRank };
    const requestTimestamp = snapshotTimestamp;
    graphStatus = "loading";
    graphPoints = [];
    activeGraphPoint = null;
    graphMode = requestTimestamp ? "snapshot" : "trend";
    try {
      let points = await fetchGraphPoints(
        requestEventKey,
        requestRank,
        requestTimestamp ?? undefined,
        selectedRankingContext
      );
      if (requestTimestamp && points.length < 2) {
        points = await fetchGraphPoints(requestEventKey, requestRank, undefined, selectedRankingContext);
      }
      if (
        requestToken !== graphRequestToken ||
        eventKey !== requestEventKey ||
        graphIdentity?.eventId !== requestEventKey ||
        graphIdentity.rank !== requestRank
      )
        return;
      if (requestTimestamp && points.length < 2) graphMode = "trend";
      graphPoints = points;
      graphStatus = points.length ? "available" : "empty";
    } catch {
      if (
        requestToken !== graphRequestToken ||
        eventKey !== requestEventKey ||
        graphIdentity?.eventId !== requestEventKey ||
        graphIdentity.rank !== requestRank
      )
        return;
      graphStatus = "error";
    }
  };
  const returnToLatest = (): void => {
    snapshotRankings = null;
    snapshotTimestamp = null;
    snapshotStatus = "idle";
  };
  const resetTimeTravel = (): void => {
    timePointsRequestToken += 1;
    snapshotRequestToken += 1;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    returnToLatest();
    timePoints = [];
    timePointIndex = 0;
    timePointsStatus = "idle";
  };
  const toggleTimeTravel = (): void => {
    if (isTimeTravelActive) {
      isTimeTravelActive = false;
      resetTimeTravel();
      return;
    }
    isTimeTravelActive = true;
    resetTimeTravel();
    void loadTimePoints(eventKey);
  };
  const loadTimePoints = async (requestEventKey: number | null): Promise<void> => {
    const requestToken = ++timePointsRequestToken;
    if (typeof window === "undefined" || !isTimeTravelActive || requestEventKey === null) {
      timePointsStatus = "idle";
      return;
    }
    timePointsStatus = "loading";
    try {
      const { payload } = await fetchJsonWithDeadline<{
        status?: string;
        timePoints?: unknown;
      }>(endpoint("time", { eventId: String(requestEventKey) }));
      if (
        requestToken !== timePointsRequestToken ||
        !isTimeTravelActive ||
        eventKey !== requestEventKey
      )
        return;
      timePoints =
        payload.status === "available" && Array.isArray(payload.timePoints)
          ? payload.timePoints.filter((point): point is string => typeof point === "string")
          : [];
      timePointIndex = Math.max(timePoints.length - 1, 0);
      timePointsStatus =
        payload.status === "available"
          ? timePoints.length
            ? "available"
            : "unavailable"
          : isTimeTravelStatus(payload.status)
            ? payload.status
            : "invalid-data";
    } catch {
      if (
        requestToken !== timePointsRequestToken ||
        !isTimeTravelActive ||
        eventKey !== requestEventKey
      )
        return;
      timePoints = [];
      timePointsStatus = "network-error";
    }
  };
  const loadSnapshot = async (timestamp: string): Promise<void> => {
    if (!isTimeTravelActive || eventKey === null) return;
    const requestToken = ++snapshotRequestToken;
    const requestEventKey = eventKey;
    snapshotStatus = "loading";
    try {
      const { payload } = await fetchJsonWithDeadline<{
        status?: string;
        rankings?: EventTrackerResult["rankings"];
      }>(endpoint("snapshot", { eventId: String(requestEventKey), timestamp }));
      if (
        requestToken !== snapshotRequestToken ||
        !isTimeTravelActive ||
        eventKey !== requestEventKey
      )
        return;
      if (payload.status !== "available" || !Array.isArray(payload.rankings)) {
        snapshotStatus = isTimeTravelStatus(payload.status) ? payload.status : "invalid-data";
        return;
      }
      snapshotRankings = payload.rankings;
      snapshotTimestamp = timestamp;
      snapshotStatus = "idle";
    } catch {
      if (
        requestToken !== snapshotRequestToken ||
        !isTimeTravelActive ||
        eventKey !== requestEventKey
      )
        return;
      snapshotStatus = "network-error";
    }
  };
  const queueSnapshot = (timestamp: string): void => {
    if (!isTimeTravelActive) return;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => void loadSnapshot(timestamp), 200);
  };
  const selectTimePoint = (index: number): void => {
    const timestamp = timePoints[index];
    if (!timestamp) return;
    timePointIndex = index;
    if (index === timePoints.length - 1) {
      snapshotRequestToken += 1;
      if (snapshotTimer) clearTimeout(snapshotTimer);
      returnToLatest();
      return;
    }
    queueSnapshot(timestamp);
  };
  const selectTimePointGroup = (id: number): void => {
    const group = timePointGroups.find((candidate) => candidate.id === id);
    const newestPoint = group?.points.at(-1);
    if (newestPoint) selectTimePoint(newestPoint.index);
  };
  onMount(() => {
    hasMounted = true;
    const clock = window.setInterval(() => (now = Date.now()), 1000);
    return () => {
      window.clearInterval(clock);
      if (snapshotTimer) clearTimeout(snapshotTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (detailsCloseTimer) clearTimeout(detailsCloseTimer);
      if (detailsOpenFrame !== undefined) cancelAnimationFrame(detailsOpenFrame);
      disconnectDetailsIdentityObserver();
      resetDetailsDialogCentering();
    };
  });
  $effect(() => {
    if (typeof window !== "undefined") {
      const requestEventKey = eventKey;
      if (observedEventKey === requestEventKey) return;
      observedEventKey = requestEventKey;
      timePointsRequestToken += 1;
      snapshotRequestToken += 1;
      graphRequestToken += 1;
      if (snapshotTimer) clearTimeout(snapshotTimer);
      timePoints = [];
      timePointIndex = 0;
      returnToLatest();
      selectedRow = null;
      graphPoints = [];
      graphStatus = "idle";
      graphIdentity = null;
      if (isTimeTravelActive) void loadTimePoints(requestEventKey);
    }
  });
  $effect(() => {
    if (!isEventPickerFocused) eventQuery = pickerValue;
  });
  $effect(() => {
    let cancelled = false;
    const requestIdentity = trackerIdentity;
    const selectionChanged =
      trackerRequestIdentity !== null && trackerRequestIdentity !== requestIdentity;
    if (selectionChanged) {
      trackerResult = null;
      catalog = null;
      rewards = null;
      chapters = null;
      selectedChapterId = null;
      selectedRankingTab = "event";
      selectedChapterRows = [];
    }
    trackerRequestIdentity = requestIdentity;
    void extendedData.trackerResult?.then(
      (value) => {
        if (!cancelled && trackerRequestIdentity === requestIdentity) trackerResult = value;
      },
      () => {
        if (!cancelled && trackerRequestIdentity === requestIdentity) {
          trackerResult = createTrackerNetworkFailure();
        }
      }
    );
    void extendedData.catalog?.then((value) => {
      if (!cancelled && trackerRequestIdentity === requestIdentity) catalog = value;
    });
    void extendedData.rewards?.then((value) => {
      if (!cancelled && trackerRequestIdentity === requestIdentity) rewards = value;
    });
    void extendedData.chapters?.then((value) => {
      if (!cancelled && trackerRequestIdentity === requestIdentity) chapters = value;
    });
    return () => (cancelled = true);
  });
  $effect(() => {
    if (nextRefreshAt === null) {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = undefined;
      refreshedDeadline = null;
      return;
    }
    if (isRefreshing) {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = undefined;
      return;
    }
    if (nextRefreshAt === refreshedDeadline) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshedDeadline = nextRefreshAt;
    refreshTimer = window.setTimeout(() => {
      refreshTimer = undefined;
      refreshedDeadline = null;
      void refresh();
    }, Math.max(0, nextRefreshAt - Date.now()));
  });
  $effect(() => {
    void Promise.resolve(data.i18nMessages).then(
      (value) => (messages = { ...fallbackMessages, ...value })
    );
  });
  $effect(() => {
    const chapter = selectedChapter;
    const selectedLadder = ladder;
    const requestToken = ++chapterRequestToken;
    selectedChapterRows = [];
    if (!chapter) return;
    const requestEventKey = eventKey;
    const requestChapterId = chapter.chapter.id;
    queueMicrotask(() => {
      if (
        requestToken !== chapterRequestToken ||
        eventKey !== requestEventKey ||
        selectedChapter?.chapter.id !== requestChapterId
      ) return;
      selectedChapterRows = createChapterRows(chapter.result.rankings, selectedLadder);
    });
  });
</script>

<svelte:head><title>{translate("tracker.title")} | Sekai Viewer - Tools</title></svelte:head>

<main class="tracker-canvas" aria-labelledby="tracker-title">
  <header class="tracker-context">
    <div class="tracker-title-block">
      <p class="tracker-kicker">
        {interpolate("tracker.currentRegion", { region: translate(`region.${data.region}`) })}
      </p>
      <h1 id="tracker-title">{translate("tracker.title")}</h1>
    </div>
    <div class="tracker-status-panel" aria-live="polite">
      {#if isTrackerLoading || (catalog === null && !isInvalidSelection)}
        <div class="tracker-status-skeleton" aria-hidden="true">
          <span class="skeleton h-6 w-24 rounded-full"></span>
          <span class="skeleton h-4 w-36"></span>
          <span class="skeleton h-4 w-28"></span>
        </div>
      {:else}
        <div class="tracker-primary-status">
          <span class:badge-success={isCurrentEvent && phase === "live"} class="badge badge-outline"
            >{activityLabel}</span
          >
          {#if countdown}
            <span class="tracker-countdown">
              <span class="tracker-countdown-label">{countdownLabel}</span>
              <span class="tracker-countdown-values" aria-live="off">
                {#if countdown.values.days > 0}<span>{countdown.values.days}<small>{translate("tracker.timeUnit.day")}</small></span>{/if}
                <span>{String(countdown.values.hours).padStart(2, "0")}<small>{translate("tracker.timeUnit.hour")}</small></span>
                <span>{String(countdown.values.minutes).padStart(2, "0")}<small>{translate("tracker.timeUnit.minute")}</small></span>
                <span>{String(countdown.values.seconds).padStart(2, "0")}<small>{translate("tracker.timeUnit.second")}</small></span>
              </span>
            </span>
          {/if}
        </div>
        <div class="tracker-freshness-action">
          <div class="tracker-freshness">
            <span>{interpolate("tracker.loadedAt", { time: formatTimestamp(trackerResult?.loadedAt) })}</span>
            {#if nextRefreshSeconds !== null}<span aria-live="off"
                >{interpolate("tracker.autoRefresh", { seconds: nextRefreshSeconds })}</span
              >{/if}
          </div>
          <button
            class="btn btn-square btn-sm btn-outline tracker-refresh-action"
            type="button"
            onclick={refresh}
            disabled={isRefreshing || isHistoricalEvent}
            aria-label={isRefreshing
              ? translate("tracker.refreshing")
              : translate("tracker.refreshRankings")}
            title={isRefreshing
              ? translate("tracker.refreshing")
              : translate("tracker.refreshRankings")}
            ><Icon icon={isRefreshing ? "mdi:loading" : "mdi:refresh"} aria-hidden="true" /></button
          >
        </div>
      {/if}
    </div>
  </header>

  <section class="tracker-control-deck" aria-label={translate("tracker.eventSelection")}>
    <div class="tracker-event-picker">
      <div class="tracker-event-combobox">
        <input
          bind:this={eventPickerInput}
          id="tracker-event-picker"
          class="input input-sm"
          role="combobox"
          type="text"
          inputmode="search"
          autocomplete="off"
          aria-label={translate("tracker.eventSelection")}
          aria-expanded={isEventPickerOpen && hasEventCatalog}
          aria-controls="tracker-event-options"
          aria-activedescendant={activeEventIndex >= 0
            ? `tracker-event-option-${visibleMatchingEvents[activeEventIndex]?.id}`
            : undefined}
          value={isEventPickerFocused ? eventQuery : pickerValue}
          placeholder={translate("tracker.eventPickerPlaceholder")}
          onfocus={() => {
            isEventPickerFocused = true;
            isEventPickerOpen = hasEventCatalog;
          }}
          oninput={(event) => handleEventPickerInput(event.currentTarget.value)}
          onkeydown={handleEventPickerKeydown}
          onblur={() => {
            isEventPickerFocused = false;
            isEventPickerOpen = false;
            activeEventIndex = -1;
          }}
        />
        {#if isEventPickerFocused && eventQuery.length > 0}
          <button
            class="btn btn-ghost btn-xs btn-circle tracker-event-clear"
            type="button"
            aria-label={translate("tracker.clearEventSearch")}
            title={translate("tracker.clearEventSearch")}
            onmousedown={(event) => event.preventDefault()}
            onclick={clearEventSearch}
          >
            <Icon icon="mdi:close" aria-hidden="true" />
          </button>
        {/if}
        {#if isEventPickerOpen && hasEventCatalog}
          <ul
            id="tracker-event-options"
            class="tracker-event-suggestions"
            role="listbox"
            aria-label={translate("tracker.eventSuggestions")}
          >
            {#each visibleMatchingEvents as event, index (event.id)}
              <li
                id={`tracker-event-option-${event.id}`}
                role="option"
                aria-selected={data.selection.eventId === event.id || activeEventIndex === index}
                tabindex="-1"
                onmousedown={(mouseEvent) => mouseEvent.preventDefault()}
                onclick={() => selectEvent(event)}
                onkeydown={(keyboardEvent) => {
                  if (keyboardEvent.key === "Enter") selectEvent(event);
                }}
              >
                <span>{event.name}</span><small>#{event.id}</small>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
    <div class="tracker-control-row">
      <div class="tracker-ladder-control">
        <span class="tracker-control-label">{translate("tracker.rankings")}</span>
        <div class="tracker-ladder-switcher" aria-label={translate("tracker.rankRange")}>
          <span class:tracker-ladder-indicator-full={ladder === "full"} class="tracker-ladder-indicator" aria-hidden="true"></span>
          <button
            class:btn-primary={ladder === "critical"}
            class:btn-outline={ladder !== "critical"}
            class="btn btn-sm tracker-ladder-option"
            type="button"
            aria-pressed={ladder === "critical"}
            onclick={() => (ladder = "critical")}>{translate("tracker.ranks.critical")}</button
          ><button
            class:btn-primary={ladder === "full"}
            class:btn-outline={ladder !== "full"}
            class="btn btn-sm tracker-ladder-option"
            type="button"
            aria-pressed={ladder === "full"}
            onclick={() => (ladder = "full")}>{translate("tracker.ranks.all")}</button
          >
        </div>
      </div>
      <div class="tracker-history-control">
        <button
          class:btn-primary={isTimeTravelActive}
          class:btn-outline={!isTimeTravelActive}
          class="btn btn-sm"
          type="button"
          aria-expanded={isTimeTravelActive}
          aria-controls="tracker-time-travel-controls"
          onclick={toggleTimeTravel}
          >{isTimeTravelActive
            ? translate("tracker.backToLatestRankings")
            : translate("tracker.viewPastRankings")}</button
        >
      </div>
    </div>
    {#if isTimeTravelActive}
      <section
        id="tracker-time-travel-controls"
        class="tracker-time-travel-panel"
        aria-labelledby="tracker-time-travel-title"
      >
        <div class="tracker-time-travel-copy">
          <h2 id="tracker-time-travel-title">{translate("tracker.pastRankings")}</h2>
        </div>
        <div class="tracker-time-travel-content">
        {#if timePointsStatus === "available"}
          <div class="tracker-time-selects">
            <label class="tracker-time-control" for="tracker-activity-day"
              ><span>{translate("tracker.activityDayLabel")}</span><select
                id="tracker-activity-day"
                class="select select-sm select-bordered"
                value={selectedTimePointGroup?.id ?? ""}
                onchange={(event) => selectTimePointGroup(Number(event.currentTarget.value))}
                >{#each timePointGroups as group (group.id)}<option value={group.id}
                    >{formatActivityDay(group)}</option
                  >{/each}</select
              ></label
            >
            <label class="tracker-time-control" for="tracker-saved-time"
              ><span>{translate("tracker.rankingSnapshotTime")}</span><select
                id="tracker-saved-time"
                class="select select-sm select-bordered"
                value={selectedTimePoint ?? ""}
                onchange={(event) => {
                  const point = selectedTimePointGroup?.points.find(
                    (candidate) => candidate.timestamp === event.currentTarget.value
                  );
                  if (point) selectTimePoint(point.index);
                }}
                >{#each selectedTimePointLocalDateGroups as group (group.label)}<optgroup
                    label={group.label}
                    >{#each group.points as point (point.timestamp)}<option value={point.timestamp}
                        >{formatSnapshotOption(point.timestamp)}{#if point.index === timePoints.length - 1} · {translate(
                          "tracker.latest"
                        )}{/if}</option
                      >{/each}</optgroup
                  >{/each}</select
              ></label
            >
          </div>
        {:else if timePointsStatus === "idle" || timePointsStatus === "loading"}
          <div class="tracker-time-select-skeleton" role="status" aria-label={translate("tracker.snapshotLoading")}>
            <span class="skeleton h-3 w-28"></span>
            <span class="skeleton h-10 w-full rounded-field"></span>
            <span class="skeleton h-3 w-32"></span>
            <span class="skeleton h-10 w-full rounded-field"></span>
          </div>
        {:else}
          <p
            class="tracker-time-note tracker-time-status"
            role={timePointsStatus === "unavailable" ? undefined : "alert"}
          >{timeTravelMessage(timePointsStatus, "timePoint")}</p>
        {/if}
        </div>
      </section>
    {/if}
  </section>

  {#if snapshotTimestamp}<div class="tracker-snapshot-banner">
      <span>{interpolate("tracker.snapshotAt", { time: formatTimestamp(snapshotTimestamp) })}</span
      ><button class="btn btn-sm btn-outline" type="button" onclick={returnToLatest}
        >{translate("tracker.backToLatestRankings")}</button
      >
    </div>{/if}
  <div
    class:tracker-status-visible={snapshotStatus !== "idle"}
    class="tracker-snapshot-status-region"
    aria-live="polite"
  >
    {#if snapshotStatus === "loading"}
      <p role="status">{translate("tracker.snapshotLoading")}</p>
    {:else if snapshotStatus !== "idle"}
      <p role={snapshotStatus === "unavailable" ? undefined : "alert"}>
        {timeTravelMessage(snapshotStatus, "snapshot")}
      </p>
    {/if}
  </div>

  <section class="tracker-ranking-workspace" aria-labelledby="tracker-results-title">
    <div class="tracker-workspace-heading">
      <div>
        {#if isWorldBloom}<p class="tracker-kicker tracker-world-bloom-kicker">{translate("tracker.worldBloom")}</p>{/if}
        <h2 id="tracker-results-title">{translate("tracker.rankings")}</h2>
      </div>
      {#if isHistoricalEvent}<a class="btn btn-sm btn-outline" href={trackerPath}
          ><Icon icon="mdi:arrow-left" aria-hidden="true" />{translate(
            "tracker.goToCurrentEvent"
          )}</a
        >{/if}
    </div>
    {#if isWorldBloom}<div class="tracker-ranking-tabs-shell">
      <div class="tracker-ranking-tabs-scroll">
        <div
          class="tabs tabs-box tracker-ranking-tabs min-w-max flex-nowrap"
          role="tablist"
          aria-label={translate("tracker.rankingWorkspace")}
        >
        {#if chapters === null}
          <span class="tracker-ranking-tabs-loading" aria-hidden="true">
            <span class="skeleton h-11 w-32 rounded-box"></span>
            <span class="skeleton h-11 w-28 rounded-box"></span>
            <span class="skeleton h-11 w-28 rounded-box"></span>
          </span>
        {:else}
        <button
          id="tracker-event-ranking-tab"
          class:tab-active={selectedRankingTab === "event"}
          class:btn-primary={selectedRankingTab === "event"}
          class:btn-outline={selectedRankingTab !== "event"}
          class="tab shrink-0 btn btn-sm tracker-ladder-option"
          type="button"
          role="tab"
          aria-selected={selectedRankingTab === "event"}
          aria-controls="tracker-ranking-panel"
          tabindex={selectedRankingTab === "event" ? 0 : -1}
          onclick={() => selectRankingTab("event")}
          onkeydown={(event) => handleRankingTabKeydown(event, 0)}
        >{translate("tracker.eventRankings")}</button>
        {#each chapters?.rankings ?? [] as chapter, index (chapter.chapter.id)}
          {@const isCurrent = currentChapter?.chapter.id === chapter.chapter.id}
          <button
            id={`tracker-chapter-tab-${chapter.chapter.id}`}
            class:tab-active={selectedRankingTab === chapter.chapter.id}
            class:btn-primary={selectedRankingTab === chapter.chapter.id}
            class:btn-outline={selectedRankingTab !== chapter.chapter.id}
            class:tracker-current-tab={isCurrent}
            class="tab shrink-0 btn btn-sm tracker-ladder-option"
            type="button"
            role="tab"
            aria-selected={selectedRankingTab === chapter.chapter.id}
            aria-current={isCurrent ? "true" : undefined}
            aria-controls="tracker-ranking-panel"
            tabindex={selectedRankingTab === chapter.chapter.id ? 0 : -1}
            onclick={() => selectRankingTab(chapter.chapter.id)}
            onkeydown={(event) => handleRankingTabKeydown(event, index + 1)}
          >{interpolate("tracker.chapter", { number: chapter.chapter.chapterNo })}{#if isCurrent}<span class="tracker-current-marker">{translate("tracker.currentChapter")}</span>{/if}</button>
        {/each}
        {/if}
        </div>
      </div>
    </div>{/if}
    {#if isWorldBloom}<div class="tracker-chapter-countdown-slot">
      {#if isWorldBloom && selectedRankingTab !== "event" && selectedChapter}
        <div class="tracker-chapter-countdown" aria-live="polite">
        <span class="tracker-countdown-label">
          {chapterCountdown?.mode === "starts"
            ? translate("tracker.countdownStartsIn")
            : chapterCountdown?.mode === "ends"
              ? translate("tracker.countdownEndsIn")
              : parseTrackerTimestamp(
                    selectedChapter.chapter.aggregateAt ?? selectedChapter.chapter.chapterEndAt
                  ) !== null &&
                  parseTrackerTimestamp(
                    selectedChapter.chapter.aggregateAt ?? selectedChapter.chapter.chapterEndAt
                  )! <= now
                ? translate("tracker.chapterEnded")
                : translate("tracker.chapterCountdownUnavailable")}
        </span>
        {#if chapterCountdown}
          <span class="tracker-countdown-values" aria-live="off">
            {#if chapterCountdown.values.days > 0}<span>{chapterCountdown.values.days}<small>{translate("tracker.timeUnit.day")}</small></span>{/if}
            <span>{String(chapterCountdown.values.hours).padStart(2, "0")}<small>{translate("tracker.timeUnit.hour")}</small></span>
            <span>{String(chapterCountdown.values.minutes).padStart(2, "0")}<small>{translate("tracker.timeUnit.minute")}</small></span>
            <span>{String(chapterCountdown.values.seconds).padStart(2, "0")}<small>{translate("tracker.timeUnit.second")}</small></span>
          </span>
        {/if}
        </div>
      {/if}
    </div>{/if}
    <div class="tracker-ranking-result-region" aria-live="polite">
    {#if isTrackerLoading}
      <div
        class="tracker-ranking-skeleton"
        role="status"
        aria-live="polite"
        aria-label={translate("tracker.loading")}
        aria-busy="true"
      >
        <div class="tracker-skeleton-heading" aria-hidden="true">
          <span class="skeleton h-3 w-20"></span><span class="skeleton h-7 w-32"></span>
        </div>
        <div class="tracker-skeleton-table" aria-hidden="true">
          {#each getTrackerRankLadder(ladder) as rank (rank)}
            <div class="tracker-skeleton-row">
              <span class="skeleton h-9 w-12"></span><span class="skeleton h-5 w-full max-w-48"></span><span class="skeleton h-5 w-20"></span><span class="skeleton h-5 w-16"></span><span class="skeleton h-6 w-24 rounded-full"></span>
            </div>
          {/each}
        </div>
        <div class="tracker-skeleton-cards" aria-hidden="true">
          {#each getTrackerRankLadder(ladder) as rank (rank)}
            <div class="tracker-skeleton-card">
              <div class="tracker-skeleton-card-heading"><span class="skeleton h-6 w-16"></span><span class="skeleton h-4 w-20"></span></div>
              <span class="skeleton h-5 w-3/5"></span><span class="skeleton h-4 w-2/5"></span><span class="skeleton h-4 w-1/2"></span><span class="skeleton h-4 w-3/5"></span>
            </div>
          {/each}
        </div>
      </div>
    {:else if isInvalidSelection}<p class="tracker-ranking-result-message" role="alert">{translate("tracker.eventIdInvalid")}</p>
    {:else if trackerStatus === "upstream-error"}<p class="tracker-ranking-result-message" role="alert">
        {translate("tracker.error.historyUpstream")}
      </p>
    {:else if trackerStatus === "sdk-error"}<p class="tracker-ranking-result-message" role="alert">{translate("tracker.error.sdk")}</p>
    {:else if trackerStatus === "network-error"}<p class="tracker-ranking-result-message" role="alert">
        {translate("tracker.error.network")}
      </p>
    {:else if trackerStatus === "invalid-data"}<p class="tracker-ranking-result-message" role="alert">
        {translate("tracker.error.invalidData")}
      </p>
    {:else if trackerStatus !== "available"}<p class="tracker-ranking-result-message" role="alert">{translate("tracker.error.invalidData")}</p>
    {:else}
      <div class="tracker-table-wrap">
        {#if rankingLoading}<div class="tracker-ranking-loading" role="status">
            <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>{translate(
              "tracker.rankingsLoading"
            )}
          </div>{/if}
        <div id="tracker-ranking-panel" role={isWorldBloom ? "tabpanel" : undefined} aria-labelledby={isWorldBloom ? selectedRankingTab === "event" ? "tracker-event-ranking-tab" : `tracker-chapter-tab-${selectedChapter?.chapter.id}` : undefined}>
        <table class="table tracker-table">
          <thead><tr><th scope="col">{translate("tracker.rank")}</th><th scope="col">{translate("tracker.player")}</th><th scope="col">{translate("tracker.score")}</th><th scope="col">{translate("tracker.speed")}</th><th scope="col">{translate("tracker.degree")}</th><th scope="col"><span class="sr-only">{translate("tracker.viewTrend")}</span></th></tr></thead>
          <tbody>
            {#each activeRankingRows as row (row.ladderRank)}
              {#if row.status === "available"}
                <tr class="tracker-ranking-row" class:tier-top={rankTier(row.ladderRank) === "top"} class:tier-elite={rankTier(row.ladderRank) === "elite"} class:tier-high={rankTier(row.ladderRank) === "high"} class:tier-mid={rankTier(row.ladderRank) === "mid"} class:tier-long={rankTier(row.ladderRank) === "long"} onclick={(event) => handleRankingRowClick(event, row, activeRankingContext)}>
                  <th scope="row"><span class="tracker-rank-number">#{formatNumber(row.ladderRank)}</span><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span></th>
                  <td><strong class="tracker-player-name">{row.ranking?.userName ?? row.ranking?.userId ?? translate("tracker.unavailable")}</strong></td>
                  <td class="tracker-score">{formatNumber(row.score)}</td><td class="tracker-speed">{formatSpeed(row.speedPerHour)}</td><td><span class="tracker-reward-badge">{formatRewardRange(row.reward)}</span></td>
                  <td class="tracker-row-icon"><button class="tracker-row-detail-button" type="button" aria-label={interpolate("tracker.openRankDetailsAndTrend", { rank: row.ladderRank })} onclick={() => openDetails(row, activeRankingContext)}><Icon icon="mdi:chart-line" aria-hidden="true" /></button></td>
                </tr>
              {:else}
                <tr class="tracker-unavailable"><th scope="row"><span class="tracker-rank-number">#{formatNumber(row.ladderRank)}</span><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span></th><td>{translate("tracker.unavailable")}</td><td>{formatNumber(row.score)}</td><td>{formatSpeed(row.speedPerHour)}</td><td>{formatRewardRange(row.reward)}</td><td></td></tr>
              {/if}
            {/each}
          </tbody>
        </table>
        </div>
      </div>
      <div class="tracker-ranking-cards">
        {#each activeRankingRows as row (row.ladderRank)}{#if row.status === "available"}<button
              class="tracker-ranking-card"
              class:tier-top={rankTier(row.ladderRank) === "top"}
              class:tier-elite={rankTier(row.ladderRank) === "elite"}
              class:tier-high={rankTier(row.ladderRank) === "high"}
              class:tier-mid={rankTier(row.ladderRank) === "mid"}
              class:tier-long={rankTier(row.ladderRank) === "long"}
              type="button"
              onclick={() => openDetails(row, activeRankingContext)}
              aria-label={interpolate("tracker.openRankDetailsAndTrend", { rank: row.ladderRank })}
              ><div class="tracker-card-heading"><strong class="tracker-rank-number">#{formatNumber(row.ladderRank)}</strong><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span><Icon class="tracker-row-icon" icon="mdi:chart-line" aria-hidden="true" /></div><span
                >{row.ranking?.userName ??
                  row.ranking?.userId ??
                  translate("tracker.unavailable")}</span
              ><span>{translate("tracker.score")}: {formatNumber(row.score)}</span><span
                >{translate("tracker.speed")}: {formatSpeed(row.speedPerHour)}</span
              ><span>{translate("tracker.degree")}: {formatRewardRange(row.reward)}</span></button
            >{:else}<article class="tracker-ranking-card tracker-unavailable">
              <div class="tracker-card-heading"><strong class="tracker-rank-number">#{formatNumber(row.ladderRank)}</strong><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span></div><span
                >{translate("tracker.unavailable")}</span
              >
            </article>{/if}{/each}
      </div>
    {/if}
    </div>
  </section>

</main>

<dialog
  bind:this={detailsDialog}
  class="modal tracker-dialog"
  aria-labelledby="tracker-details-title"
  data-opening={isDetailsDialogOpening || undefined}
  data-closing={isDetailsDialogClosing || undefined}
  oncancel={(event) => {
    event.preventDefault();
    closeDetails();
  }}
  onclose={handleDetailsClosed}
>
  {#if selectedRow}
  <div bind:this={detailsModalBox} class="modal-box">
    <div class="tracker-workspace-heading">
      <h2 id="tracker-details-title">
        {selectedRow
          ? `${selectedRankingContext ? `${interpolate("tracker.chapter", { number: selectedRankingContext.chapterNo })} · ` : ""}${interpolate("tracker.detailRank", { rank: selectedRow.ladderRank })}`
          : translate("tracker.playerDetails")}
      </h2>
      <button
        class="btn btn-square btn-sm btn-ghost"
        type="button"
        onclick={closeDetails}
        aria-label={translate("tracker.detailsClose")}
        ><Icon icon="mdi:close" aria-hidden="true" /></button
      >
    </div>
      <div
        class:is-visible={isDetailsIdentityVisible}
        class="tracker-identity-strip"
        aria-hidden={!isDetailsIdentityVisible}
      >
        <strong>{activeGraphPoint?.userName ?? selectedRow.ranking?.userName ?? selectedRow.ranking?.userId ?? translate("tracker.unavailable")}</strong>
        <span>#{formatNumber(selectedRow.ladderRank)}</span>
        <span>{translate("tracker.score")}: {formatNumber(activeGraphPoint?.score ?? selectedRow.score)}</span>
      </div>
      <dl class="tracker-detail-grid">
        <div bind:this={detailsPlayerEntry}>
          <dt>{translate("tracker.player")}</dt>
          <dd>
            {activeGraphPoint?.userName ?? selectedRow.ranking?.userName ??
              selectedRow.ranking?.userId ??
              translate("tracker.unavailable")}
          </dd>
        </div>
        <div>
          <dt>{translate("tracker.degree")}</dt>
          <dd>{formatRewardRange(selectedRow.reward)}</dd>
        </div>
        <div>
          <dt>{translate("tracker.score")}</dt>
          <dd>{formatNumber(activeGraphPoint?.score ?? selectedRow.score)}</dd>
        </div>
        <div>
          <dt>{translate("tracker.speed")}</dt>
          <dd>{formatSpeed(
            activeGraphPoint?.timestamp
              ? (() => {
                  const start = parseTrackerTimestamp(selectedEvent?.startAt);
                  const captured = parseTrackerTimestamp(activeGraphPoint.timestamp);
                  return start !== null && captured !== null && captured > start
                    ? ((activeGraphPoint.score - 0) / ((captured - start) / 3_600_000))
                    : null;
                })()
              : selectedRow.speedPerHour
          )}</dd>
        </div>
        <div>
          <dt>{translate("tracker.recentRate1h")}</dt>
          <dd>{formatSpeed(recentRates.oneHour)}</dd>
        </div>
        <div>
          <dt>{translate("tracker.recentRate3h")}</dt>
          <dd>{formatSpeed(recentRates.threeHours)}</dd>
        </div>
        <div>
          <dt>{translate("tracker.capturedAt")}</dt>
          <dd>{formatTimestamp(activeGraphPoint?.timestamp ?? selectedRow.ranking?.timestamp)}</dd>
        </div>
      </dl>
      <div class="tracker-graph-region" aria-live="polite">
        {#if graphStatus === "loading"}
          <div class="tracker-graph-loading" role="status">
            <span class="sr-only">{translate("tracker.graphLoading")}</span>
            <div class="tracker-graph-skeleton" aria-hidden="true">
              <span class="tracker-graph-skeleton-heading"></span>
              <span class="tracker-graph-skeleton-plot"></span>
              <span class="tracker-graph-skeleton-axis"></span>
            </div>
          </div>
        {:else if graphStatus === "available"}
          <section class="tracker-graph-panel">
            <h3>
              {translate("tracker.graph")} · {graphMode === "trend"
                ? translate("tracker.graphTrend")
                : translate("tracker.graphSnapshot")}
            </h3>
            <RankingHistoryChart
              points={graphPoints}
              rank={selectedRow.ladderRank}
              bind:activePoint={activeGraphPoint}
              locale={data.uiLocale}
              scoreLabel={translate("tracker.score")}
              timeLabel={translate("tracker.capturedAt")}
              nameChangeLabel={translate("tracker.nameChange")}
              nameChangeLegend={translate("tracker.nameChangeLegend")}
              ariaLabel={interpolate("tracker.graphAriaLabel", { rank: selectedRow.ladderRank })}
            />
          </section>
        {:else if graphStatus === "empty" || graphStatus === "error"}
          <p class="tracker-graph-message">{translate("tracker.graphUnavailable")}</p>
        {/if}
      </div>
  </div>
  {/if}
  <form method="dialog" class="modal-backdrop">
    <button type="button" onclick={closeDetails} aria-label={translate("tracker.detailsClose")}
      >{translate("tracker.detailsClose")}</button
    >
  </form>
</dialog>

<style>
  .tracker-canvas {
    max-width: 82rem;
    width: 100%;
    min-width: 0;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2rem);
    display: grid;
    gap: 1rem;
  }
  .tracker-context {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
    align-items: end;
    gap: 1rem;
    padding: 1.25rem 0 1rem;
  }
  .tracker-title-block h1 {
    font-size: clamp(1.75rem, 4vw, 2.6rem);
    font-weight: 800;
    letter-spacing: -0.04em;
  }
  .tracker-status-panel,
  .tracker-workspace-heading,
  .tracker-snapshot-banner {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .tracker-kicker {
    color: var(--color-primary);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .tracker-time-note {
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
  }
  .tracker-time-travel-content {
    display: grid;
    min-height: 4.75rem;
    align-items: end;
    opacity: 1;
    transition: opacity 160ms ease-out;
  }
  .tracker-time-select-skeleton {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
    gap: 0.35rem 0.75rem;
  }
  .tracker-time-status {
    display: grid;
    min-height: 4.75rem;
    place-items: center start;
    margin: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-time-travel-content {
      transition-duration: 1ms;
    }
  }
  .tracker-snapshot-status-region {
    position: relative;
    height: 0;
    min-width: 0;
    opacity: 0;
    transition: opacity 160ms ease-out;
  }
  .tracker-snapshot-status-region p {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 0;
    right: 0;
    margin: 0;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .tracker-snapshot-status-region.tracker-status-visible {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-snapshot-status-region {
      transition-duration: 1ms;
    }
  }
  .tracker-status-panel {
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    min-height: 4.75rem;
    min-width: 0;
  }
  .tracker-primary-status,
  .tracker-freshness-action,
  .tracker-freshness {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .tracker-status-skeleton {
    display: grid;
    justify-items: end;
    gap: 0.45rem;
  }
  .tracker-primary-status {
    flex-wrap: wrap;
    gap: 0.65rem;
  }
  .tracker-freshness-action {
    gap: 0.75rem;
  }
  .tracker-freshness {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.2rem 0.75rem;
    color: color-mix(in srgb, var(--color-base-content) 65%, transparent);
    font-size: 0.78rem;
    text-align: right;
  }
  .tracker-refresh-action {
    flex: none;
  }
  .tracker-countdown,
  .tracker-countdown-values {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem;
  }
  .tracker-countdown {
    color: var(--color-primary);
    font-weight: 700;
  }
  .tracker-countdown-label {
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tracker-countdown-values {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-variant-numeric: tabular-nums;
  }
  .tracker-countdown-values small {
    margin-left: 0.08rem;
    font-family: inherit;
    font-size: 0.65em;
  }
  .tracker-control-deck {
    display: grid;
    min-width: 0;
    gap: 0.75rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-raised);
    padding: 1rem;
    box-shadow: 0 8px 18px color-mix(in srgb, var(--color-primary) 5%, transparent);
  }
  .tracker-event-picker,
  .tracker-control-row {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }
  .tracker-event-picker {
    min-width: 0;
  }
  .tracker-control-row {
    align-items: stretch;
    border-top: 1px solid var(--archive-border-subtle);
    padding-top: 0.85rem;
  }
  .tracker-ladder-control,
  .tracker-history-control {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .tracker-ladder-switcher {
    position: relative;
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 0.2rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: 9999px;
    background: var(--archive-surface-sunken);
    isolation: isolate;
  }
  .tracker-ladder-indicator {
    position: absolute;
    z-index: -1;
    inset: 0.2rem 50% 0.2rem 0.2rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color-primary) 16%, var(--archive-surface-raised));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 22%, transparent);
    transition: transform 180ms ease-out, background-color 180ms ease-out;
  }
  .tracker-ladder-indicator-full {
    transform: translateX(100%);
  }
  .tracker-ladder-option {
    position: relative;
    z-index: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-ladder-indicator {
      transition-duration: 1ms;
    }
  }
  .tracker-ladder-control .btn {
    border: 0;
    border-radius: 9999px;
  }
  .tracker-history-control {
    flex: 1 1 28rem;
    justify-content: flex-end;
  }
  .tracker-control-label {
    display: block;
    color: color-mix(in srgb, var(--color-base-content) 65%, transparent);
    font-size: 0.72rem;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .tracker-event-combobox {
    position: relative;
    min-width: 0;
    width: min(100%, 38rem);
  }
  .tracker-event-combobox > input {
    width: 100%;
    padding-right: 2.75rem;
    font-variant-numeric: tabular-nums;
  }
  .tracker-event-clear {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
  }
  .tracker-event-suggestions {
    position: absolute;
    z-index: 2;
    top: calc(100% + 0.35rem);
    left: 0;
    display: grid;
    width: 100%;
    max-height: 17rem;
    margin: 0;
    padding: 0.35rem;
    overflow-y: auto;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-raised);
    box-shadow: 0 10px 24px color-mix(in srgb, var(--color-base-content) 14%, transparent);
    list-style: none;
  }
  .tracker-event-suggestions li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-radius: calc(var(--radius-field) - 0.125rem);
    padding: 0.6rem 0.75rem;
    cursor: pointer;
    transition:
      background-color 160ms ease,
      color 160ms ease;
  }
  .tracker-event-suggestions li:hover,
  .tracker-event-suggestions li[aria-selected="true"] {
    background: color-mix(in srgb, var(--color-primary) 13%, transparent);
    color: var(--color-base-content);
  }
  .tracker-event-suggestions small {
    flex: none;
    color: color-mix(in srgb, var(--color-base-content) 58%, transparent);
    font-variant-numeric: tabular-nums;
  }
  .tracker-time-travel-panel {
    display: grid;
    grid-template-columns: minmax(14rem, 0.8fr) minmax(18rem, 1.2fr);
    align-items: end;
    gap: 1rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--archive-border-subtle));
    border-radius: var(--radius-box);
    background: color-mix(in srgb, var(--color-primary) 4%, var(--archive-surface-sunken));
    padding: 1rem;
  }
  .tracker-time-travel-copy h2 {
    font-size: 1rem;
    font-weight: 800;
  }
  .tracker-time-control {
    display: grid;
    min-width: 0;
    gap: 0.35rem;
  }
  .tracker-time-selects {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    min-width: min(100%, 32rem);
  }
  .tracker-ranking-workspace {
    display: grid;
    min-width: 0;
    gap: 1rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 30%, var(--archive-border-subtle));
    border-radius: var(--radius-box);
    background: var(--archive-surface-default);
    padding: clamp(1rem, 2.5vw, 1.5rem);
    box-shadow: 0 12px 28px color-mix(in srgb, var(--color-primary) 8%, transparent);
  }
  .tracker-ranking-skeleton {
    display: grid;
    gap: 1rem;
  }
  .tracker-ranking-result-region {
    display: grid;
    min-height: 28rem;
    align-content: start;
  }
  .tracker-ranking-result-message {
    display: grid;
    min-height: 28rem;
    place-items: center;
    margin: 0;
    padding: 2rem;
    color: color-mix(in srgb, var(--color-base-content) 62%, transparent);
    text-align: center;
  }
  .tracker-skeleton-heading {
    display: grid;
    gap: 0.5rem;
  }
  .tracker-skeleton-table {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-sunken);
  }
  .tracker-skeleton-row {
    display: grid;
    grid-template-columns: 3.5rem minmax(8rem, 1.5fr) 5rem 4rem 7rem;
    align-items: center;
    gap: 1rem;
    min-height: 4.2rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--archive-border-subtle);
  }
  .tracker-skeleton-row:last-child {
    border-bottom: 0;
  }
  .tracker-skeleton-cards { display: none; }
  .tracker-skeleton-card { display: grid; gap: 0.55rem; padding: 1rem; border: 1px solid var(--archive-border-subtle); border-radius: var(--radius-box); background: var(--archive-panel); }
  .tracker-skeleton-card-heading { display: flex; justify-content: space-between; align-items: center; }
  .tracker-workspace-heading h2 {
    font-size: 1.35rem;
    font-weight: 800;
  }
  .tracker-table-wrap {
    position: relative;
    overflow-x: auto;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-surface-sunken);
    box-shadow: inset 0 1px color-mix(in srgb, var(--color-base-content) 4%, transparent);
  }
  .tracker-table {
    min-width: 48rem;
  }
  .tracker-table th,
  .tracker-table td {
    vertical-align: middle;
  }
  .tracker-table th:first-child,
  .tracker-table td:first-child {
    border-left: 3px solid transparent;
  }
  .tracker-table .tier-top th:first-child { border-left-color: var(--color-error); }
  .tracker-table .tier-elite th:first-child { border-left-color: var(--color-warning); }
  .tracker-table .tier-high th:first-child { border-left-color: var(--color-info); }
  .tracker-table .tier-mid th:first-child { border-left-color: var(--color-success); }
  .tracker-rank-number,
  .tracker-score {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }
  .tracker-tier {
    display: block;
    margin-top: 0.15rem;
    color: color-mix(in srgb, var(--color-base-content) 52%, transparent);
    font-size: 0.62rem;
    font-weight: 750;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tracker-player-name {
    overflow-wrap: anywhere;
  }
  .tracker-speed {
    color: color-mix(in srgb, var(--color-base-content) 68%, transparent);
    font-variant-numeric: tabular-nums;
    font-size: 0.82rem;
  }
  .tracker-reward-badge {
    display: inline-flex;
    max-width: 12rem;
    align-items: center;
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--archive-border-subtle));
    border-radius: 9999px;
    padding: 0.2rem 0.55rem;
    color: color-mix(in srgb, var(--color-primary) 78%, var(--color-base-content));
    font-size: 0.72rem;
    line-height: 1.2;
  }
  .tracker-unavailable {
    color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
  }
  .tracker-ranking-cards {
    display: none;
  }
  .tracker-ranking-tabs {
    display: flex;
    gap: 0.35rem;
    flex-wrap: nowrap;
  }
  .tracker-ranking-tabs-loading {
    display: flex;
    gap: 0.35rem;
  }
  .tracker-ranking-tabs-scroll {
    position: relative;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    padding: 0.25rem 0.75rem;
    mask-image: linear-gradient(
      to right,
      transparent,
      black 0.65rem,
      black calc(100% - 0.65rem),
      transparent
    );
  }
  .tracker-ranking-tabs-shell {
    min-width: 0;
    max-width: 100%;
    min-height: 3.25rem;
  }
  .tracker-chapter-countdown-slot {
    min-width: 0;
    min-height: 0;
  }
  .tracker-ranking-tabs .tracker-ladder-option {
    min-height: 2.75rem;
    border-radius: calc(var(--radius-box) - 0.2rem);
  }
  .tracker-ranking-tabs .tab.tab-active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }
  .tracker-ranking-tabs .tab.tab-active:hover {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-primary-content);
  }
  .tracker-ranking-tabs .tab:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .tracker-current-tab {
    box-shadow: inset 0 -2px var(--color-secondary);
  }
  .tracker-current-tab:not(.btn-primary) {
    border-color: color-mix(in srgb, var(--color-accent) 58%, var(--archive-border-subtle));
    background: color-mix(in srgb, var(--color-accent) 12%, var(--archive-panel));
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--color-accent) 24%, transparent),
      inset 0 -2px var(--color-accent);
  }
  .tracker-current-tab.btn-primary {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--color-primary-content) 34%, transparent),
      inset 0 -2px var(--color-primary-content);
  }
  .tracker-current-marker {
    margin-inline-start: 0.35rem;
    color: var(--color-secondary);
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
  }
  .tracker-current-tab.btn-primary .tracker-current-marker {
    color: var(--color-primary-content);
  }
  .tracker-chapter-countdown {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.55rem;
    color: var(--color-primary);
  }
  .tracker-ranking-card {
    display: grid;
    width: 100%;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: var(--radius-box);
    background: var(--archive-panel);
    color: inherit;
    text-align: left;
  }
  .tracker-ranking-card:hover,
  .tracker-ranking-card:focus-visible {
    border-color: color-mix(in srgb, var(--color-primary) 45%, var(--archive-border-subtle));
    background: color-mix(in srgb, var(--color-primary) 7%, var(--archive-panel));
  }
  .tracker-card-heading {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.45rem;
  }
  .tracker-ranking-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: absolute;
    z-index: 1;
    top: 0.5rem;
    right: 0.75rem;
    min-height: 2rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--archive-border-subtle));
    border-radius: 9999px;
    background: color-mix(in srgb, var(--archive-surface-sunken) 92%, transparent);
    color: color-mix(in srgb, var(--color-primary) 80%, var(--color-base-content));
    font-size: 0.85rem;
    font-weight: 700;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-base-content) 10%, transparent);
    opacity: 0;
    animation: tracker-ranking-loading-fade-in 160ms ease-out forwards;
  }
  @keyframes tracker-ranking-loading-fade-in {
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-ranking-loading {
      animation: none;
      opacity: 1;
    }
  }
  .tracker-ranking-row {
    cursor: pointer;
    transition:
      background-color 160ms ease,
      box-shadow 160ms ease;
  }
  .tracker-ranking-row:hover,
  .tracker-ranking-row:focus-visible {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    box-shadow: inset 3px 0 var(--color-primary);
    outline: none;
  }
  .tracker-row-icon {
    width: 1.25rem;
    color: var(--color-primary);
    text-align: center;
  }
  .tracker-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  dt {
    color: color-mix(in srgb, var(--color-base-content) 58%, transparent);
    font-size: 0.72rem;
    font-weight: 750;
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .tracker-graph-region {
    display: grid;
    height: clamp(18rem, 52vw, 24.5rem);
    min-height: 18rem;
    margin-top: 1rem;
    overflow: hidden;
  }
  .tracker-graph-loading,
  .tracker-graph-message {
    display: grid;
    min-height: 0;
    place-items: center;
  }
  .tracker-graph-skeleton {
    display: grid;
    width: 100%;
    height: 100%;
    grid-template-rows: 1.25rem minmax(0, 1fr) 0.75rem;
    gap: 0.85rem;
    padding: 0.25rem 0;
  }
  .tracker-graph-skeleton-heading,
  .tracker-graph-skeleton-plot,
  .tracker-graph-skeleton-axis {
    display: block;
    border-radius: var(--radius-box);
    background: color-mix(in srgb, var(--color-base-content) 10%, transparent);
    animation: tracker-graph-skeleton-pulse 1.6s ease-in-out infinite;
  }
  .tracker-graph-skeleton-heading {
    width: 42%;
  }
  .tracker-graph-skeleton-plot {
    border: 1px solid color-mix(in srgb, var(--color-base-content) 10%, transparent);
    background:
      linear-gradient(color-mix(in srgb, var(--color-base-content) 8%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--color-base-content) 8%, transparent) 1px, transparent 1px),
      color-mix(in srgb, var(--color-base-content) 4%, transparent);
    background-size: 100% 25%, 20% 100%, auto;
    animation-delay: 100ms;
  }
  .tracker-graph-skeleton-axis {
    width: 68%;
    animation-delay: 200ms;
  }
  .tracker-graph-panel {
    min-height: 0;
    opacity: 0;
    animation: tracker-graph-fade-in 180ms ease-out forwards;
  }
  .tracker-graph-panel :global(.history-chart) {
    height: calc(100% - 2rem);
    min-height: 0;
  }
  .tracker-graph-message {
    color: color-mix(in srgb, var(--color-base-content) 58%, transparent);
    text-align: center;
  }
  @keyframes tracker-graph-fade-in {
    to { opacity: 1; }
  }
  @keyframes tracker-graph-skeleton-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-graph-panel {
      animation: none;
      opacity: 1;
    }
    .tracker-graph-skeleton-heading,
    .tracker-graph-skeleton-plot,
    .tracker-graph-skeleton-axis {
      animation: none;
    }
  }
  @media (max-width: 47.999rem) {
    .tracker-context,
    .tracker-event-picker,
    .tracker-control-row,
    .tracker-history-control {
      align-items: stretch;
    }
    .tracker-status-panel {
      align-items: stretch;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 6.25rem;
    }
    .tracker-status-skeleton {
      justify-items: start;
    }
    .tracker-primary-status {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.55rem;
    }
    .tracker-freshness-action {
      align-items: flex-end;
      justify-content: space-between;
      gap: 0.75rem;
      border-top: 1px solid var(--archive-border-subtle);
      padding-top: 0.75rem;
    }
    .tracker-freshness {
      justify-content: flex-start;
      text-align: left;
    }
    .tracker-refresh-action {
      min-width: 2.75rem;
      min-height: 2.75rem;
    }
    .tracker-event-combobox {
      width: 100%;
    }
    .tracker-time-travel-panel {
      grid-template-columns: 1fr;
    }
    .tracker-time-selects {
      grid-template-columns: 1fr;
      width: 100%;
    }
    .tracker-time-select-skeleton {
      grid-template-columns: 1fr;
    }
    .tracker-time-control {
      min-width: 100%;
    }
    .tracker-table-wrap {
      display: none;
    }
    .tracker-ranking-skeleton .tracker-skeleton-table { display: none; }
    .tracker-ranking-skeleton .tracker-skeleton-cards { display: grid; gap: 0.75rem; }
    .tracker-ranking-cards {
      display: grid;
      gap: 0.75rem;
    }
    .tracker-skeleton-row {
      grid-template-columns: 3.25rem minmax(0, 1fr) 4.5rem;
      gap: 0.75rem;
    }
    .tracker-skeleton-row > :nth-child(4),
    .tracker-skeleton-row > :nth-child(5) {
      display: none;
    }
    .tracker-detail-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (min-width: 48rem) and (max-width: 63.999rem) {
    .tracker-context {
      align-items: start;
    }
    .tracker-status-panel {
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: 0.75rem 1.25rem;
      min-height: 4.75rem;
    }
  }
  @media (min-width: 64rem) {
    .tracker-context {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .tracker-status-panel {
      display: grid;
      grid-template-columns: auto auto;
      align-items: center;
      gap: 0.75rem 1.25rem;
    }
    .tracker-primary-status {
      grid-row: 1;
    }
    .tracker-freshness-action {
      grid-row: 2;
      grid-column: 1 / -1;
      justify-content: flex-end;
    }
  }
  .tracker-time-travel-panel {
    align-items: start;
  }
  .tracker-time-control {
    position: relative;
    justify-self: end;
  }
  @media (max-width: 47.999rem) {
    .tracker-time-control {
      width: 100%;
      justify-self: stretch;
    }
  }
  .tracker-dialog .modal-box {
    width: min(92vw, 64rem);
    max-width: 64rem;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transform: translateY(-0.5rem) scaleY(0.96);
    transform-origin: top;
    transition:
      max-height 180ms ease-out,
      opacity 140ms ease-out,
      transform 180ms ease-out;
  }
  .tracker-identity-strip {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.25rem;
    margin: 0 -0.75rem 0.75rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-base-content) 16%, transparent);
    background: var(--color-base-100);
    color: var(--color-base-content);
    font-size: 0.75rem;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-100%);
    transition: opacity 140ms ease-out, transform 140ms ease-out;
  }
  .tracker-identity-strip strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tracker-identity-strip span {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .tracker-identity-strip.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
  .tracker-dialog {
    inset: 0;
    width: 100vw;
    margin-inline: auto;
    max-width: none;
  }
  .tracker-dialog:not([data-opening]):not([data-closing]) .modal-box {
    max-height: min(85vh, 64rem);
    overflow-y: auto;
    opacity: 1;
    transform: translateY(0) scaleY(1);
  }
  .tracker-dialog::backdrop {
    transition: background-color 180ms ease-out;
  }
  .tracker-dialog[data-opening]::backdrop,
  .tracker-dialog[data-closing]::backdrop {
    background-color: transparent;
  }
  @media (prefers-reduced-motion: reduce) {
    .tracker-dialog .modal-box,
    .tracker-dialog::backdrop,
    .tracker-identity-strip {
      transition-duration: 1ms;
    }
  }
  .tracker-graph-panel {
    margin-top: 1rem;
  }
  .tracker-graph-panel h3 {
    margin-bottom: 0.5rem;
    font-size: 1rem;
    font-weight: 800;
  }
  @media (max-width: 47.999rem) {
    .tracker-graph-region {
      height: 18rem;
    }
    .tracker-dialog .modal-box {
      width: calc(100vw - 2rem);
      max-width: none;
    }
  }
</style>
