<script lang="ts">
  import { goto, invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { SharedEventRewardRangeResponse } from "@platform/sekai-master-api-sdk";
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import RankingHistoryChart from "$lib/components/RankingHistoryChart.svelte";
  import { getTrackerCountdown } from "$lib/tracker-countdown";
  import { getTrackerRankLadder, type TrackerRankLadder } from "$lib/tracker-ladders";
  import {
    getNextTrackerRefreshDeadline,
    getTrackerPhase,
    parseTrackerTimestamp
  } from "$lib/tracker-phase";
  import { createTrackerRows, type TrackerRow } from "$lib/tracker-rows";
  import { calculateRecentRates, sortTrackerRatePoints } from "$lib/tracker-rates";
  import type { EventRewardsResult } from "$lib/server/event-rewards";
  import type { EventTrackerResult } from "$lib/server/event-tracker";
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
    status?: string;
  };

  let { data }: { data: PageData } = $props();
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
  let isTimeTravelActive = $state(false);
  let timePoints = $state<string[]>([]);
  let timePointsStatus = $state<TimeTravelStatus>("idle");
  let timePointIndex = $state(0);
  let snapshotRankings = $state<EventTrackerResult["rankings"] | null>(null);
  let snapshotTimestamp = $state<string | null>(null);
  let snapshotStatus = $state<TimeTravelStatus>("idle");
  let selectedRow = $state<TrackerRow<SharedEventRewardRangeResponse> | null>(null);
  let graphPoints = $state<GraphPoint[]>([]);
  let activeGraphPoint = $state<GraphPoint | null>(null);
  let graphMode = $state<"snapshot" | "trend">("snapshot");
  let graphStatus = $state<"idle" | "loading" | "available" | "empty" | "error">("idle");
  let isRefreshing = $state(false);
  let eventPickerInput = $state<HTMLInputElement>();
  let detailsDialog = $state<HTMLDialogElement>();
  let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
  let timePointsRequestToken = 0;
  let snapshotRequestToken = 0;
  let graphRequestToken = 0;
  let graphIdentity: { eventId: number; rank: number } | null = null;
  let observedEventKey: number | null = null;

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
  /** Includes the catalog-resolved current event, so live rankings can use time travel too. */
  const eventKey = $derived(data.selection.eventId ?? catalog?.currentEvent?.id ?? null);
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
    const loaded = parseTrackerTimestamp(trackerResult?.loadedAt);
    if (start === null || loaded === null || loaded <= start) return null;
    return aggregateAt === null ? loaded - start : Math.min(loaded, aggregateAt) - start;
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
    timestamp?: string
  ): Promise<GraphPoint[]> => {
    const params: Record<string, string> = { eventId: String(eventId), rank: String(rank) };
    if (timestamp) params.timestamp = timestamp;
    const response = await fetch(endpoint("graph", params));
    const payload = (await response.json()) as { status?: string; points?: unknown };
    if (!response.ok || payload.status !== "available" || !Array.isArray(payload.points))
      throw new Error("Ranking graph unavailable");
    return payload.points
      .map((point) => normalizePoint(point, rank))
      .filter((point): point is GraphPoint => point !== null);
  };
  const openDetails = (row: TrackerRow<SharedEventRewardRangeResponse>): void => {
    if (row.status === "unavailable") return;
    selectedRow = row;
    graphRequestToken += 1;
    graphIdentity = null;
    graphPoints = [];
    activeGraphPoint = null;
    graphStatus = "idle";
    if (!detailsDialog?.open) detailsDialog?.showModal();
    void openGraph(row);
  };
  const closeDetails = (): void => {
    graphRequestToken += 1;
    detailsDialog?.close();
    selectedRow = null;
    graphIdentity = null;
    graphPoints = [];
    activeGraphPoint = null;
    graphStatus = "idle";
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
        requestTimestamp ?? undefined
      );
      if (requestTimestamp && points.length < 2) {
        points = await fetchGraphPoints(requestEventKey, requestRank);
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
      const response = await fetch(endpoint("time", { eventId: String(requestEventKey) }));
      const payload = (await response.json()) as { status?: string; timePoints?: unknown };
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
      const response = await fetch(
        endpoint("snapshot", { eventId: String(requestEventKey), timestamp })
      );
      const payload = (await response.json()) as {
        status?: string;
        rankings?: EventTrackerResult["rankings"];
      };
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
      if (!cancelled) catalog = value;
    });
    void extendedData.rewards?.then((value) => {
      if (!cancelled) rewards = value;
    });
    return () => (cancelled = true);
  });
  $effect(() => {
    if (nextRefreshAt !== null && !isRefreshing) {
      const timer = window.setTimeout(
        () => void refresh(),
        Math.max(0, nextRefreshAt - Date.now())
      );
      return () => window.clearTimeout(timer);
    }
  });
  $effect(() => {
    void Promise.resolve(data.i18nMessages).then(
      (value) => (messages = { ...fallbackMessages, ...value })
    );
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
              <span class="tracker-countdown-values">
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
            {#if nextRefreshSeconds !== null}<span
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
        <div class="join" aria-label={translate("tracker.rankRange")}>
          <button
            class:btn-primary={ladder === "critical"}
            class:btn-outline={ladder !== "critical"}
            class="btn btn-sm join-item"
            type="button"
            aria-pressed={ladder === "critical"}
            onclick={() => (ladder = "critical")}>{translate("tracker.ranks.critical")}</button
          ><button
            class:btn-primary={ladder === "full"}
            class:btn-outline={ladder !== "full"}
            class="btn btn-sm join-item"
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
          <p class="tracker-time-travel-description">{translate("tracker.historyDescription")}</p>
        </div>
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
        {:else}
          <p
            class="tracker-time-note"
            role={timePointsStatus === "idle" || timePointsStatus === "loading"
              ? "status"
              : timePointsStatus === "unavailable"
                ? undefined
                : "alert"}
          >
            {timePointsStatus === "idle" || timePointsStatus === "loading"
              ? translate("tracker.snapshotLoading")
              : timeTravelMessage(timePointsStatus, "timePoint")}
          </p>
        {/if}
      </section>
    {/if}
  </section>

  {#if snapshotTimestamp}<div class="tracker-snapshot-banner">
      <span>{interpolate("tracker.snapshotAt", { time: formatTimestamp(snapshotTimestamp) })}</span
      ><button class="btn btn-sm btn-outline" type="button" onclick={returnToLatest}
        >{translate("tracker.backToLatestRankings")}</button
      >
    </div>{/if}
  {#if snapshotStatus === "loading"}<p role="status">{translate("tracker.snapshotLoading")}</p>{/if}
  {#if snapshotStatus !== "idle" && snapshotStatus !== "loading"}<p
      role={snapshotStatus === "unavailable" ? undefined : "alert"}
    >
      {timeTravelMessage(snapshotStatus, "snapshot")}
    </p>{/if}

  <section class="tracker-ranking-workspace" aria-labelledby="tracker-results-title">
    <div class="tracker-workspace-heading">
      <div>
        {#if isTrackerLoading}
          <span class="tracker-heading-skeleton skeleton h-3 w-20" aria-hidden="true"></span>
        {:else}
          <p class="tracker-kicker">{activityLabel}</p>
        {/if}
        <h2 id="tracker-results-title">{translate("tracker.rankings")}</h2>
      </div>
      {#if isHistoricalEvent}<a class="btn btn-sm btn-outline" href={trackerPath}
          ><Icon icon="mdi:arrow-left" aria-hidden="true" />{translate(
            "tracker.goToCurrentEvent"
          )}</a
        >{/if}
    </div>
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
      </div>
    {:else if isInvalidSelection}<p role="alert">{translate("tracker.eventIdInvalid")}</p>
    {:else if trackerStatus === "upstream-error"}<p role="alert">
        {translate("tracker.error.historyUpstream")}
      </p>
    {:else if trackerStatus === "sdk-error"}<p role="alert">{translate("tracker.error.sdk")}</p>
    {:else if trackerStatus === "network-error"}<p role="alert">
        {translate("tracker.error.network")}
      </p>
    {:else if trackerStatus === "invalid-data"}<p role="alert">
        {translate("tracker.error.invalidData")}
      </p>
    {:else if trackerStatus !== "available"}<p role="alert">{translate("tracker.error.invalidData")}</p>
    {:else}
      <div class="tracker-table-wrap">
        {#if rankingLoading}<div class="tracker-ranking-loading" role="status">
            <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>{translate(
              "tracker.rankingsLoading"
            )}
          </div>{/if}
        <table class="table tracker-table">
          <thead><tr><th scope="col">{translate("tracker.rank")}</th><th scope="col">{translate("tracker.player")}</th><th scope="col">{translate("tracker.score")}</th><th scope="col">{translate("tracker.speed")}</th><th scope="col">{translate("tracker.degree")}</th><th scope="col"><span class="sr-only">{translate("tracker.viewTrend")}</span></th></tr></thead>
          <tbody>
            {#each rows as row (row.ladderRank)}
              {#if row.status === "available"}
                <tr class="tracker-ranking-row" class:tier-top={rankTier(row.ladderRank) === "top"} class:tier-elite={rankTier(row.ladderRank) === "elite"} class:tier-high={rankTier(row.ladderRank) === "high"} class:tier-mid={rankTier(row.ladderRank) === "mid"} class:tier-long={rankTier(row.ladderRank) === "long"} tabindex="0" role="button" aria-label={interpolate("tracker.openRankDetailsAndTrend", { rank: row.ladderRank })} onclick={() => openDetails(row)} onkeydown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDetails(row); } }}>
                  <th scope="row"><span class="tracker-rank-number">#{formatNumber(row.ladderRank)}</span><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span></th>
                  <td><strong class="tracker-player-name">{row.ranking?.userName ?? row.ranking?.userId ?? translate("tracker.unavailable")}</strong></td>
                  <td class="tracker-score">{formatNumber(row.score)}</td><td class="tracker-speed">{formatSpeed(row.speedPerHour)}</td><td><span class="tracker-reward-badge">{formatRewardRange(row.reward)}</span></td>
                  <td class="tracker-row-icon"><Icon icon="mdi:chart-line" aria-hidden="true" /><Icon icon="mdi:chevron-right" aria-hidden="true" /></td>
                </tr>
              {:else}
                <tr class="tracker-unavailable"><th scope="row"><span class="tracker-rank-number">#{formatNumber(row.ladderRank)}</span><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span></th><td>{translate("tracker.unavailable")}</td><td>{formatNumber(row.score)}</td><td>{formatSpeed(row.speedPerHour)}</td><td>{formatRewardRange(row.reward)}</td><td></td></tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
      <div class="tracker-ranking-cards">
        {#each rows as row (row.ladderRank)}{#if row.status === "available"}<button
              class="tracker-ranking-card"
              type="button"
              onclick={() => openDetails(row)}
              aria-label={interpolate("tracker.openRankDetailsAndTrend", { rank: row.ladderRank })}
              ><div class="tracker-card-heading"><strong class="tracker-rank-number">#{formatNumber(row.ladderRank)}</strong><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span><Icon class="tracker-row-icon" icon="mdi:chart-line" aria-hidden="true" /><Icon class="tracker-row-chevron" icon="mdi:chevron-right" aria-hidden="true" /></div><span
                >{row.ranking?.userName ??
                  row.ranking?.userId ??
                  translate("tracker.unavailable")}</span
              ><span>{translate("tracker.score")}: {formatNumber(row.score)}</span><span
                >{translate("tracker.speed")}: {formatSpeed(row.speedPerHour)}</span
              ><span>{translate("tracker.degree")}: {formatRewardRange(row.reward)}</span><Icon
                class="tracker-row-icon"
                icon="mdi:chart-line"
                aria-hidden="true"
              /></button
            >{:else}<article class="tracker-ranking-card tracker-unavailable">
              <div class="tracker-card-heading"><strong class="tracker-rank-number">#{formatNumber(row.ladderRank)}</strong><span class="tracker-tier">{rankTierLabel(row.ladderRank)}</span></div><span
                >{translate("tracker.unavailable")}</span
              >
            </article>{/if}{/each}
      </div>
    {/if}
  </section>
</main>

<dialog
  bind:this={detailsDialog}
  class="modal tracker-dialog"
  aria-labelledby="tracker-details-title"
  onclose={closeDetails}
>
  <div class="modal-box">
    <div class="tracker-workspace-heading">
      <h2 id="tracker-details-title">
        {selectedRow
          ? interpolate("tracker.detailRank", { rank: selectedRow.ladderRank })
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
    {#if selectedRow}
      <dl class="tracker-detail-grid">
        <div>
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
      {#if graphStatus === "loading"}<p class="tracker-graph-loading" role="status">
          <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>{translate(
            "tracker.graphLoading"
          )}
        </p>{:else if graphStatus === "available"}<section class="tracker-graph-panel">
          <h3>
            {translate("tracker.graph")} · {graphMode === "trend"
              ? translate("tracker.graphTrend")
              : translate("tracker.graphSnapshot")}
          </h3>
          <RankingHistoryChart
            points={graphPoints}
            bind:activePoint={activeGraphPoint}
            locale={data.uiLocale}
            scoreLabel={translate("tracker.score")}
            timeLabel={translate("tracker.capturedAt")}
            ariaLabel={interpolate("tracker.graphAriaLabel", { rank: selectedRow.ladderRank })}
          />
        </section>{:else if graphStatus === "empty" || graphStatus === "error"}<p>
          {translate("tracker.graphUnavailable")}
        </p>{/if}
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label={translate("tracker.detailsClose")}
      >{translate("tracker.detailsClose")}</button
    >
  </form>
</dialog>

<style>
  .tracker-canvas {
    max-width: 82rem;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2rem);
    display: grid;
    gap: 1rem;
  }
  .tracker-context {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: end;
    gap: 1rem;
    border-top: 3px solid var(--color-primary);
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
  .tracker-time-note,
  .tracker-time-travel-description {
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
  }
  .tracker-status-panel {
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
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
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .tracker-ladder-control .join {
    padding: 0.2rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: 9999px;
    background: var(--archive-surface-sunken);
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
  .tracker-time-travel-description {
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }
  .tracker-event-combobox {
    position: relative;
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
  .tracker-heading-skeleton {
    display: block;
    margin-bottom: 0.5rem;
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
  .tracker-workspace-heading h2 {
    font-size: 1.35rem;
    font-weight: 800;
  }
  .tracker-table-wrap {
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
    align-items: center;
    gap: 0.45rem;
  }
  .tracker-ranking-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0.65rem 0.85rem;
    border-bottom: 1px solid var(--archive-border-subtle);
    color: color-mix(in srgb, var(--color-primary) 80%, var(--color-base-content));
    font-size: 0.85rem;
    font-weight: 700;
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
    .tracker-time-control {
      min-width: 100%;
    }
    .tracker-table-wrap {
      display: none;
    }
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
  }
  .tracker-graph-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 8rem;
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
    .tracker-dialog .modal-box {
      width: calc(100vw - 2rem);
      max-width: none;
    }
  }
</style>
