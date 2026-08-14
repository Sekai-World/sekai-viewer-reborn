<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import { getTrackerRankLadder, type TrackerRankLadder } from "$lib/tracker-ladders";
  import { getNextTrackerRefreshDeadline, getTrackerPhase, parseTrackerTimestamp } from "$lib/tracker-phase";
  import { createTrackerRows, type TrackerRow } from "$lib/tracker-rows";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  type EventMetadata = { id: number; name: string; startAt: string | number | null; closedAt: string | number | null };
  type Catalog = { status: string; currentEvent: EventMetadata | null; eligibleEvents: EventMetadata[] };
  type GraphPoint = { rank: number; score: number; timestamp: string | null };
  type ExtendedData = PageData & { catalog?: Promise<Catalog>; status?: string };

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "comparison", "tracker"]);
  let messages = $state(fallbackMessages);
  let eventId = $state("");
  let isRefreshing = $state(false);
  let ladder = $state<TrackerRankLadder>("critical");
  let expandedRank = $state<number | null>(null);
  let now = $state(Date.now());
  let catalog = $state<Catalog | null>(null);
  let timePoints = $state<string[]>([]);
  let timePointsStatus = $state<"idle" | "loading" | "available" | "error">("idle");
  let timePointIndex = $state(0);
  let snapshotRankings = $state<typeof data.rankings | null>(null);
  let snapshotTimestamp = $state<string | null>(null);
  let snapshotStatus = $state<"idle" | "loading" | "error">("idle");
  let graphRank = $state<number | null>(null);
  let graphPoints = $state<GraphPoint[]>([]);
  let graphMode = $state<"snapshot" | "trend">("snapshot");
  let graphStatus = $state<"idle" | "loading" | "available" | "empty" | "error">("idle");
  let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

  const extendedData = $derived(data as ExtendedData);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const trackerPath = $derived(resolve("/tracker/[region]", { region: data.region }));
  const trackerStatus = $derived(String(extendedData.status ?? ""));
  const isInvalidSelection = $derived(data.selectionStatus === "invalid-event-id");
  const selectedEvent = $derived.by(() => {
    if (!catalog) return null;
    return data.selection.eventId === null
      ? catalog.currentEvent
      : catalog.eligibleEvents.find((event) => event.id === data.selection.eventId) ?? null;
  });
  const eventKey = $derived(data.selection.eventId ?? catalog?.currentEvent?.id ?? null);
  const phase = $derived(getTrackerPhase({ startAt: selectedEvent?.startAt, aggregateAt: selectedEvent?.closedAt, now }));
  const elapsedMs = $derived.by(() => {
    const start = parseTrackerTimestamp(selectedEvent?.startAt);
    const loaded = parseTrackerTimestamp(data.loadedAt);
    return start !== null && loaded !== null && loaded > start ? loaded - start : null;
  });
  const displayRankings = $derived(snapshotRankings ?? data.rankings);
  const rows = $derived(createTrackerRows({ ladderRanks: getTrackerRankLadder(ladder), rankings: displayRankings, elapsedMs }));
  const selectedRow = $derived(expandedRank === null ? null : rows.find((row) => row.ladderRank === expandedRank && row.ranking) ?? null);
  const nextRefreshAt = $derived(getNextTrackerRefreshDeadline({ aggregateAt: selectedEvent?.closedAt ?? null, now }));
  const nextRefreshSeconds = $derived(nextRefreshAt === null ? null : Math.max(0, Math.ceil((nextRefreshAt - now) / 1000)));

  const formatNumber = (value: number | null): string => value === null ? translate("tracker.unavailable") : new Intl.NumberFormat(data.uiLocale).format(value);
  const formatTimestamp = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return translate("tracker.unavailable");
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? translate("tracker.unavailable") : new Intl.DateTimeFormat(data.uiLocale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const interpolate = (key: string, values: Record<string, string | number>): string => Object.entries(values).reduce((message, [name, value]) => message.replace(`{${name}}`, String(value)), translate(key));
  const endpoint = (path: string, params: Record<string, string>): string => `${trackerPath}/${path}?${new URLSearchParams(params)}`;
  const refresh = async (): Promise<void> => {
    isRefreshing = true;
    try { await invalidate("tools-site:tracker:rankings"); } finally { isRefreshing = false; }
  };
  const toNumber = (value: unknown): number | null => {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const normalizePoint = (value: unknown, rank: number): GraphPoint | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const score = toNumber(record.score ?? record.eventPoint ?? record.rankingScore);
    if (score === null) return null;
    return { rank: toNumber(record.rank ?? record.ranking) ?? rank, score, timestamp: typeof record.timestamp === "string" ? record.timestamp : null };
  };
  const fetchGraphPoints = async (rank: number, timestamp?: string): Promise<GraphPoint[]> => {
    if (eventKey === null) return [];
    const params: Record<string, string> = { eventId: String(eventKey), rank: String(rank) };
    if (timestamp) params.timestamp = timestamp;
    const response = await fetch(endpoint("graph", params));
    const payload = await response.json() as { status?: string; points?: unknown };
    return payload.status === "available" && Array.isArray(payload.points) ? payload.points.map((point) => normalizePoint(point, rank)).filter((point): point is GraphPoint => point !== null) : [];
  };
  const openGraph = async (rank: number): Promise<void> => {
    if (eventKey === null) return;
    graphRank = rank; graphStatus = "loading"; graphPoints = []; graphMode = snapshotTimestamp ? "snapshot" : "trend";
    try {
      let points = await fetchGraphPoints(rank, snapshotTimestamp ?? undefined);
      if (snapshotTimestamp && points.length < 2) { points = await fetchGraphPoints(rank); graphMode = "trend"; }
      graphPoints = points; graphStatus = points.length > 0 ? "available" : "empty";
    } catch { graphStatus = "error"; }
  };
  const closeGraph = (): void => { graphRank = null; graphPoints = []; graphStatus = "idle"; };
  const returnToLatest = (): void => { snapshotRankings = null; snapshotTimestamp = null; snapshotStatus = "idle"; closeGraph(); };
  const loadTimePoints = async (): Promise<void> => {
    if (typeof window === "undefined" || data.selection.mode !== "history" || data.selection.eventId === null) return;
    timePointsStatus = "loading";
    try {
      const response = await fetch(endpoint("time", { eventId: String(data.selection.eventId) }));
      const payload = await response.json() as { status?: string; timePoints?: unknown };
      timePoints = payload.status === "available" && Array.isArray(payload.timePoints) ? payload.timePoints.filter((point): point is string => typeof point === "string") : [];
      timePointsStatus = timePoints.length ? "available" : "error";
    } catch { timePoints = []; timePointsStatus = "error"; }
  };
  const loadSnapshot = async (timestamp: string): Promise<void> => {
    if (data.selection.eventId === null) return;
    snapshotStatus = "loading";
    try {
      const response = await fetch(endpoint("snapshot", { eventId: String(data.selection.eventId), timestamp }));
      const payload = await response.json() as { status?: string; rankings?: typeof data.rankings };
      if (payload.status !== "available" || !Array.isArray(payload.rankings)) throw new Error("snapshot unavailable");
      snapshotRankings = payload.rankings; snapshotTimestamp = timestamp; snapshotStatus = "idle";
    } catch { snapshotStatus = "error"; }
  };
  const queueSnapshot = (): void => {
    if (!timePoints[timePointIndex]) return;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => { void loadSnapshot(timePoints[timePointIndex]); }, 200);
  };
  const graphMinimum = $derived(graphPoints.length ? Math.min(...graphPoints.map((point) => point.score)) : 0);
  const graphMaximum = $derived(graphPoints.length ? Math.max(...graphPoints.map((point) => point.score)) : 0);
  const graphY = (score: number): number => 38 - ((score - graphMinimum) / Math.max(graphMaximum - graphMinimum, 1)) * 34;
  const graphPointsLabel = $derived(interpolate("tracker.graphPoints", { count: graphPoints.length }));

  onMount(() => {
    const clock = window.setInterval(() => { now = Date.now(); }, 1000);
    return () => { window.clearInterval(clock); if (snapshotTimer) clearTimeout(snapshotTimer); };
  });
  $effect(() => { if (typeof window !== "undefined") { void loadTimePoints(); timePointIndex = 0; returnToLatest(); } });
  $effect(() => {
    let cancelled = false;
    catalog = null;
    if (extendedData.catalog) void extendedData.catalog.then((value) => { if (!cancelled) catalog = value; }).catch(() => { if (!cancelled) catalog = { status: "network-error", currentEvent: null, eligibleEvents: [] }; });
    return () => { cancelled = true; };
  });
  $effect(() => { if (nextRefreshAt !== null && !isRefreshing) { const timer = window.setTimeout(() => void refresh(), Math.max(0, nextRefreshAt - Date.now())); return () => window.clearTimeout(timer); } });
  $effect(() => { void Promise.resolve(data.i18nMessages).then((value) => { messages = { ...fallbackMessages, ...value }; }); });
</script>

<svelte:head><title>{translate("tracker.title")}</title></svelte:head>

<div class="archive-canvas tracker-canvas">
  <header class="tracker-context archive-panel">
    <div><p class="tracker-kicker">{interpolate("tracker.currentRegion", { region: translate(`region.${data.region}`) })}</p><h1 id="tracker-title">{translate("tracker.title")}</h1><p class="tracker-context-event">{selectedEvent?.name ?? translate("tracker.loadingMetadata")}</p></div>
    <div class="tracker-context-meta"><span class="badge {trackerStatus === 'available' ? 'badge-success' : 'badge-warning'}">{data.selection.mode === "live" ? translate("tracker.live") : translate("tracker.historical")}</span><span>{interpolate("tracker.loadedAt", { time: formatTimestamp(data.loadedAt) })}</span>{#if nextRefreshSeconds !== null}<span>{translate("tracker.nextRefresh")} · {nextRefreshSeconds}s</span>{/if}<button class="btn tracker-touch-action btn-sm btn-outline" type="button" onclick={refresh} disabled={isRefreshing} aria-label={isRefreshing ? translate("tracker.refreshing") : translate("tracker.refreshRankings")} title={translate("tracker.refreshRankings")}>{isRefreshing ? translate("tracker.loading") : translate("tracker.refreshRankings")}</button></div>
  </header>

  <section class="tracker-toolbar archive-panel" aria-labelledby="tracker-toolbar-title"><h2 id="tracker-toolbar-title" class="sr-only">{translate("tracker.toolbar")}</h2><form class="tracker-picker" method="get" action={trackerPath}><label for="tracker-event-id">{translate("tracker.eventId")}</label><div><input id="tracker-event-id" class="input input-bordered" name="eventId" type="number" min="1" step="1" bind:value={eventId} required /><button class="btn tracker-touch-action btn-primary" type="submit">{translate("tracker.showEvent")}</button></div></form>{#if catalog?.status === "available" && catalog.currentEvent}<a class="btn tracker-touch-action btn-outline" href={`${trackerPath}?eventId=${catalog.currentEvent.id}`}>{translate("tracker.currentEvent")}</a>{/if}<div class="join tracker-ladder" aria-label={translate("tracker.ranks.all")}><button class:btn-active={ladder === "critical"} class="btn tracker-touch-action join-item" type="button" onclick={() => (ladder = "critical")}>{translate("tracker.ranks.critical")}</button><button class:btn-active={ladder === "full"} class="btn tracker-touch-action join-item" type="button" onclick={() => (ladder = "full")}>{translate("tracker.ranks.all")}</button></div>{#if timePointsStatus === "available"}<div class="tracker-time-control"><label for="tracker-time-point">{translate("tracker.timePoint")}</label><input id="tracker-time-point" class="range" type="range" min="0" max={timePoints.length - 1} bind:value={timePointIndex} oninput={queueSnapshot} aria-valuetext={formatTimestamp(timePoints[timePointIndex])} /><output for="tracker-time-point">{formatTimestamp(timePoints[timePointIndex])}</output></div>{:else}<span class="tracker-time-note">{timePointsStatus === "loading" ? translate("tracker.snapshotLoading") : translate("tracker.timePointUnavailable")}</span>{/if}</section>

  {#if snapshotTimestamp}<div class="tracker-snapshot-banner"><span>{interpolate("tracker.snapshotAt", { time: formatTimestamp(snapshotTimestamp) })}</span><button class="btn tracker-touch-action btn-sm btn-outline" type="button" onclick={returnToLatest}>{translate("tracker.latest")}</button></div>{/if}
  {#if snapshotStatus === "loading"}<p class="tracker-local-status" role="status">{translate("tracker.snapshotLoading")}</p>{/if}{#if snapshotStatus === "error"}<p class="tracker-local-error" role="alert">{translate("tracker.snapshotError")}</p>{/if}

  <section class="tracker-workspace" aria-labelledby="tracker-results-title">
    <div class="tracker-ranking-workspace"><div class="tracker-workspace-heading"><div><p class="tracker-kicker">{phase === "live" ? translate("tracker.live") : translate("tracker.historical")}</p><h2 id="tracker-results-title">{translate("tracker.rankings")}</h2></div><span class="tracker-density-note">{interpolate("tracker.rankCount", { count: rows.length })}</span></div>
      {#if isInvalidSelection}<p class="tracker-empty" role="alert">{translate("tracker.eventIdInvalid")}</p>{:else if trackerStatus === "upstream-error"}<p class="tracker-empty" role="alert">{translate("tracker.error.historyUpstream")}</p>{:else if trackerStatus === "sdk-error"}<p class="tracker-empty" role="alert">{translate("tracker.error.sdk")}</p>{:else if trackerStatus === "network-error"}<p class="tracker-empty" role="alert">{translate("tracker.error.network")}</p>{:else if trackerStatus === "invalid-data"}<p class="tracker-empty" role="alert">{translate("tracker.error.invalidData")}</p>{:else if trackerStatus !== "available"}<p class="tracker-empty" role="status">{translate("tracker.loading")}</p>{:else if rows.length === 0}<p class="tracker-empty" role="status">{translate("tracker.empty")}</p>{:else}
        <div class="tracker-table-wrap"><table class="table tracker-table"><thead><tr><th scope="col">{translate("tracker.rank")}</th><th scope="col">{translate("tracker.player")}</th><th scope="col">{translate("tracker.score")}</th><th scope="col">{translate("tracker.speed")}</th><th scope="col">{translate("tracker.reward")}</th><th scope="col">{translate("tracker.details")}</th></tr></thead><tbody>{#each rows as row (row.ladderRank)}<tr class:tracker-unavailable={row.status === "unavailable"}><th scope="row">{formatNumber(row.ladderRank)}</th><td>{row.ranking?.userName ?? row.ranking?.userId ?? translate("tracker.unavailable")}</td><td>{formatNumber(row.score)}</td><td>{formatNumber(row.speedPerHour)}</td><td>{row.reward ? translate("tracker.available") : translate("tracker.unavailable")}</td><td><button class="btn tracker-touch-action btn-sm btn-outline" type="button" onclick={() => (expandedRank = expandedRank === row.ladderRank ? null : row.ladderRank)} aria-expanded={expandedRank === row.ladderRank} aria-controls="tracker-inspector-detail">{translate("tracker.details")}</button></td></tr>{/each}</tbody></table></div>
        <div class="tracker-ranking-cards">{#each rows as row (row.ladderRank)}<article class="tracker-ranking-card" class:tracker-unavailable={row.status === "unavailable"}><div class="tracker-card-top"><strong>#{formatNumber(row.ladderRank)}</strong><span>{row.status === "available" ? translate("tracker.available") : translate("tracker.unavailable")}</span></div><strong class="tracker-card-player">{row.ranking?.userName ?? row.ranking?.userId ?? translate("tracker.unavailable")}</strong><div class="tracker-card-metrics"><span><small>{translate("tracker.score")}</small>{formatNumber(row.score)}</span><span><small>{translate("tracker.speed")}</small>{formatNumber(row.speedPerHour)}</span></div><div class="tracker-card-actions"><button class="btn tracker-touch-action btn-sm btn-outline" type="button" onclick={() => (expandedRank = expandedRank === row.ladderRank ? null : row.ladderRank)} aria-expanded={expandedRank === row.ladderRank} aria-controls={`tracker-detail-${row.ladderRank}`}>{translate("tracker.details")}</button>{#if eventKey !== null}<button class="btn tracker-touch-action btn-sm btn-outline" type="button" onclick={() => void openGraph(row.ladderRank)}>{translate("tracker.graph")}</button>{/if}</div>{#if expandedRank === row.ladderRank && selectedRow}<div id={`tracker-detail-${row.ladderRank}`} class="tracker-detail-panel">{@render DetailPanel(selectedRow)}<button class="btn tracker-touch-action btn-sm btn-outline" type="button" onclick={() => (expandedRank = null)}>{translate("tracker.detailsClose")}</button></div>{/if}</article>{/each}</div>
      {/if}
    </div>
    <aside class="tracker-inspector" aria-label={translate("tracker.playerDetails")}>{#if selectedRow}<div id="tracker-inspector-detail" class="tracker-detail-panel"><div class="tracker-inspector-heading"><div><p class="tracker-kicker">{translate("tracker.playerDetails")}</p><h3>{interpolate("tracker.detailRank", { rank: selectedRow.ladderRank })}</h3></div><button class="btn tracker-touch-action btn-sm btn-outline" type="button" onclick={() => (expandedRank = null)}>{translate("tracker.detailsClose")}</button></div>{@render DetailPanel(selectedRow)}{#if eventKey !== null}<button class="btn tracker-touch-action btn-sm btn-primary" type="button" onclick={() => void openGraph(selectedRow.ladderRank)}>{translate("tracker.graph")}</button>{/if}{#if graphRank === selectedRow.ladderRank}<div class="tracker-graph-inspector"><div class="tracker-inspector-heading"><h4>{translate("tracker.graph")} · {graphMode === "trend" ? translate("tracker.graphTrend") : translate("tracker.graphSnapshot")}</h4><button class="btn tracker-touch-action btn-xs btn-ghost" type="button" onclick={closeGraph}>{translate("tracker.graphClose")}</button></div>{#if graphStatus === "loading"}<p role="status">{translate("tracker.graphLoading")}</p>{:else if graphStatus === "available"}<p>{graphPointsLabel} · {translate("tracker.graphLatest")} {formatNumber(graphPoints.at(-1)?.score ?? null)} · {translate("tracker.graphRange")} {formatNumber(graphMinimum)}–{formatNumber(graphMaximum)}</p><svg class="tracker-graph" viewBox="0 0 100 40" role="img" aria-label={translate("tracker.graph")}><polyline points={graphPoints.map((point, index) => `${(index / Math.max(graphPoints.length - 1, 1)) * 96 + 2},${graphY(point.score)}`).join(" ")} fill="none" />{#each graphPoints as point, index (index)}<circle cx={(index / Math.max(graphPoints.length - 1, 1)) * 96 + 2} cy={graphY(point.score)} r="1.5" />{/each}</svg>{:else}<p class="tracker-graph-placeholder">{translate("tracker.graphUnavailable")}</p>{/if}</div>{/if}</div>{:else}<div id="tracker-inspector-detail" class="tracker-inspector-empty"><p class="tracker-kicker">{translate("tracker.playerDetails")}</p><p>{translate("tracker.detailsHint")}</p></div>{/if}</aside>
  </section>
</div>

{#snippet DetailPanel(row: TrackerRow)}<dl class="tracker-detail-grid"><div><dt>{translate("tracker.rank")}</dt><dd>{formatNumber(row.ladderRank)}</dd></div><div><dt>{translate("tracker.player")}</dt><dd>{row.ranking?.userName ?? row.ranking?.userId ?? translate("tracker.unavailable")}</dd></div><div><dt>{translate("tracker.userId")}</dt><dd>{row.ranking?.userId ?? translate("tracker.unavailable")}</dd></div><div><dt>{translate("tracker.score")}</dt><dd>{formatNumber(row.score)}</dd></div><div><dt>{translate("tracker.capturedAt")}</dt><dd>{formatTimestamp(row.ranking?.timestamp)}</dd></div></dl>{/snippet}

<style>
  .tracker-canvas { max-width: 82rem; margin: 0 auto; padding: clamp(1rem, 3vw, 2rem); gap: 1rem; }
  .tracker-context, .tracker-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
  .tracker-context { border-top: 3px solid var(--color-primary); } .tracker-context h1, .tracker-workspace h2 { font-weight: 800; letter-spacing: -.03em; } .tracker-context-event { color: color-mix(in srgb, var(--color-base-content) 72%, transparent); font-weight: 650; }
  .tracker-kicker { color: var(--color-primary); font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; } .tracker-context-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .65rem; color: color-mix(in srgb, var(--color-base-content) 65%, transparent); font-size: .85rem; }
  .tracker-picker, .tracker-time-control { display: grid; gap: .3rem; } .tracker-picker > div { display: flex; gap: .5rem; } .tracker-picker input { width: 9rem; } .tracker-time-control { min-width: min(22rem, 100%); } .tracker-time-control output { color: color-mix(in srgb, var(--color-base-content) 70%, transparent); font-size: .8rem; }
  .tracker-touch-action { min-width: 2.75rem; min-height: 2.75rem; } .tracker-snapshot-banner, .tracker-local-status, .tracker-local-error { padding: .75rem 1rem; border-left: 3px solid var(--color-primary); background: color-mix(in srgb, var(--color-primary) 8%, transparent); } .tracker-snapshot-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; } .tracker-local-error { border-color: var(--color-error); color: var(--color-error); }
  .tracker-workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem); gap: 1rem; align-items: start; } .tracker-ranking-workspace, .tracker-inspector { min-width: 0; } .tracker-inspector { position: sticky; top: 1rem; } .tracker-workspace-heading, .tracker-inspector-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: 1rem; } .tracker-density-note { color: color-mix(in srgb, var(--color-base-content) 60%, transparent); font-size: .8rem; }
  .tracker-table-wrap { overflow-x: auto; border: 1px solid var(--archive-border-subtle); border-radius: var(--radius-box); } .tracker-table { min-width: 48rem; } .tracker-table th, .tracker-table td { vertical-align: middle; } .tracker-unavailable { color: color-mix(in srgb, var(--color-base-content) 55%, transparent); }
  .tracker-ranking-cards { display: none; } .tracker-detail-panel { display: grid; gap: .85rem; padding: 1rem; border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--archive-border-subtle)); border-radius: var(--radius-box); background: color-mix(in srgb, var(--color-primary) 5%, var(--archive-panel)); } .tracker-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; } dt { color: color-mix(in srgb, var(--color-base-content) 58%, transparent); font-size: .72rem; font-weight: 750; } dd { margin: 0; overflow-wrap: anywhere; } .tracker-inspector-empty { padding: 1rem; border: 1px dashed var(--archive-border-subtle); color: color-mix(in srgb, var(--color-base-content) 68%, transparent); } .tracker-graph { width: 100%; min-height: 12rem; margin-top: .75rem; } .tracker-graph polyline { stroke: var(--color-primary); stroke-width: 1.2; } .tracker-graph circle { fill: var(--color-primary); } .tracker-graph-placeholder { padding: 1rem; border: 1px dashed var(--archive-border-subtle); color: color-mix(in srgb, var(--color-base-content) 68%, transparent); } .tracker-empty { padding: 2rem 1rem; border: 1px dashed var(--archive-border-subtle); color: color-mix(in srgb, var(--color-base-content) 72%, transparent); text-align: center; }
  @media (max-width: 47.999rem) { .tracker-context, .tracker-toolbar { align-items: stretch; } .tracker-context-meta { align-items: stretch; } .tracker-picker, .tracker-picker input, .tracker-picker > div, .tracker-picker button { width: 100%; } .tracker-workspace { display: block; } .tracker-table-wrap, .tracker-inspector { display: none; } .tracker-ranking-cards { display: grid; gap: .75rem; } .tracker-ranking-card { display: grid; gap: .75rem; padding: 1rem; border: 1px solid var(--archive-border-subtle); border-radius: var(--radius-box); background: var(--archive-panel); } .tracker-card-top, .tracker-card-metrics, .tracker-card-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; } .tracker-card-player { font-size: 1.05rem; } .tracker-card-metrics span { display: grid; gap: .15rem; min-width: 7rem; } .tracker-card-metrics small { color: color-mix(in srgb, var(--color-base-content) 58%, transparent); font-size: .7rem; } }
  @media (prefers-reduced-motion: reduce) { .tracker-table tbody tr { transition: none; } }
</style>
