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
const chartPath = resolve(process.cwd(), "src/lib/components/RankingHistoryChart.svelte");

describe("tracker page UI contract", () => {
  it("renders accessible player-change markers without motion-dependent behavior", async () => {
    const source = await readFile(chartPath, "utf8");
    expect(source).toContain("findTrackerNameChanges");
    expect(source).toContain("{#snippet aboveMarks({ context })}");
    expect(source).not.toContain("{#snippet marks");
    expect(source).toContain('class="history-chart-name-change"');
    expect(source).toContain("aria-label={markerLabel}");
    expect(source).toContain("context.xGet(marker.point)");
    expect(source).toContain("context.yGet(marker.point)");
    expect(source).toContain("findSnappedNameChange({");
    expect(source).toContain("const hovered = context?.tooltip.data;");
    expect(source).toContain("const range = context.xScale.range();");
    expect(source).toContain("const domain = context.xScale.domain();");
    expect(source).not.toContain("getBoundingClientRect");
    expect(source).not.toContain("svgRect");
    expect(source).not.toContain("clientX");
    expect(source).toContain("context.tooltip.show(event, snappedMarker.point)");
    expect(source).toContain("history-chart-legend");
    expect(source).toContain("onkeydown={(event) => handleMarkerKeydown(event, marker.point)}");
    expect(source).toContain("title>{`${marker.change.previousName} → ${marker.change.nextName}");
    expect(source).toContain("prefers-reduced-motion: reduce");
  });
  it("checks reduced motion at navigation time inside the top-level onNavigate callback", async () => {
    const source = await readFile(layoutPath, "utf8");
    // onNavigate must be registered during component initialisation (top level),
    // never inside onMount; reduced motion is evaluated at navigation time.
    expect(source).toContain("onNavigate((navigation) => {");
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
    const onMountStart = source.indexOf("onMount(() => {");
    const onNavigateCall = source.indexOf("onNavigate((navigation) => {");
    expect(onNavigateCall).toBeGreaterThan(-1);
    if (onMountStart !== -1) {
      expect(onNavigateCall).toBeLessThan(onMountStart);
    }
  });

  it("keeps navigation shell neutral and owns stable tracker loading shapes", async () => {
    const [layoutSource, trackerSource] = await Promise.all([
      readFile(layoutPath, "utf8"),
      readFile(pagePath, "utf8")
    ]);
    expect(layoutSource).not.toContain("isTrackerNavigation");
    expect(layoutSource).not.toContain("tracker-navigation");
    expect(trackerSource).toContain('class="tracker-status-skeleton"');
    expect(trackerSource).toContain('class="tracker-ranking-skeleton"');
    expect(trackerSource).toContain('class="tracker-skeleton-table"');
    expect(trackerSource).toContain('class="tracker-skeleton-row"');
    expect(trackerSource).toContain('class="tracker-skeleton-cards"');
    expect(trackerSource).toContain('class="tracker-skeleton-card"');
    expect(trackerSource).toContain('aria-label={translate("tracker.loading")}');
    expect(trackerSource).toContain('aria-busy="true"');
    expect(trackerSource).toContain("getTrackerRankLadder(ladder) as rank");
    expect(trackerSource).toContain("min-height: 28rem;");
    expect(trackerSource).toContain("min-height: 4.75rem;");
  });

  it("uses the tools-site title format and the shared Sekai Viewer brand lockup", async () => {
    const [trackerSource, homeSource, layoutSource, appCssSource, trackerMessagesSource] =
      await Promise.all([
        readFile(pagePath, "utf8"),
        readFile(homePagePath, "utf8"),
        readFile(layoutPath, "utf8"),
        readFile(appCssPath, "utf8"),
        readFile(trackerMessagesPath, "utf8")
      ]);

    expect(layoutSource).toContain("<title>Sekai Viewer Tools</title>");
    expect(homeSource).toContain("<title>Sekai Viewer Tools</title>");
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
    expect(homeSource).toContain("aria-busy={isEventsLoading}");
    expect(homeSource).toContain('aria-hidden="true"');
    expect(homeSource).toContain('translate("home.eventsLoading")');
    expect(homeSource).toContain(
      'events = trackerSupportedRegions.map((region) => ({ region, status: "failed", event: null }));'
    );
    expect(homeSource).toContain('import { getEventBannerAssetURL } from "$lib/event-assets";');
    expect(homeSource).toContain('import { getTrackerCountdown } from "$lib/tracker-countdown";');
    expect(homeSource).toContain(
      "const clock = window.setInterval(() => (now = Date.now()), 1_000);"
    );
    expect(homeSource).toContain('class="event-card event-card-link has-event"');
    expect(homeSource).toContain(
      'aria-label={`${regionName(result.region)}: ${result.event.name} — ${translate("home.openRegionalTracker")}`}'
    );
    expect(homeSource).toContain('class="event-banner"');
    expect(homeSource).toContain('import AssetImage from "@platform/ui-shell/asset-image";');
    expect(homeSource).toContain("<AssetImage src={source}");
    expect(homeSource).toContain('class="tracker-link-arrow"');
    expect(appCssSource).toContain(".event-banner {");
    expect(appCssSource).toContain("min-height: 6rem;");
    expect(appCssSource).toContain(".event-banner img {");
    expect(appCssSource).toContain("height: auto;");
    expect(appCssSource).toContain("max-height: 6rem;");
    expect(appCssSource).toContain("object-fit: contain;");
    expect(appCssSource).toContain("background: transparent");
    expect(appCssSource).not.toContain("aspect-ratio: 5 / 2;");
    expect(appCssSource).not.toContain("object-fit: cover;");
    expect(trackerSource).toContain(
      '<title>{translate("tracker.title")} | Sekai Viewer Tools</title>'
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
    expect(source).toContain("const isHistoricalEvent = $derived(");
    expect(source).toContain("isCurrentEventKnown || currentMetadataUnavailable");
    expect(source).toContain("const activityLabel = $derived(");
    expect(source).toContain("let trackerResult = $state<EventTrackerResult | null>(null);");
    expect(source).toContain("const isTrackerLoading = $derived(trackerResult === null);");
    expect(source).toContain('class="tracker-ranking-skeleton"');
    expect(source).toContain('class="skeleton h-9 w-12"');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-busy="true"');
    expect(source).not.toContain("tracker-heading-skeleton");
    expect(source).toContain("let trackerRequestIdentity = $state<string | null>(null);");
    expect(source).toContain(
      "trackerRequestIdentity !== null && trackerRequestIdentity !== requestIdentity"
    );
    expect(source).toContain("trackerResult = createTrackerNetworkFailure();");
    expect(source).not.toContain(
      'trackerStatus !== "available"}<p role="status">{translate("tracker.loading")}</p>'
    );
    expect(source).toContain('getTrackerCountdown } from "$lib/tracker-countdown";');
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
    expect(source).toContain("async function fetchJsonWithDeadline<Payload>");
    expect(source).not.toContain("const fetchJsonWithDeadline = async <Payload>");
    expect(source).toContain("const payload = (await response.json()) as Payload;");
    expect(source).toContain("window.clearTimeout(timeout);");
    expect(source).toContain('new URLSearchParams(window.location.search).get("eventId")');
    expect(source).toContain("selectedEventId: queryEventId ?? data.selection.eventId");
    expect(source).toContain("resultSelectionEventId:");
  });

  it("uses one World Bloom ranking workspace and keeps ordinary events chapter-free", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("let isWorldBloom = $state(false);");
    expect(source).toContain("Promise.resolve(extendedData.isWorldBloom)");
    expect(source).toContain('translate("tracker.eventRankings")');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('class="tabs tabs-box tracker-ranking-tabs min-w-max flex-nowrap"');
    expect(source).toContain('class="tab shrink-0 btn btn-sm tracker-ladder-option"');
    expect(source).toContain('class:tab-active={selectedRankingTab === "event"}');
    expect(source).toContain("class:tab-active={selectedRankingTab === chapter.chapter.id}");
    expect(source).toContain('class="tracker-ranking-tabs-scroll"');
    expect(source).toContain('class="tracker-kicker tracker-world-bloom-kicker"');
    expect(source).toContain(
      '{#if isWorldBloom}<p class="tracker-kicker tracker-world-bloom-kicker">'
    );
    expect(source).not.toContain("tracker-world-bloom-kicker-visible");
    expect(source).toContain('class="tracker-ranking-tabs-shell"');
    expect(source).toContain("min-height: 3.25rem;");
    expect(source).toContain('class="tracker-ranking-tabs-loading"');
    expect(source).toContain("overflow-x: auto;");
    expect(source).toContain("overscroll-behavior-x: contain;");
    expect(source).toContain("-webkit-overflow-scrolling: touch;");
    expect(source).toContain("mask-image: linear-gradient(");
    expect(source).toContain(".tracker-ranking-tabs .tab.tab-active {");
    expect(source).toContain("background: var(--color-primary);");
    expect(source).toContain("color: var(--color-primary-content);");
    expect(source).toContain(".tracker-ranking-tabs .tab:focus-visible {");
    expect(source).toContain("outline: 2px solid var(--color-primary);");
    expect(source).toContain('id="tracker-ranking-panel"');
    expect(source).toContain('class="table tracker-table"');
    expect(source).toContain('class="tracker-ranking-cards"');
    expect(source).toContain(
      'selectedRankingTab === "event" || !selectedChapter ? rows : chapterRows'
    );
    expect(source).not.toContain("tracker-chapter-workspace");
    expect(source).not.toContain("tracker-chapter-panel");
  });

  it("marks the current chapter independently from the selected tab", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("const currentChapter = $derived(");
    expect(source).toContain("class:tracker-current-tab={isCurrent}");
    expect(source).toContain('aria-current={isCurrent ? "true" : undefined}');
    expect(source).toContain('translate("tracker.currentChapter")');
    expect(source).toContain(".tracker-current-tab:not(.btn-primary)");
    expect(source).toContain("background: color-mix(in srgb, var(--color-accent)");
    expect(source).toContain("border-color: color-mix(in srgb, var(--color-accent)");
    expect(source).toContain("0 0 0 2px color-mix(in srgb, var(--color-accent)");
    expect(source).toContain(".tracker-current-tab.btn-primary .tracker-current-marker");
    expect(source).toContain("color: var(--color-primary-content);");
    const eventTab = source.slice(
      source.indexOf('id="tracker-event-ranking-tab"'),
      source.indexOf("id={`tracker-chapter-tab-${chapter.chapter.id}`}")
    );
    expect(eventTab).not.toContain("tracker-current-tab");
  });

  it("hides the World Bloom chapter countdown on the default event tab", async () => {
    const source = await readFile(pagePath, "utf8");
    const countdownBlock = source.slice(
      source.indexOf('{#if isWorldBloom && selectedRankingTab !== "event" && selectedChapter}'),
      source.indexOf(
        "{/if}",
        source.indexOf('{#if isWorldBloom && selectedRankingTab !== "event" && selectedChapter}')
      )
    );
    expect(countdownBlock).toContain('selectedRankingTab !== "event"');
    expect(countdownBlock).toContain("selectedChapter.chapter.chapterEndAt");
    expect(countdownBlock).toContain(
      "selectedChapter.chapter.aggregateAt ?? selectedChapter.chapter.chapterEndAt"
    );
    expect(countdownBlock).not.toContain("selectedChapter.chapter.startAt");
    expect(countdownBlock).not.toContain("selectedChapter.chapter.endAt");
    expect(source).toContain("chapter.chapterStartAt");
    expect(source).toContain("chapters?.rankings[0] ??");
  });

  it("resolves deferred World Link identity independently from tracker data", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("isWorldBloom?: boolean | Promise<boolean>;");
    expect(source).toContain("let isWorldBloom = $state(false);");
    expect(source).toContain("void Promise.resolve(extendedData.isWorldBloom).then(");
    expect(source).toContain("if (!cancelled) isWorldBloom = value === true;");
    expect(source).toContain("{#if isWorldBloom}");
    expect(source).not.toContain("const isWorldBloom = $derived(data.isWorldBloom === true);");
    expect(source).toContain("chapters === null");
    expect(source).toContain("class:tracker-current-tab={isCurrent}");
    expect(source).toContain('translate("tracker.currentChapter")');
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
    expect(source).toContain(
      'class="btn btn-square btn-sm btn-outline rounded-full tracker-refresh-action"'
    );
    expect(source).toContain("@media (min-width: 48rem) and (max-width: 63.999rem)");
    expect(source).toContain("@media (min-width: 64rem)");
    expect(source).toContain(".tracker-status-panel {");
    expect(source).toContain("min-height: 4.75rem;");
    expect(source).toContain("min-height: 6.25rem;");
    expect(source).not.toContain("border-top: 3px solid var(--color-primary);");
    expect(source).toContain('class="tracker-ladder-switcher"');
    expect(source).toContain('class="tracker-ladder-indicator"');
    expect(source).toContain('class:tracker-ladder-indicator-full={ladder === "full"}');
    expect(source).toMatch(/transition:\s*transform 180ms ease-out,/);
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps the goal calculator native, submitted, and keyboard accessible", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("<dialog");
    expect(source).toContain("bind:this={goalDialog}");
    expect(source).toContain('id="tracker-goal-dialog"');
    expect(source).toContain('aria-labelledby="tracker-goal-dialog-title"');
    const dialog = source.match(/<dialog\s[^>]*id="tracker-goal-dialog"[\s\S]*?<\/dialog>/)?.[0];
    expect(dialog).toBeDefined();
    expect(dialog).toMatch(/<dialog\s[^>]*aria-describedby="tracker-goal-dialog-description"/);
    expect(dialog).toContain('class="modal-box tracker-goal-dialog-box"');
    expect(dialog).toMatch(
      /<form\s[^>]*class="modal-box tracker-goal-dialog-box"[^>]*onsubmit=\{submitGoal\}/
    );
    expect(dialog).toMatch(
      /<\/form>\s*<form method="dialog" class="modal-backdrop">\s*<button type="submit" aria-label=\{translate\("tracker.goalClose"\)\}><\/button>\s*<\/form>/
    );
    const closeButton = dialog?.match(
      /<button\s[^>]*onclick=\{closeGoalCalculator\}[\s\S]*?<\/button>/
    )?.[0];
    expect(closeButton).toBeDefined();
    expect(closeButton).toContain('aria-label={translate("tracker.goalClose")}');
    expect(closeButton).toContain('title={translate("tracker.goalClose")}');
    expect(closeButton).toContain('<Icon icon="mdi:close" class="size-5" aria-hidden="true" />');
    expect(closeButton).toContain("size-11 min-h-11 shrink-0");
    expect(closeButton).not.toMatch(/>\s*\{translate\("tracker.goalClose"\)\}/);
    expect(dialog?.match(/class="input input-sm min-h-11 w-full min-w-0"/g)).toHaveLength(2);
    expect(dialog).toContain('class="btn btn-primary min-h-11" type="submit"');
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).toContain('aria-controls="tracker-goal-dialog"');
    expect(source).toContain("onclick={openGoalCalculator}");
    expect(source).toContain("goalDialog?.showModal()");
    expect(source).toContain('id="tracker-goal-rank"');
    expect(source).toContain('for="tracker-goal-rank"');
    expect(source).toContain('id="tracker-goal-score"');
    expect(source).toContain('for="tracker-goal-score"');
    expect(source).toContain("onsubmit={submitGoal}");
    expect(source).toContain('type="submit"');
    expect(source).toContain('translate("tracker.calculateGoal")');
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain("isGoalSubmitted = true;");

    const resultStart = source.indexOf("{#if isGoalSubmitted}");
    const resultEnd = source.indexOf("{/if}", resultStart);
    expect(resultStart).toBeGreaterThan(-1);
    expect(resultEnd).toBeGreaterThan(resultStart);
    expect(source.slice(resultStart, resultEnd)).toContain('<output class="tracker-goal-output"');

    expect(source).toContain("onclick={closeGoalCalculator}");
    expect(source).toContain('translate("tracker.goalClose")');
    expect(source).toContain("oncancel={handleGoalDialogCancel}");
    expect(source).toContain("onclose={handleGoalDialogClose}");
    expect(source).toMatch(
      /const handleGoalDialogCancel = \(event: Event\): void => \{\s*event.preventDefault\(\);\s*closeGoalCalculator\(\);\s*\}/
    );
    expect(source).toMatch(
      /const closeGoalCalculator = \(\): void => \{\s*if \(goalDialog\?\.open\) goalDialog.close\(\);\s*\}/
    );
    expect(source).toMatch(
      /const handleGoalDialogClose = \(\): void => \{\s*goalOpenButton\?\.focus\(\);\s*\}/
    );
    expect(source).toContain("goalOpenButton?.focus()");
    expect(source).toContain("bind:this={goalRankInput}");
    expect(source).toContain("void tick().then(() => goalRankInput?.focus())");
    expect(source).toContain(":focus-visible");
    expect(source).toContain(".tracker-goal-dialog *");
    expect(source).toContain("transition-duration: 1ms !important;");
    const dialogBoxStyles = source.match(/\.tracker-goal-dialog-box\s*\{([^}]+)\}/)?.[1];
    expect(dialogBoxStyles).toContain("width: min(92vw, 32rem);");
    expect(dialogBoxStyles).toContain("max-height: calc(100dvh - 2rem);");
    expect(dialogBoxStyles).toContain("overflow-y: auto;");
    expect(dialogBoxStyles).toContain("overflow-wrap: anywhere;");
    expect(source).not.toMatch(/\.tracker-goal-dialog\s*\{/);
    expect(source).toContain("@media (max-width: 48rem)");
    expect(source).toContain("grid-template-columns: 1fr;");

    const shareMessageStart = source.indexOf('<span class="tracker-share-message"');
    const shareMessageEnd = source.indexOf("</span>", shareMessageStart);
    expect(shareMessageStart).toBeGreaterThan(-1);
    expect(shareMessageEnd).toBeGreaterThan(shareMessageStart);
    expect(source.slice(shareMessageStart, shareMessageEnd)).toContain(
      'role="status" aria-live="polite"'
    );
    expect(source.slice(shareMessageStart, shareMessageEnd)).toContain("{shareMessage}");
    expect(source).toMatch(
      /\.tracker-share-message\s*\{[\s\S]*?width:\s*8\.5rem;[\s\S]*?min-width:\s*8\.5rem;[\s\S]*?min-height:\s*2\.75rem;/
    );
    const toolActionsStart = source.indexOf(".tracker-tool-actions {");
    const toolActionsEnd = source.indexOf("}", toolActionsStart);
    expect(source.slice(toolActionsStart, toolActionsEnd)).toContain("min-width: 0;");
    expect(source.slice(toolActionsStart, toolActionsEnd)).toContain("flex-wrap: wrap;");
    expect(source).toContain(".tracker-tool-actions .btn {");
    expect(source).not.toContain(".tracker-tool-actions .btn,");
    expect(source).not.toContain(".tracker-goal-dialog .btn {");
  });

  it("uses ID-first labels for selected and suggested events with a metadata fallback", async () => {
    const [source, trackerMessagesSource] = await Promise.all([
      readFile(pagePath, "utf8"),
      readFile(trackerMessagesPath, "utf8")
    ]);

    expect(source).toContain(
      "const formatEventLabel = (eventId: number, eventName: string): string =>"
    );
    expect(source).toContain("`#${eventId} — ${eventName}`");
    expect(source).toContain(
      "formatEventLabel(catalog.currentEvent.id, catalog.currentEvent.name)"
    );
    const pickerStart = source.indexOf("const pickerValue = $derived(");
    const pickerEnd = source.indexOf("const currentMetadataUnavailable", pickerStart);
    expect(pickerStart).toBeGreaterThan(-1);
    expect(pickerEnd).toBeGreaterThan(pickerStart);
    const picker = source.slice(pickerStart, pickerEnd);
    expect(picker).toMatch(
      /data\.selection\.eventId !== null\s*\?\s*formatEventLabel\(\s*data\.selection\.eventId,\s*selectedEvent\?\.name \?\? translate\("tracker\.historicalMetadataUnavailable"\)/
    );
    expect(source).toContain("eventQuery = formatEventLabel(event.id, event.name);");
    expect(source).toContain("<span>{formatEventLabel(event.id, event.name)}</span>");
    expect(source).not.toContain("${event.name} #${event.id}");
    expect(source).not.toContain('replace("{eventId}", String(data.selection.eventId))');
    expect(JSON.parse(trackerMessagesSource)).toMatchObject({
      "tracker.historicalMetadataUnavailable": "Historical event metadata unavailable"
    });
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

  it("keeps explicit historical selections labeled as historical when current metadata is unavailable", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toMatch(
      /const currentMetadataUnavailable = \$derived\(\s*catalog !== null &&\s*\(catalog\.currentStatus !== "available" \|\| catalog\.currentEvent === null\)\s*\);/
    );
    expect(source).toMatch(
      /const isHistoricalEvent = \$derived\(\s*isExplicitSelection &&\s*!isCurrentEvent &&\s*\(isCurrentEventKnown \|\| currentMetadataUnavailable\)\s*\);/
    );

    const activityStart = source.indexOf("const activityLabel = $derived(");
    const activityEnd = source.indexOf("const countdown = $derived(", activityStart);
    expect(activityStart).toBeGreaterThan(-1);
    expect(activityEnd).toBeGreaterThan(activityStart);
    const activityLabel = source.slice(activityStart, activityEnd);
    expect(activityLabel).toContain('translate("tracker.historical")');
    expect(activityLabel.indexOf('translate("tracker.historical")')).toBeLessThan(
      activityLabel.indexOf('translate("tracker.phaseUnavailable")')
    );
  });

  it("uses a real button in available rows and a modal rather than a permanent inspector", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('<table class="table tracker-table">');
    expect(source).toContain("onclick={() => openDetails(row, activeRankingContext)}");
    expect(source).toContain("const handleRankingRowClick = (");
    expect(source).toContain(
      'event.target instanceof Element && event.target.closest("button, a, input")'
    );
    expect(source).toContain(
      "onclick={(event) => handleRankingRowClick(event, row, activeRankingContext)}"
    );
    expect(source).not.toContain(
      '<tr class:tracker-unavailable={row.status === "unavailable"} tabindex="0" role="button"'
    );
    expect(source).not.toContain('class="tracker-ranking-row" tabindex=');
    expect(source).not.toContain('class="tracker-ranking-row" role=');
    expect(source).not.toContain('class="tracker-ranking-row" onkeydown=');
    expect(source).toContain("bind:this={detailsDialog}");
    expect(source).toContain("detailsDialog?.showModal()");
    expect(source).toContain("let isDetailsDialogClosing = $state(false);");
    expect(source).toContain("let isDetailsDialogOpening = $state(false);");
    expect(source).toContain("data-opening={isDetailsDialogOpening || undefined}");
    expect(source).toContain("data-closing={isDetailsDialogClosing || undefined}");
    expect(source).toContain("requestAnimationFrame(() => {");
    expect(source).toContain("{#if selectedRow}");
    expect(source).toContain('class="modal-box"');
    expect(source).toContain("let detailsIdentityObserver: IntersectionObserver | undefined;");
    expect(source).toContain("root: detailsModalBox, threshold: 0");
    expect(source).toContain("isDetailsIdentityVisible = !entry.isIntersecting;");
    expect(source).toContain("bind:this={detailsPlayerEntry}");
    expect(source).not.toContain("onscroll={handleDetailsScroll}");
    expect(source).toContain('typeof IntersectionObserver === "undefined"');
    expect(source).toContain("detailsIdentityObserver?.disconnect();");
    expect(source).toContain("oncancel={(event) => {");
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain("setTimeout(() => detailsDialog?.close(), 180)");
    const closeHandler = source.slice(
      source.indexOf("const handleDetailsClosed"),
      source.indexOf("const openGraph", source.indexOf("const handleDetailsClosed"))
    );
    expect(closeHandler).not.toContain("resetDetails();");
    expect(closeHandler).not.toContain("isDetailsDialogClosing = false;");
    expect(source).toContain("isDetailsDialogClosing = false;");
    expect(source).toContain("if (!detailsDialog?.open)");
    expect(source).toContain("selectedRow = row;");
    expect(source).toContain(".tracker-dialog:not([data-opening]):not([data-closing]) .modal-box");
    expect(source).toContain(".tracker-dialog[data-opening]::backdrop,");
    expect(source).toContain("max-height 180ms ease-out");
    expect(source).not.toContain("tracker-inspector");
    expect(source).toContain('translate("tracker.degree")');
    expect(source).toContain('translate("tracker.speedUnavailable")');
    expect(source).not.toContain('tracker."prediction"');
    expect(source).not.toContain("tracker.openHistoryGraph");
    expect(source).toContain("void openGraph(row);");
    expect(source).toContain('class="tracker-graph-region"');
    expect(source).toContain('class="tracker-ranking-result-region"');
    expect(source).toContain('class="tracker-ranking-result-message"');
    expect(source).toContain('class="tracker-snapshot-status-region"');
    expect(source).toContain("tracker-status-visible");
    expect(source).toContain('class="tracker-time-travel-content"');
    expect(source).toContain('class="tracker-time-select-skeleton"');
    expect(source).toContain("tracker-time-note tracker-time-status");
    expect(source).toContain("position: absolute;");
    expect(source).toContain('class="tracker-ranking-loading"');
    expect(source).toContain('class="tracker-graph-loading" role="status"');
    expect(source).toContain('class="tracker-graph-skeleton"');
    expect(source).toContain('class="tracker-graph-skeleton-plot"');
    expect(source).toContain('class="tracker-graph-message"');
    expect(source).not.toContain("tracker.rankCount");
    expect(source).not.toContain("tracker.viewRankingHistory");
    expect(source).not.toContain("openPrimaryGraph");
    expect(source).toContain("tracker.goToCurrentEvent");
    expect(source).toContain('translate("tracker.viewTrend")');
    expect(source).toContain("tracker.openRankDetailsAndTrend");
    expect(source).toContain("graphIdentity?.eventId !== requestEventKey");
    expect(source).toContain("graphIdentity.rank !== requestRank");
    expect(source).toContain('payload.status !== "available" || !Array.isArray(payload.points)');
    expect(source).toContain(
      'import { resolveTrackerEventId } from "$lib/tracker-event-identity";'
    );
    expect(source).toContain("resolvedCurrentEventId: trackerResult?.resolvedCurrentEventId");
    expect(source).toContain("catalogCurrentEventId: catalog?.currentEvent?.id");
    expect(source).toContain("void openGraph(row);");
    expect(source).toContain("<RankingHistoryChart");
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
    const timeTravelStart = source.indexOf('id="tracker-time-travel-controls"');
    const timeTravelEnd = source.indexOf("</section>", timeTravelStart);
    expect(timeTravelStart).toBeGreaterThan(-1);
    expect(timeTravelEnd).toBeGreaterThan(timeTravelStart);
    expect(source.slice(timeTravelStart, timeTravelEnd)).not.toContain('aria-haspopup="dialog"');
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
    expect(source).toContain('timeStyle: "short"');
    expect(source).not.toContain('month: "short"');
    expect(source).not.toContain('day: "numeric"');
    expect(source).not.toContain('hour: "numeric"');
    expect(source).not.toContain('minute: "2-digit"');
    expect(source).toContain("point.index === timePoints.length - 1");
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
    expect(source).toContain('translate("tracker.eventRankings")');
    expect(source).toContain('class="tabs tabs-box tracker-ranking-tabs min-w-max flex-nowrap"');
    expect(source).toContain('class="tab shrink-0 btn btn-sm tracker-ladder-option"');
    expect(source).toContain("class:btn-primary={selectedRankingTab === chapter.chapter.id}");
    expect(source).toContain("class:btn-outline={selectedRankingTab !== chapter.chapter.id}");
    expect(source).not.toContain("tracker-chapter-tabs");
    expect(source).not.toContain("tracker-chapter-tab-active");
    expect(source).toContain("isWorldBloom = value === true;");
    expect(source).toContain("chapters = null;");
    expect(source).toContain("trackerRequestIdentity === requestIdentity) chapters = value;");
    expect(source).toMatch(
      /interpolate\("tracker\.chapter",\s*\{\s*number:\s*chapter\.chapter\.chapterNo\s*\}\)/
    );
    expect(source).not.toContain("chapter.chapter.gameCharacterId}</span>");
    expect(source).toContain(
      'import { createChapterRows, type ChapterRow } from "$lib/tracker-chapter-rows";'
    );
    expect(source).toContain("const selectedLadder = ladder;");
    expect(source).toContain(
      "selectedChapterRows = createChapterRows(chapter.result.rankings, selectedLadder);"
    );
    expect(source).toContain("reward: getReward(row.rank)");
    expect(source).toContain("calculateChapterElapsedMs");
    expect(source).not.toContain("speedPerHour: null");
    expect(source).not.toContain("reward: null");
    expect(source).toContain('class="table tracker-table"');
    expect(source).toContain("chapterRows");
    expect(source).toContain('class:tier-top={rankTier(row.ladderRank) === "top"}');
    expect(source).toContain('class:tier-elite={rankTier(row.ladderRank) === "elite"}');
    expect(source).toContain('class:tier-high={rankTier(row.ladderRank) === "high"}');
    expect(source).toContain('class:tier-mid={rankTier(row.ladderRank) === "mid"}');
    expect(source).toContain('class:tier-long={rankTier(row.ladderRank) === "long"}');
    expect(source).toContain('class="tracker-ranking-cards"');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain("aria-selected={selectedRankingTab === chapter.chapter.id}");
    expect(source).toContain('if (event.key === "ArrowRight")');
    expect(source).toContain('if (event.key === "ArrowLeft")');
    expect(source).toContain('if (event.key === "Home")');
    expect(source).toContain('if (event.key === "End")');
    expect(source).toContain("handleRankingTabKeydown");
    expect(source).not.toContain('icon="mdi:chevron-right"');
    expect(source.match(/icon="mdi:chart-line"/g)?.length).toBe(2);
    expect(source).toContain("selectedChapterRows = [];");
    expect(source).toContain("chapterRequestToken");
    expect(source).toContain("getTrackerChapterCountdown");
    expect(source).toContain("aggregateAt: selectedEvent?.aggregateAt");
    expect(source).toContain("formatRewardRange(row.reward)");
    expect(source).toContain("RankingHistoryChart");
    expect(source).not.toContain('viewBox="0 0 720 250"');
    expect(source).toContain("tracker.graphAriaLabel");
    expect(source).toContain('class="tracker-graph-panel"');
    expect(source).toContain("height: clamp(18rem, 52vw, 24.5rem);");
    expect(source).toContain("animation: tracker-graph-fade-in 180ms ease-out forwards;");
    expect(source).toContain("@keyframes tracker-graph-skeleton-pulse");
    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
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

  it("keeps the goal calculator as an accessible tool action with consistent button sizing", async () => {
    const source = await readFile(pagePath, "utf8");
    const actionsStart = source.indexOf('<div class="tracker-tool-actions">');
    const actionsEnd = source.indexOf("</div>", actionsStart);
    const actions = source.slice(actionsStart, actionsEnd);

    expect(actionsStart).toBeGreaterThan(-1);
    expect(actions).toContain('id="tracker-goal-open"');
    expect(actions).toContain('aria-haspopup="dialog"');
    expect(actions).toContain('aria-controls="tracker-goal-dialog"');
    expect(actions).toContain('icon="mdi:calculator-variant"');
    expect(source).not.toContain("tracker-goal-panel");
    expect(source).toContain('id="tracker-goal-dialog"');
    expect(source).toContain("goalDialog?.showModal()");
    expect(source).toContain("goalDialog.close()");
    expect(source).toContain("goalRankInput?.focus()");
    expect(source).toContain("onsubmit={submitGoal}");
    expect(source).toContain("isGoalSubmitted");
    expect(actions.match(/<button\b/g)).toHaveLength(3);
    for (const icon of ["mdi:calculator-variant", "mdi:download", "mdi:share-variant-outline"]) {
      expect(actions).toMatch(
        new RegExp(`<Icon\\s+icon="${icon}"\\s+class="size-4 shrink-0"\\s+aria-hidden="true"\\s*/>`)
      );
    }
    expect(actions).toContain("onclick={exportCsv}");
    expect(actions).toContain("disabled={!canExportCsv}");
    expect(actions).toContain("onclick={shareTracker}");
    const buttonStyles = source.match(/\.tracker-tool-actions \.btn\s*\{([^}]+)\}/)?.[1];
    expect(buttonStyles).toContain("min-height: 2.75rem;");
    expect(buttonStyles).toContain("height: auto;");
    expect(buttonStyles).toContain("display: inline-flex;");
    expect(buttonStyles).toContain("align-items: center;");
    expect(buttonStyles).toContain("justify-content: center;");
    expect(buttonStyles).toContain("gap: 0.5rem;");
    expect(buttonStyles).toContain("padding-block: 0.25rem;");
    expect(buttonStyles).toContain("padding-inline: 0.75rem;");
    expect(buttonStyles).toContain("line-height: 1.25;");
  });

  it("lets catalog metadata render while rankings load without faking freshness", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("{#if catalog === null && !isInvalidSelection}");
    expect(source).not.toContain(
      "{#if isTrackerLoading || (catalog === null && !isInvalidSelection)}"
    );
    expect(source).toContain("{#if trackerResult}");
    expect(source).toContain("trackerResult.loadedAt");
    expect(source).toContain('<span class="skeleton h-4 w-36" aria-hidden="true"></span>');
    const statusStyleStart = source.indexOf(".tracker-primary-status {");
    const statusStyleEnd = source.indexOf("}", statusStyleStart);
    const statusStyle = source.slice(statusStyleStart, statusStyleEnd);
    expect(statusStyle).toContain("flex: 1 1 100%;");
    expect(statusStyle).toContain("justify-content: flex-end;");
    expect(source).toContain("grid-column: 1 / -1;");
    expect(source).toContain("flex-basis: auto;");
    expect(source).toContain("width: auto;");
    expect(source).not.toContain(".tracker-primary-status > .badge {");
    expect(source).not.toContain("margin-left: auto;");
  });
});
