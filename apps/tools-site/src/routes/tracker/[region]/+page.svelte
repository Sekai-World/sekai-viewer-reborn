<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { SharedEventRewardRangeResponse } from "@platform/sekai-master-api-sdk";
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import { getTrackerRankLadder, type TrackerRankLadder } from "$lib/tracker-ladders";
  import { getNextTrackerRefreshDeadline, getTrackerPhase, parseTrackerTimestamp } from "$lib/tracker-phase";
  import { createTrackerRows, type TrackerRow } from "$lib/tracker-rows";
  import type { EventRewardsResult } from "$lib/server/event-rewards";
  import type { PageData } from "./$types";

  type EventMetadata = {
    id: number;
    name: string;
    startAt: string | number | null;
    aggregateAt: string | number | null;
    closedAt: string | number | null;
  };
  type CatalogStatus = "available" | "sdk-error" | "network-error" | "invalid-data";
  type Catalog = { status: CatalogStatus; currentStatus?: CatalogStatus; listStatus?: CatalogStatus; currentEvent: EventMetadata | null; eligibleEvents: EventMetadata[] };
  type GraphPoint = { rank: number; score: number; timestamp: string | null };
  type TimeTravelStatus =
    | "idle"
    | "loading"
    | "available"
    | "unavailable"
    | "sdk-error"
    | "network-error"
    | "invalid-data";
  type ExtendedData = PageData & {
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
  let catalog = $state<Catalog | null>(null);
  let eventQuery = $state("");
  let isEventBrowserOpen = $state(false);
  let rewards = $state<EventRewardsResult | null>(null);
  let timePoints = $state<string[]>([]);
  let timePointsStatus = $state<TimeTravelStatus>("idle");
  let timePointIndex = $state(0);
  let snapshotRankings = $state<typeof data.rankings | null>(null);
  let snapshotTimestamp = $state<string | null>(null);
  let snapshotStatus = $state<TimeTravelStatus>("idle");
  let selectedRow = $state<TrackerRow<SharedEventRewardRangeResponse> | null>(null);
  let graphPoints = $state<GraphPoint[]>([]);
  let graphMode = $state<"snapshot" | "trend">("snapshot");
  let graphStatus = $state<"idle" | "loading" | "available" | "empty" | "error">("idle");
  let isRefreshing = $state(false);
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
  const trackerStatus = $derived(String(extendedData.status ?? ""));
  const catalogStatus = $derived(catalog?.status ?? null);
  const listStatus = $derived(catalog?.listStatus ?? catalogStatus);
  const hasEventCatalog = $derived(listStatus === "available" && (catalog?.eligibleEvents.length ?? 0) > 0);
  const matchingEvents = $derived.by(() => {
    const query = eventQuery.trim().toLocaleLowerCase();
    const events = catalog?.eligibleEvents ?? [];
    return query ? events.filter((event) => `${event.name} ${event.id}`.toLocaleLowerCase().includes(query)) : events;
  });
  const visibleMatchingEvents = $derived(matchingEvents.slice(0, 10));
  const isInvalidSelection = $derived(data.selectionStatus === "invalid-event-id");
  const selectedEvent = $derived.by(() =>
    data.selection.eventId === null
      ? catalog?.currentEvent ?? null
      : catalog?.eligibleEvents.find((event) => event.id === data.selection.eventId) ?? null
  );
  /** Includes the catalog-resolved current event, so live rankings can use time travel too. */
  const eventKey = $derived(data.selection.eventId ?? catalog?.currentEvent?.id ?? null);
  const phase = $derived(
    getTrackerPhase({ startAt: selectedEvent?.startAt, aggregateAt: selectedEvent?.aggregateAt, now })
  );
  const elapsedMs = $derived.by(() => {
    const start = parseTrackerTimestamp(selectedEvent?.startAt);
    const aggregateAt = parseTrackerTimestamp(selectedEvent?.aggregateAt);
    const loaded = parseTrackerTimestamp(data.loadedAt);
    if (start === null || loaded === null || loaded <= start) return null;
    return aggregateAt === null ? loaded - start : Math.min(loaded, aggregateAt) - start;
  });
  const displayRankings = $derived(snapshotRankings ?? data.rankings);
  const getReward = (rank: number): SharedEventRewardRangeResponse | null =>
    rewards?.status === "available"
      ? rewards.items.find((reward) => {
          const fromRank = reward.fromRank;
          const toRank = reward.toRank;
          return typeof fromRank === "number" && typeof toRank === "number" && rank >= fromRank && rank <= toRank;
        }) ?? null
      : null;
  const rows = $derived(
    createTrackerRows({
      ladderRanks: getTrackerRankLadder(ladder),
      rankings: displayRankings,
      elapsedMs,
      getReward
    })
  );
  const primaryGraphRow = $derived(rows.find((row) => row.ladderRank === 1 && row.status === "available") ?? null);
  const nextRefreshAt = $derived(
    phase === "live"
      ? getNextTrackerRefreshDeadline({ aggregateAt: selectedEvent?.aggregateAt ?? null, now })
      : null
  );
  const nextRefreshSeconds = $derived(
    nextRefreshAt === null ? null : Math.max(0, Math.ceil((nextRefreshAt - now) / 1000))
  );
  const graphMinimum = $derived(graphPoints.length ? Math.min(...graphPoints.map((point) => point.score)) : 0);
  const graphMaximum = $derived(graphPoints.length ? Math.max(...graphPoints.map((point) => point.score)) : 0);

  const formatNumber = (value: number | null): string =>
    value === null ? translate("tracker.unavailable") : new Intl.NumberFormat(data.uiLocale).format(value);
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
  const interpolate = (key: string, values: Record<string, string | number>): string =>
    Object.entries(values).reduce((message, [name, value]) => message.replace(`{${name}}`, String(value)), translate(key));
  const endpoint = (path: string, params: Record<string, string>): string =>
    `${trackerPath}/${path}?${new URLSearchParams(params)}`;
  const isTimeTravelStatus = (value: unknown): value is Exclude<TimeTravelStatus, "idle" | "loading"> =>
    value === "available" ||
    value === "unavailable" ||
    value === "sdk-error" ||
    value === "network-error" ||
    value === "invalid-data";
  const timeTravelMessage = (status: TimeTravelStatus, subject: "timePoint" | "snapshot"): string =>
    status === "unavailable"
      ? translate(`tracker.${subject}Unavailable`)
      : translate(`tracker.${subject}Error.${status}`);
  const metadataMessage = (status: CatalogStatus | null): string =>
    status === null
      ? translate("tracker.loadingMetadata")
      : status === "available"
        ? translate("tracker.unavailable")
        : translate(`tracker.metadataError.${status}`);
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
  const toNumber = (value: unknown): number | null => {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const normalizePoint = (value: unknown, rank: number): GraphPoint | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const score = toNumber(record.score ?? record.eventPoint ?? record.rankingScore);
    return score === null
      ? null
      : { rank: toNumber(record.rank ?? record.ranking) ?? rank, score, timestamp: typeof record.timestamp === "string" ? record.timestamp : null };
  };
  const fetchGraphPoints = async (eventId: number, rank: number, timestamp?: string): Promise<GraphPoint[]> => {
    const params: Record<string, string> = { eventId: String(eventId), rank: String(rank) };
    if (timestamp) params.timestamp = timestamp;
    const response = await fetch(endpoint("graph", params));
    const payload = (await response.json()) as { status?: string; points?: unknown };
    if (!response.ok || payload.status !== "available" || !Array.isArray(payload.points)) throw new Error("Ranking graph unavailable");
    return payload.points.map((point) => normalizePoint(point, rank)).filter((point): point is GraphPoint => point !== null);
  };
  const openDetails = (row: TrackerRow<SharedEventRewardRangeResponse>): void => {
    if (row.status === "unavailable") return;
    selectedRow = row;
    graphRequestToken += 1;
    graphIdentity = null;
    graphPoints = [];
    graphStatus = "idle";
    if (!detailsDialog?.open) detailsDialog?.showModal();
  };
  const closeDetails = (): void => {
    graphRequestToken += 1;
    detailsDialog?.close();
    selectedRow = null;
    graphIdentity = null;
    graphPoints = [];
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
    graphMode = requestTimestamp ? "snapshot" : "trend";
    try {
      let points = await fetchGraphPoints(requestEventKey, requestRank, requestTimestamp ?? undefined);
      if (requestTimestamp && points.length < 2) {
        points = await fetchGraphPoints(requestEventKey, requestRank);
      }
      if (requestToken !== graphRequestToken || eventKey !== requestEventKey || graphIdentity?.eventId !== requestEventKey || graphIdentity.rank !== requestRank) return;
      if (requestTimestamp && points.length < 2) graphMode = "trend";
      graphPoints = points;
      graphStatus = points.length ? "available" : "empty";
    } catch {
      if (requestToken !== graphRequestToken || eventKey !== requestEventKey || graphIdentity?.eventId !== requestEventKey || graphIdentity.rank !== requestRank) return;
      graphStatus = "error";
    }
  };
  const openPrimaryGraph = (): void => {
    if (!primaryGraphRow) return;
    openDetails(primaryGraphRow);
    void openGraph(primaryGraphRow);
  };
  const returnToLatest = (): void => {
    snapshotRankings = null;
    snapshotTimestamp = null;
    snapshotStatus = "idle";
  };
  const loadTimePoints = async (requestEventKey: number | null): Promise<void> => {
    const requestToken = ++timePointsRequestToken;
    if (typeof window === "undefined" || requestEventKey === null) {
      timePointsStatus = "idle";
      return;
    }
    timePointsStatus = "loading";
    try {
      const response = await fetch(endpoint("time", { eventId: String(requestEventKey) }));
      const payload = (await response.json()) as { status?: string; timePoints?: unknown };
      if (requestToken !== timePointsRequestToken || eventKey !== requestEventKey) return;
      timePoints = payload.status === "available" && Array.isArray(payload.timePoints)
        ? payload.timePoints.filter((point): point is string => typeof point === "string")
        : [];
      timePointsStatus = payload.status === "available"
        ? timePoints.length ? "available" : "unavailable"
        : isTimeTravelStatus(payload.status)
          ? payload.status
          : "invalid-data";
    } catch {
      if (requestToken !== timePointsRequestToken || eventKey !== requestEventKey) return;
      timePoints = [];
      timePointsStatus = "network-error";
    }
  };
  const loadSnapshot = async (timestamp: string): Promise<void> => {
    if (eventKey === null) return;
    const requestToken = ++snapshotRequestToken;
    const requestEventKey = eventKey;
    snapshotStatus = "loading";
    try {
      const response = await fetch(endpoint("snapshot", { eventId: String(requestEventKey), timestamp }));
      const payload = (await response.json()) as { status?: string; rankings?: typeof data.rankings };
      if (requestToken !== snapshotRequestToken || eventKey !== requestEventKey) return;
      if (payload.status !== "available" || !Array.isArray(payload.rankings)) {
        snapshotStatus = isTimeTravelStatus(payload.status) ? payload.status : "invalid-data";
        return;
      }
      snapshotRankings = payload.rankings;
      snapshotTimestamp = timestamp;
      snapshotStatus = "idle";
    } catch {
      if (requestToken !== snapshotRequestToken || eventKey !== requestEventKey) return;
      snapshotStatus = "network-error";
    }
  };
  const queueSnapshot = (): void => {
    const timestamp = timePoints[timePointIndex];
    if (!timestamp) return;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => void loadSnapshot(timestamp), 200);
  };
  const graphY = (score: number): number =>
    38 - ((score - graphMinimum) / Math.max(graphMaximum - graphMinimum, 1)) * 34;

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
      void loadTimePoints(requestEventKey);
    }
  });
  $effect(() => {
    let cancelled = false;
    catalog = null;
    rewards = null;
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
      const timer = window.setTimeout(() => void refresh(), Math.max(0, nextRefreshAt - Date.now()));
      return () => window.clearTimeout(timer);
    }
  });
  $effect(() => {
    void Promise.resolve(data.i18nMessages).then((value) => (messages = { ...fallbackMessages, ...value }));
  });
</script>

<svelte:head><title>{translate("tracker.title")} | Sekai Viewer - Tools</title></svelte:head>

<main class="tracker-canvas" aria-labelledby="tracker-title">
  <header class="tracker-context">
    <div class="tracker-title-block">
      <p class="tracker-kicker">{interpolate("tracker.currentRegion", { region: translate(`region.${data.region}`) })}</p>
      <h1 id="tracker-title">{translate("tracker.title")}</h1>
      <p class="tracker-context-event" role={catalogStatus !== null && catalogStatus !== "available" ? "alert" : undefined}>{selectedEvent?.name ?? metadataMessage(catalogStatus)}</p>
    </div>
    <div class="tracker-live-status" aria-live="polite">
      <span class:badge-success={phase === "live"} class="badge badge-outline">{phase === "live" ? translate("tracker.live") : phase === "finished" ? translate("tracker.savedRankings") : translate("tracker.phaseUnavailable")}</span>
      <span>{interpolate("tracker.loadedAt", { time: formatTimestamp(data.loadedAt) })}</span>
      {#if nextRefreshSeconds !== null}<span>{interpolate("tracker.autoRefresh", { seconds: nextRefreshSeconds })}</span>{/if}
      <button class="btn btn-square btn-sm btn-outline" type="button" onclick={refresh} disabled={isRefreshing} aria-label={isRefreshing ? translate("tracker.refreshing") : translate("tracker.refreshRankings")} title={isRefreshing ? translate("tracker.refreshing") : translate("tracker.refreshRankings")}><Icon icon={isRefreshing ? "mdi:loading" : "mdi:refresh"} aria-hidden="true" /></button>
    </div>
  </header>

  <section class="tracker-control-deck" aria-label={translate("tracker.eventSelection")}>
    <div class="tracker-event-picker">
      <div class="tracker-event-controls">
        {#if data.selection.eventId === null}
          <span class="badge badge-primary" aria-current="page">{translate("tracker.currentEvent")}</span>
        {:else}
          <a class="btn btn-sm btn-outline" href={trackerPath}>{translate("tracker.currentEvent")}</a>
        {/if}
        <form method="get" action={trackerPath}>
          <label for="tracker-event-id">{translate("tracker.openEventId")}</label>
          <div class="join">
            <input id="tracker-event-id" class="input input-sm join-item" name="eventId" type="text" inputmode="numeric" pattern="[0-9]*" value={data.selection.eventId ?? ""} placeholder={translate("tracker.eventIdPlaceholder")} />
            <button class="btn btn-sm join-item" type="submit">{translate("tracker.openEvent")}</button>
          </div>
        </form>
        {#if hasEventCatalog}
          <button class:btn-active={isEventBrowserOpen} class="btn btn-sm btn-outline" type="button" aria-expanded={isEventBrowserOpen} aria-controls="tracker-event-browser" onclick={() => (isEventBrowserOpen = !isEventBrowserOpen)}>{translate("tracker.browseEvents")}</button>
        {/if}
      </div>
    </div>
    {#if hasEventCatalog && isEventBrowserOpen}
      <div id="tracker-event-browser" class="tracker-catalog-browser">
        <label for="tracker-event-search">{translate("tracker.searchEvents")}</label>
        <input id="tracker-event-search" class="input input-sm" type="search" bind:value={eventQuery} onfocus={() => (isEventBrowserOpen = true)} placeholder={translate("tracker.searchEventsPlaceholder")} />
        {#if visibleMatchingEvents.length}
          <ul class="tracker-event-suggestions" aria-label={translate("tracker.eventSuggestions")}>
            {#each visibleMatchingEvents as event (event.id)}
              <li><a href={`${trackerPath}?${new URLSearchParams({ eventId: String(event.id) })}`} aria-current={data.selection.eventId === event.id ? "page" : undefined}><span>{event.name}</span><small>#{event.id}</small></a></li>
            {/each}
          </ul>
        {:else}
          <p class="tracker-catalog-note" role="status">{translate("tracker.noMatchingEvents")}</p>
        {/if}
      </div>
    {:else if listStatus !== null && listStatus !== "available"}
      <p class="tracker-catalog-note">{translate("tracker.eventListUnavailable")}</p>
    {:else if catalogStatus === "available"}
      <p class="tracker-catalog-note">{translate("tracker.noCatalogEvents")}</p>
    {/if}
    <div class="tracker-control-row">
      <div class="tracker-ladder-control"><span class="tracker-control-label">{translate("tracker.rankings")}</span><div class="join" aria-label={translate("tracker.ranks.all")}><button class:btn-active={ladder === "critical"} class="btn btn-sm join-item" type="button" onclick={() => (ladder = "critical")}>{translate("tracker.ranks.critical")}</button><button class:btn-active={ladder === "full"} class="btn btn-sm join-item" type="button" onclick={() => (ladder = "full")}>{translate("tracker.ranks.all")}</button></div></div>
      <div class="tracker-history-control">
        <div><span class="tracker-control-label">{translate("tracker.timeTravel")}</span><p>{translate("tracker.historyDescription")}</p></div>
        {#if timePointsStatus === "available"}
          <div class="tracker-time-control"><label for="tracker-time-point">{translate("tracker.timePoint")}</label><input id="tracker-time-point" class="range range-primary range-sm" type="range" min="0" max={timePoints.length - 1} bind:value={timePointIndex} oninput={queueSnapshot} aria-valuetext={formatTimestamp(timePoints[timePointIndex])} /><output for="tracker-time-point">{formatTimestamp(timePoints[timePointIndex])}</output></div>
        {:else}
          <p class="tracker-time-note" role={timePointsStatus === "idle" || timePointsStatus === "loading" ? "status" : timePointsStatus === "unavailable" ? undefined : "alert"}>{timePointsStatus === "idle" || timePointsStatus === "loading" ? translate("tracker.snapshotLoading") : timeTravelMessage(timePointsStatus, "timePoint")}</p>
        {/if}
      </div>
    </div>
  </section>

  {#if snapshotTimestamp}<div class="tracker-snapshot-banner"><span>{interpolate("tracker.snapshotAt", { time: formatTimestamp(snapshotTimestamp) })}</span><button class="btn btn-sm btn-outline" type="button" onclick={returnToLatest}>{translate("tracker.latest")}</button></div>{/if}
  {#if snapshotStatus === "loading"}<p role="status">{translate("tracker.snapshotLoading")}</p>{/if}
  {#if snapshotStatus !== "idle" && snapshotStatus !== "loading"}<p role={snapshotStatus === "unavailable" ? undefined : "alert"}>{timeTravelMessage(snapshotStatus, "snapshot")}</p>{/if}

  <section class="tracker-ranking-workspace" aria-labelledby="tracker-results-title">
    <div class="tracker-workspace-heading"><div><p class="tracker-kicker">{phase === "live" ? translate("tracker.live") : phase === "finished" ? translate("tracker.savedRankings") : translate("tracker.phaseUnavailable")}</p><h2 id="tracker-results-title">{translate("tracker.rankings")}</h2></div><div class="tracker-results-actions"><span>{interpolate("tracker.rankCount", { count: rows.length })}</span>{#if primaryGraphRow}<button class="btn btn-sm btn-outline" type="button" onclick={openPrimaryGraph}>{translate("tracker.viewRankingHistory")}</button>{/if}</div></div>
    {#if isInvalidSelection}<p role="alert">{translate("tracker.eventIdInvalid")}</p>
    {:else if trackerStatus === "upstream-error"}<p role="alert">{translate("tracker.error.historyUpstream")}</p>
    {:else if trackerStatus === "sdk-error"}<p role="alert">{translate("tracker.error.sdk")}</p>
    {:else if trackerStatus === "network-error"}<p role="alert">{translate("tracker.error.network")}</p>
    {:else if trackerStatus === "invalid-data"}<p role="alert">{translate("tracker.error.invalidData")}</p>
    {:else if trackerStatus !== "available"}<p role="status">{translate("tracker.loading")}</p>
    {:else}
      <div class="tracker-table-wrap"><table class="table tracker-table"><thead><tr><th scope="col">{translate("tracker.rank")}</th><th scope="col">{translate("tracker.player")}</th><th scope="col">{translate("tracker.score")}</th><th scope="col">{translate("tracker.speed")}</th><th scope="col">{translate("tracker.degree")}</th></tr></thead><tbody>{#each rows as row (row.ladderRank)}<tr class:tracker-unavailable={row.status === "unavailable"}><th scope="row">{#if row.status === "available"}<button class="btn btn-ghost btn-sm" type="button" onclick={() => openDetails(row)} aria-label={interpolate("tracker.openRankDetails", { rank: row.ladderRank })}>#{formatNumber(row.ladderRank)} <span class="tracker-row-affordance">{translate("tracker.viewTrend")}</span></button>{:else}#{formatNumber(row.ladderRank)}{/if}</th><td>{row.ranking?.userName ?? row.ranking?.userId ?? translate("tracker.unavailable")}</td><td>{formatNumber(row.score)}</td><td>{formatSpeed(row.speedPerHour)}</td><td>{formatRewardRange(row.reward)}</td></tr>{/each}</tbody></table></div>
      <div class="tracker-ranking-cards">{#each rows as row (row.ladderRank)}{#if row.status === "available"}<button class="tracker-ranking-card" type="button" onclick={() => openDetails(row)}><strong>#{formatNumber(row.ladderRank)}</strong><span>{row.ranking?.userName ?? row.ranking?.userId ?? translate("tracker.unavailable")}</span><span>{translate("tracker.score")}: {formatNumber(row.score)}</span><span>{translate("tracker.speed")}: {formatSpeed(row.speedPerHour)}</span><span>{translate("tracker.degree")}: {formatRewardRange(row.reward)}</span><span class="tracker-row-affordance">{translate("tracker.viewTrend")}</span></button>{:else}<article class="tracker-ranking-card tracker-unavailable"><strong>#{formatNumber(row.ladderRank)}</strong><span>{translate("tracker.unavailable")}</span></article>{/if}{/each}</div>
    {/if}
  </section>

</main>

<dialog bind:this={detailsDialog} class="modal tracker-dialog" aria-labelledby="tracker-details-title" onclose={closeDetails}>
  <div class="modal-box">
    <div class="tracker-workspace-heading"><h2 id="tracker-details-title">{selectedRow ? interpolate("tracker.detailRank", { rank: selectedRow.ladderRank }) : translate("tracker.playerDetails")}</h2><button class="btn btn-square btn-sm btn-ghost" type="button" onclick={closeDetails} aria-label={translate("tracker.detailsClose")}><Icon icon="mdi:close" aria-hidden="true" /></button></div>
    {#if selectedRow}
      <dl class="tracker-detail-grid"><div><dt>{translate("tracker.player")}</dt><dd>{selectedRow.ranking?.userName ?? selectedRow.ranking?.userId ?? translate("tracker.unavailable")}</dd></div><div><dt>{translate("tracker.userId")}</dt><dd>{selectedRow.ranking?.userId ?? translate("tracker.unavailable")}</dd></div><div><dt>{translate("tracker.degree")}</dt><dd>{formatRewardRange(selectedRow.reward)}</dd></div><div><dt>{translate("tracker.score")}</dt><dd>{formatNumber(selectedRow.score)}</dd></div><div><dt>{translate("tracker.speed")}</dt><dd>{formatSpeed(selectedRow.speedPerHour)}</dd></div><div><dt>{translate("tracker.capturedAt")}</dt><dd>{formatTimestamp(selectedRow.ranking?.timestamp)}</dd></div></dl>
      {#if eventKey !== null}<button class="btn btn-primary" type="button" onclick={() => void openGraph()}>{translate("tracker.openHistoryGraph")}</button>{/if}
      {#if graphStatus === "loading"}<p role="status">{translate("tracker.graphLoading")}</p>{:else if graphStatus === "available"}<section><h3>{translate("tracker.graph")} · {graphMode === "trend" ? translate("tracker.graphTrend") : translate("tracker.graphSnapshot")}</h3><svg class="tracker-graph" viewBox="0 0 100 40" role="img" aria-label={translate("tracker.graph")}><polyline points={graphPoints.map((point, index) => `${(index / Math.max(graphPoints.length - 1, 1)) * 96 + 2},${graphY(point.score)}`).join(" ")} fill="none" /></svg><p>{translate("tracker.graphRange")} {formatNumber(graphMinimum)}–{formatNumber(graphMaximum)}</p></section>{:else if graphStatus === "empty" || graphStatus === "error"}<p>{translate("tracker.graphUnavailable")}</p>{/if}
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop"><button aria-label={translate("tracker.detailsClose")}>{translate("tracker.detailsClose")}</button></form>
</dialog>

<style>
  .tracker-canvas { max-width: 82rem; margin: 0 auto; padding: clamp(1rem, 3vw, 2rem); display: grid; gap: 1rem; }
  .tracker-context { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1rem; border-top: 3px solid var(--color-primary); padding: 1.25rem 0 1rem; }
  .tracker-title-block h1 { font-size: clamp(1.75rem, 4vw, 2.6rem); font-weight: 800; letter-spacing: -.04em; }
  .tracker-live-status, .tracker-event-controls, .tracker-workspace-heading, .tracker-snapshot-banner, .tracker-results-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
  .tracker-kicker { color: var(--color-primary); font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .tracker-context-event, .tracker-history-control p, .tracker-time-note, .tracker-catalog-note { color: color-mix(in srgb, var(--color-base-content) 70%, transparent); }
  .tracker-live-status { color: color-mix(in srgb, var(--color-base-content) 65%, transparent); font-size: .78rem; }
  .tracker-control-deck { display: grid; gap: .75rem; border: 1px solid var(--archive-border-subtle); border-radius: var(--radius-box); background: var(--archive-surface-raised); padding: .75rem 1rem; }
  .tracker-event-picker, .tracker-control-row { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1rem; }
  .tracker-control-row { align-items: stretch; border-top: 1px solid var(--archive-border-subtle); padding-top: 1rem; }
  .tracker-ladder-control, .tracker-history-control { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; }
  .tracker-history-control { flex: 1 1 28rem; justify-content: space-between; }
  .tracker-control-label { display: block; color: color-mix(in srgb, var(--color-base-content) 65%, transparent); font-size: .72rem; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
  .tracker-history-control p { margin-top: .25rem; font-size: .82rem; }
  .tracker-event-controls form, .tracker-time-control, .tracker-catalog-browser { display: grid; gap: .35rem; }
  .tracker-event-controls input { min-width: 8rem; }
  .tracker-catalog-browser { border-top: 1px solid var(--archive-border-subtle); padding-top: .75rem; }
  .tracker-event-suggestions { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: .5rem; max-height: 17rem; margin: .15rem 0 0; padding: 0; overflow-y: auto; list-style: none; }
  .tracker-event-suggestions a { display: flex; align-items: center; justify-content: space-between; gap: .75rem; border: 1px solid var(--archive-border-subtle); border-radius: var(--radius-field); padding: .6rem .75rem; color: inherit; text-decoration: none; transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease; }
  .tracker-event-suggestions a:hover, .tracker-event-suggestions a:focus-visible { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, transparent); outline: none; transform: translateY(-1px); }
  .tracker-event-suggestions a[aria-current="page"] { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 13%, transparent); }
  .tracker-event-suggestions small { flex: none; color: color-mix(in srgb, var(--color-base-content) 58%, transparent); font-variant-numeric: tabular-nums; }
  .tracker-time-control { display: grid; min-width: min(24rem, 100%); gap: .35rem; }
  .tracker-ranking-workspace { display: grid; gap: 1rem; border: 1px solid color-mix(in srgb, var(--color-primary) 30%, var(--archive-border-subtle)); border-radius: 1.25rem; background: var(--archive-surface-default); padding: clamp(1rem, 2.5vw, 1.5rem); box-shadow: 0 12px 28px color-mix(in srgb, var(--color-primary) 8%, transparent); }
  .tracker-workspace-heading h2 { font-size: 1.35rem; font-weight: 800; }
  .tracker-table-wrap { overflow-x: auto; border: 1px solid var(--archive-border-subtle); border-radius: var(--radius-box); background: var(--archive-surface-sunken); }
  .tracker-table { min-width: 48rem; }
  .tracker-unavailable { color: color-mix(in srgb, var(--color-base-content) 55%, transparent); }
  .tracker-ranking-cards { display: none; }
  .tracker-ranking-card { display: grid; width: 100%; gap: .5rem; padding: 1rem; border: 1px solid var(--archive-border-subtle); border-radius: var(--radius-box); background: var(--archive-panel); color: inherit; text-align: left; }
  .tracker-row-affordance { color: var(--color-primary); font-size: .7rem; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
  .tracker-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
  dt { color: color-mix(in srgb, var(--color-base-content) 58%, transparent); font-size: .72rem; font-weight: 750; } dd { margin: 0; overflow-wrap: anywhere; }
  .tracker-graph { width: 100%; min-height: 12rem; } .tracker-graph polyline { stroke: var(--color-primary); stroke-width: 1.2; }
  @media (max-width: 47.999rem) { .tracker-context, .tracker-event-picker, .tracker-control-row, .tracker-history-control { align-items: stretch; } .tracker-event-controls { align-items: end; } .tracker-event-controls form { flex: 1 1 12rem; } .tracker-event-controls input { width: 100%; min-width: 0; } .tracker-event-suggestions { grid-template-columns: 1fr; } .tracker-time-control { min-width: 100%; } .tracker-table-wrap { display: none; } .tracker-ranking-cards { display: grid; gap: .75rem; } .tracker-detail-grid { grid-template-columns: 1fr; } }
</style>
