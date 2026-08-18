import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(process.cwd(), "src/routes/tracker/[region]/+page.svelte");
const homePagePath = resolve(process.cwd(), "src/routes/+page.svelte");
const layoutPath = resolve(process.cwd(), "src/routes/+layout.svelte");
const appCssPath = resolve(process.cwd(), "src/app.css");
const trackerMessagesPath = resolve(
  process.cwd(),
  "../../packages/i18n-source/tools-site/tracker.json"
);

describe("tracker page UI contract", () => {
  it("uses the tools-site title format and the shared Sekai Viewer brand lockup", async () => {
    const [trackerSource, homeSource, layoutSource, appCssSource, trackerMessagesSource] = await Promise.all([
      readFile(pagePath, "utf8"),
      readFile(homePagePath, "utf8"),
      readFile(layoutPath, "utf8"),
      readFile(appCssPath, "utf8"),
      readFile(trackerMessagesPath, "utf8")
    ]);

    expect(layoutSource).toContain("<title>Sekai Viewer - Tools</title>");
    expect(homeSource).toContain("<title>Sekai Viewer - Tools</title>");
    expect(homeSource).toContain('import { BrandLockup } from "@platform/ui-shell";');
    expect(homeSource).toContain("<BrandLockup />");
    expect(homeSource).toContain('<div class="tools-home-lockup"><BrandLockup /></div>');
    expect(homeSource.indexOf("tools-home-lockup")).toBeLessThan(
      homeSource.indexOf('class="tools-hero"')
    );
    expect(homeSource).not.toContain('class="tools-brand-lockup"');
    expect(homeSource).not.toContain('src={asset("/favicon.svg")}');
    expect(homeSource).toContain("let events = $state<RegionCurrentEvent[] | null>(null);");
    expect(homeSource).toContain("const isEventsLoading = $derived(events === null);");
    expect(homeSource).toContain('role={isEventsLoading ? "status" : undefined}');
    expect(homeSource).toContain('aria-busy={isEventsLoading}');
    expect(homeSource).toContain('aria-hidden="true"');
    expect(homeSource).toContain('translate("home.eventsLoading")');
    expect(homeSource).toContain("events = trackerSupportedRegions.map((region) => ({ region, status: \"failed\", event: null }));");
    expect(homeSource).toContain('import { getEventBannerAssetURL } from "$lib/event-assets";');
    expect(homeSource).toContain('import { getTrackerCountdown } from "$lib/tracker-countdown";');
    expect(homeSource).toContain("const clock = window.setInterval(() => (now = Date.now()), 1_000);");
    expect(homeSource).toContain('class="event-card event-card-link has-event"');
    expect(homeSource).toContain('aria-label={`${regionName(result.region)}: ${result.event.name} — ${translate("home.openRegionalTracker")}`}');
    expect(homeSource).toContain('class="event-banner"');
    expect(homeSource).toContain('import AssetImage from "@platform/ui-shell/asset-image";');
    expect(homeSource).toContain('<AssetImage src={source}');
    expect(homeSource).toContain('class="tracker-link-arrow"');
    expect(appCssSource).toContain(".event-banner {");
    expect(appCssSource).toContain("min-height: 8rem;");
    expect(appCssSource).toContain(".event-banner img {");
    expect(appCssSource).toContain("height: auto;");
    expect(appCssSource).toContain("object-fit: contain;");
    expect(appCssSource).not.toContain("aspect-ratio: 5 / 2;");
    expect(appCssSource).not.toContain("object-fit: cover;");
    expect(trackerSource).toContain(
      '<title>{translate("tracker.title")} | Sekai Viewer - Tools</title>'
    );
    expect(JSON.parse(trackerMessagesSource)).toMatchObject({ "tracker.title": "Event Tracker" });
    expect(trackerSource).toContain('<h1 id="tracker-title">{translate("tracker.title")}</h1>');
  });

  it("keeps real state handling without presenting historical mode as a ranking status", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('data.selectionStatus === "invalid-event-id"');
    expect(source).toContain('trackerStatus === "upstream-error"');
    expect(source).toContain('trackerStatus === "sdk-error"');
    expect(source).toContain('trackerStatus === "network-error"');
    expect(source).toContain('trackerStatus === "invalid-data"');
    expect(source).toContain("const isCurrentEventKnown = $derived(");
    expect(source).toContain("const isCurrentEvent = $derived(");
    expect(source).toContain(
      "const isHistoricalEvent = $derived(isExplicitSelection && isCurrentEventKnown && !isCurrentEvent);"
    );
    expect(source).toContain("const activityLabel = $derived(");
    expect(source).toContain("let trackerResult = $state<EventTrackerResult | null>(null);");
    expect(source).toContain("const isTrackerLoading = $derived(trackerResult === null);");
    expect(source).toContain('class="tracker-ranking-skeleton"');
    expect(source).toContain('class="skeleton h-9 w-12"');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('class="tracker-heading-skeleton skeleton h-3 w-20"');
    expect(source).toContain("let trackerRequestIdentity = $state<string | null>(null);");
    expect(source).toContain("trackerRequestIdentity !== null && trackerRequestIdentity !== requestIdentity");
    expect(source).toContain("trackerResult = createTrackerNetworkFailure();");
    expect(source).not.toContain('trackerStatus !== "available"}<p role="status">{translate("tracker.loading")}</p>');
    expect(source).toContain('import { getTrackerCountdown } from "$lib/tracker-countdown";');
    expect(source).toContain("const countdown = $derived(");
    expect(source).toContain("closedAt: selectedEvent?.closedAt");
    expect(source).toContain('translate("tracker.countdownEndsIn")');
    expect(source).toContain('translate("tracker.countdownStartsIn")');
    expect(source).toContain('class="tracker-countdown"');
    expect(source).toContain("font-variant-numeric: tabular-nums");
    expect(source).toContain("parseTrackerTimestamp(snapshotTimestamp) ??");
    expect(source).toContain('class="tracker-row-detail-button"');
    expect(source).not.toContain('tabindex="0" role="button"');
    expect(source).toContain("new AbortController()");
    expect(source).toContain("const fetchJsonWithDeadline = async <Payload>");
    expect(source).toContain("const payload = (await response.json()) as Payload;");
    expect(source).toContain("window.clearTimeout(timeout);");
  });

  it("uses one accessible event combobox for catalog search and direct ID navigation", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('role="combobox"');
    expect(source).toContain("aria-expanded={isEventPickerOpen && hasEventCatalog}");
    expect(source).toContain('aria-controls="tracker-event-options"');
    expect(source).toContain("aria-activedescendant=");
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain(
      "if (/^[1-9]\\d*$/.test(trimmedQuery)) navigateToEvent(Number(trimmedQuery));"
    );
    expect(source).toContain("navigateToEvent(null);");
    expect(source).toContain("const matchingEvents = $derived.by");
    expect(source).toContain("`${event.name} ${event.id}`.toLocaleLowerCase().includes(query)");
    expect(source).toContain(
      "const visibleMatchingEvents = $derived(matchingEvents.slice(0, 10));"
    );
    expect(source).toContain("isEventPickerFocused && eventQuery.length > 0");
    expect(source).toContain('class="btn btn-ghost btn-xs btn-circle tracker-event-clear"');
    expect(source).toContain('translate("tracker.clearEventSearch")');
    expect(source).toContain("onclick={clearEventSearch}");
    expect(source).toContain('eventQuery = "";');
    expect(source).toContain("eventPickerInput?.focus();");
    expect(source).not.toContain("tracker.clearEventSelection");
    expect(source).toContain("max-height: 17rem");
    expect(source).toContain("new URLSearchParams({ eventId: String(eventId) })");
    expect(source).not.toContain("tracker-event-browser");
    expect(source).not.toContain("tracker-event-id-form");
    expect(source).not.toContain("tracker.currentEvent");
    expect(source).not.toContain("tracker.openEvent");
    expect(source).not.toContain("tracker.browseEvents");
    expect(source).toContain('await invalidate("tools-site:tracker:rankings")');
    expect(source).toContain("disabled={isRefreshing || isHistoricalEvent}");
    expect(source).toContain('isCurrentEvent && phase === "live"');
    expect(source).toContain("aria-label={isRefreshing");
    expect(source).toContain('translate("tracker.refreshing")');
    expect(source).toContain('icon={isRefreshing ? "mdi:loading" : "mdi:refresh"}');
    expect(source).toContain('interpolate("tracker.autoRefresh", { seconds: nextRefreshSeconds })');
    expect(source).toContain('class="tracker-status-panel" aria-live="polite"');
    expect(source).toContain('class="tracker-primary-status"');
    expect(source).toContain('class="tracker-freshness-action"');
    expect(source).toContain('class="tracker-freshness"');
    expect(source).toContain('class="btn btn-square btn-sm btn-outline tracker-refresh-action"');
    expect(source).toContain('@media (min-width: 48rem) and (max-width: 63.999rem)');
    expect(source).toContain('@media (min-width: 64rem)');
    expect(source).toContain('.tracker-status-panel {');
    expect(source).not.toContain('border-top: 3px solid var(--color-primary);');
    expect(source).toContain('class="tracker-ladder-switcher"');
    expect(source).toContain('class="tracker-ladder-indicator"');
    expect(source).toContain('class:tracker-ladder-indicator-full={ladder === "full"}');
    expect(source).toContain('transition: transform 180ms ease-out');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it("uses a deterministic SSR timestamp before switching to the browser local time", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("let hasMounted = $state(false);");
    expect(source).toContain('timeZone: hasMounted ? undefined : "UTC"');
    expect(source).toContain("hasMounted = true;");
  });

  it("shows catalog failures as metadata errors rather than indefinitely loading", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("const catalogStatus = $derived(catalog?.status ?? null);");
    expect(source).not.toContain("tracker.context-event");
    expect(source).toContain('translate("tracker.eventPickerPlaceholder")');
    expect(source).toContain("catalog?.selectedEvent?.id === data.selection.eventId");
    expect(source).toContain('translate("tracker.historicalMetadataUnavailable")');
  });

  it("uses a real button in available rows and a modal rather than a permanent inspector", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('<table class="table tracker-table">');
    expect(source).toContain("onclick={() => openDetails(row)}");
    expect(source).toContain("const handleRankingRowClick = (");
    expect(source).toContain('event.target instanceof Element && event.target.closest("button, a, input")');
    expect(source).toContain("onclick={(event) => handleRankingRowClick(event, row)}");
    expect(source).not.toContain(
      '<tr class:tracker-unavailable={row.status === "unavailable"} tabindex="0" role="button"'
    );
    expect(source).not.toContain('class="tracker-ranking-row" tabindex=');
    expect(source).not.toContain('class="tracker-ranking-row" role=');
    expect(source).not.toContain('class="tracker-ranking-row" onkeydown=');
    expect(source).toContain("bind:this={detailsDialog}");
    expect(source).toContain("detailsDialog?.showModal()");
    expect(source).not.toContain("tracker-inspector");
    expect(source).toContain('translate("tracker.degree")');
    expect(source).toContain('translate("tracker.speedUnavailable")');
    expect(source).not.toContain('tracker."prediction"');
    expect(source).not.toContain("tracker.openHistoryGraph");
    expect(source).toContain("void openGraph(row);");
    expect(source).toContain('class="tracker-graph-loading"');
    expect(source).not.toContain("tracker.rankCount");
    expect(source).not.toContain("tracker.viewRankingHistory");
    expect(source).not.toContain("openPrimaryGraph");
    expect(source).toContain("tracker.goToCurrentEvent");
    expect(source).toContain('translate("tracker.viewTrend")');
    expect(source).toContain("tracker.openRankDetailsAndTrend");
    expect(source).toContain("graphIdentity?.eventId !== requestEventKey");
    expect(source).toContain("graphIdentity.rank !== requestRank");
    expect(source).toContain('payload.status !== "available" || !Array.isArray(payload.points)');
  });

  it("keeps time travel opt-in in an inline panel below the unchanged rankings toolbar", async () => {
    // The ranking heading exposes only the historical-event return affordance;
    // per-row trend actions remain covered by the page contract.
    const trackerSourceContract = await readFile(pagePath, "utf8");
    expect(trackerSourceContract).not.toContain("tracker.rankCount");
    expect(trackerSourceContract).not.toContain("tracker.viewRankingHistory");
    expect(trackerSourceContract).toContain("tracker.goToCurrentEvent");
    expect(trackerSourceContract).toContain("href={trackerPath}");

    const [source, trackerMessagesSource] = await Promise.all([
      readFile(pagePath, "utf8"),
      readFile(trackerMessagesPath, "utf8")
    ]);
    expect(source).toContain("let isTimeTravelActive = $state(false);");
    expect(source).toContain("const toggleTimeTravel = (): void => {");
    expect(source).toContain("aria-expanded={isTimeTravelActive}");
    expect(source).toContain('aria-controls="tracker-time-travel-controls"');
    expect(source).toContain('id="tracker-time-travel-controls"');
    expect(source).toContain('aria-labelledby="tracker-time-travel-title"');
    expect(source).toContain('translate("tracker.pastRankings")');
    expect(source).toContain('translate("tracker.viewPastRankings")');
    expect(source).toContain('translate("tracker.backToLatestRankings")');
    expect(JSON.parse(trackerMessagesSource)).toMatchObject({
      "tracker.viewPastRankings": "View past rankings",
      "tracker.backToLatestRankings": "Back to latest rankings",
      "tracker.pastRankings": "Past rankings"
    });
    expect(JSON.parse(trackerMessagesSource)).toMatchObject({
      "tracker.activityDay": "Day {day}",
      "tracker.latest": "Latest",
      "tracker.snapshotPicker": "Saved ranking snapshots",
      "tracker.timePoint": "Saved ranking snapshot",
      "tracker.rankingSnapshotTime": "Ranking snapshot time"
    });
    expect(JSON.parse(trackerMessagesSource)).not.toHaveProperty("tracker.browseSavedSnapshots");
    expect(JSON.parse(trackerMessagesSource)).not.toHaveProperty("tracker.closeSnapshots");
    expect(JSON.parse(trackerMessagesSource)).not.toHaveProperty("tracker.timeTravelControls");
    const removedTimeTravelKey = ["tracker", "timeTravel"].join(".");
    expect(JSON.parse(trackerMessagesSource)).not.toHaveProperty(removedTimeTravelKey);
    expect(source.indexOf('<div class="tracker-control-row">')).toBeLessThan(
      source.indexOf('id="tracker-time-travel-controls"')
    );
    expect(source).not.toContain("timeTravelDialog");
    expect(source).not.toContain("openTimeTravel");
    expect(source).not.toContain("tracker-time-travel-dialog");
    expect(source).not.toContain('aria-haspopup="dialog"');
    expect(source).not.toContain("timeTravelDialog?.showModal()");
    expect(source).toContain('endpoint("time", { eventId: String(requestEventKey) })');
    expect(source).toContain(
      'endpoint("snapshot", { eventId: String(requestEventKey), timestamp })'
    );
    expect(source).toContain("timePointIndex = Math.max(timePoints.length - 1, 0);");
    expect(source).toContain(
      "const selectedTimePoint = $derived(timePoints[timePointIndex] ?? null);"
    );
    expect(source).toContain('id="tracker-activity-day"');
    expect(source).toContain('id="tracker-saved-time"');
    expect(source).toContain('class="select select-sm select-bordered"');
    expect(source).not.toContain('aria-haspopup="listbox"');
    expect(source).not.toContain('class="dropdown tracker-time-control"');
    expect(source).not.toContain("tracker-time-point-options");
    expect(source).not.toContain("tracker-time-point-trigger");
    expect(source).toContain("const timePointGroups = $derived.by<TimePointGroup[]>");
    expect(source).toContain("Math.floor((pointAt - eventStart) / 86_400_000) + 1");
    expect(source).toContain("type TimePointGroup = {");
    expect(source).toContain("id: number;");
    expect(source).toContain("if (group?.day === day) group.points.push");
    expect(source).toContain('value={selectedTimePointGroup?.id ?? ""}');
    expect(source).toContain("formatSnapshotOption(");
    expect(source).toContain("const formatSnapshotGroupLabel = (value: string): string | null =>");
    expect(source).toContain(
      "const selectedTimePointLocalDateGroups = $derived.by<SnapshotLocalDateGroup[]>"
    );
    expect(source).toContain("for (const point of selectedTimePointGroup?.points ?? [])");
    expect(source).toContain("selectedTimePointGroup?.points.find(");
    expect(source).toContain(
      "{#each selectedTimePointLocalDateGroups as group (group.label)}<optgroup"
    );
    expect(source).not.toContain(">{#each timePointGroups as group (group.id)}<optgroup");
    expect(source).not.toContain("timePointGroups\n                    .flatMap");
    expect(source).toContain("<optgroup");
    expect(source).toContain("label={group.label}");
    expect(source).toContain("timeStyle: \"short\"");
    expect(source).not.toContain('month: "short"');
    expect(source).not.toContain('day: "numeric"');
    expect(source).not.toContain('hour: "numeric"');
    expect(source).not.toContain('minute: "2-digit"');
    expect(source).toContain('point.index === timePoints.length - 1');
    expect(source).toContain("if (index === timePoints.length - 1)");
    expect(source).not.toContain('class="range range-primary range-sm"');
    expect(source).toContain('endpoint("graph", params)');
    expect(source).toContain("record.score ?? record.eventPoint ?? record.rankingScore");
    expect(source).toContain("record.rank ?? record.ranking");
    expect(source).toContain(
      "await fetchGraphPoints(\n        requestEventKey,\n        requestRank,"
    );
    expect(source).toContain("snapshotTimer = setTimeout");
    expect(source).toContain('translate("tracker.ranks.critical")');
    expect(source).toContain('translate("tracker.ranks.all")');
    expect(source).toContain('aria-label={translate("tracker.rankRange")}');
    expect(source).toContain('class:btn-primary={ladder === "critical"}');
    expect(source).toContain('class:btn-outline={ladder !== "critical"}');
    expect(source).toContain('aria-pressed={ladder === "critical"}');
    expect(source).toContain('aria-pressed={ladder === "full"}');
    expect(source).not.toContain("tracker.worldBloom");
    expect(source).not.toContain("tracker.chapterUnavailable");
    expect(source).toContain("aggregateAt: selectedEvent?.aggregateAt");
    expect(source).toContain("formatRewardRange(row.reward)");
    expect(source).toContain("RankingHistoryChart");
    expect(source).not.toContain('viewBox="0 0 720 250"');
    expect(source).toContain("tracker.graphAriaLabel");
    expect(source).toContain('class="tracker-graph-panel"');
  });

  it("guards stale time-travel requests and presents each endpoint failure distinctly", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("let timePointsRequestToken = 0;");
    expect(source).toContain("let snapshotRequestToken = 0;");
    expect(source).toContain("let graphRequestToken = 0;");
    expect(source).toContain("let observedEventKey: number | null = null;");
    expect(source).toContain("requestToken !== timePointsRequestToken ||");
    expect(source).toContain("requestToken !== snapshotRequestToken ||");
    expect(source).toContain("requestToken !== graphRequestToken ||");
    expect(source).toContain('timeTravelMessage(timePointsStatus, "timePoint")');
    expect(source).toContain('timeTravelMessage(snapshotStatus, "snapshot")');
  });
});
