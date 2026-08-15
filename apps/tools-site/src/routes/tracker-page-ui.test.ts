import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(process.cwd(), "src/routes/tracker/[region]/+page.svelte");
const homePagePath = resolve(process.cwd(), "src/routes/+page.svelte");
const layoutPath = resolve(process.cwd(), "src/routes/+layout.svelte");
const trackerMessagesPath = resolve(process.cwd(), "../../packages/i18n-source/tools-site/tracker.json");

describe("tracker page UI contract", () => {
  it("uses the tools-site title format and the shared Sekai Viewer brand lockup", async () => {
    const [trackerSource, homeSource, layoutSource, trackerMessagesSource] = await Promise.all([
      readFile(pagePath, "utf8"),
      readFile(homePagePath, "utf8"),
      readFile(layoutPath, "utf8"),
      readFile(trackerMessagesPath, "utf8")
    ]);

    expect(layoutSource).toContain("<title>Sekai Viewer - Tools</title>");
    expect(homeSource).toContain("<title>Sekai Viewer - Tools</title>");
    expect(homeSource).toContain('import { BrandLockup } from "@platform/ui-shell";');
    expect(homeSource).toContain("<BrandLockup />");
    expect(homeSource).not.toContain('src={asset("/favicon.svg")}');
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
    expect(source).not.toContain('translate("tracker.historical")');
  });

  it("keeps the event browser collapsed, bounded, and accessible alongside direct ID lookup", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('href={trackerPath}');
    expect(source).toContain('action={trackerPath}');
    expect(source).toContain('name="eventId"');
    expect(source).toContain('const matchingEvents = $derived.by');
    expect(source).toContain('`${event.name} ${event.id}`.toLocaleLowerCase().includes(query)');
    expect(source).toContain('type="search" bind:value={eventQuery}');
    expect(source).toContain('let isEventBrowserOpen = $state(false);');
    expect(source).toContain('const visibleMatchingEvents = $derived(matchingEvents.slice(0, 10));');
    expect(source).toContain('{#if hasEventCatalog && isEventBrowserOpen}');
    expect(source).toContain('aria-expanded={isEventBrowserOpen}');
    expect(source).toContain('id="tracker-event-browser"');
    expect(source).toContain('max-height: 17rem');
    expect(source).toContain('new URLSearchParams({ eventId: String(event.id) })');
    expect(source).toContain('data.selection.eventId === null');
    expect(source).toContain('aria-current="page">{translate("tracker.currentEvent")}');
    expect(source).toContain('href={trackerPath}>{translate("tracker.currentEvent")}');
    expect(source).not.toContain('tracker.singleEvent');
    expect(source).not.toContain('tracker.selectEvent');
    expect(source).toContain('await invalidate("tools-site:tracker:rankings")');
    expect(source).toContain("disabled={isRefreshing}");
    expect(source).toContain("aria-label={isRefreshing");
    expect(source).toContain('title={isRefreshing ? translate("tracker.refreshing")');
    expect(source).toContain('icon={isRefreshing ? "mdi:loading" : "mdi:refresh"}');
    expect(source).toContain('interpolate("tracker.autoRefresh", { seconds: nextRefreshSeconds })');
  });

  it("uses a deterministic SSR timestamp before switching to the browser local time", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('let hasMounted = $state(false);');
    expect(source).toContain('timeZone: hasMounted ? undefined : "UTC"');
    expect(source).toContain('hasMounted = true;');
  });

  it("shows catalog failures as metadata errors rather than indefinitely loading", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('const catalogStatus = $derived(catalog?.status ?? null);');
    expect(source).toContain('translate("tracker.loadingMetadata")');
    expect(source).toContain('translate(`tracker.metadataError.${status}`)');
    expect(source).toContain('role={catalogStatus !== null && catalogStatus !== "available" ? "alert" : undefined}');
  });

  it("uses a real button in available rows and a modal rather than a permanent inspector", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('<table class="table tracker-table">');
    expect(source).toContain('type="button" onclick={() => openDetails(row)}');
    expect(source).not.toContain('<tr class:tracker-unavailable={row.status === "unavailable"} tabindex="0" role="button"');
    expect(source).toContain('<dialog bind:this={detailsDialog}');
    expect(source).toContain('detailsDialog?.showModal()');
    expect(source).not.toContain("tracker-inspector");
    expect(source).toContain('translate("tracker.degree")');
    expect(source).toContain('translate("tracker.speedUnavailable")');
    expect(source).not.toContain('tracker."prediction"');
    expect(source).toContain('translate("tracker.openHistoryGraph")');
    expect(source).toContain('const primaryGraphRow = $derived(rows.find((row) => row.ladderRank === 1 && row.status === "available") ?? null);');
    expect(source).toContain('onclick={openPrimaryGraph}>{translate("tracker.viewRankingHistory")}');
    expect(source).toContain('translate("tracker.viewTrend")');
    expect(source).toContain('graphIdentity?.eventId !== requestEventKey');
    expect(source).toContain('graphIdentity.rank !== requestRank');
    expect(source).toContain('payload.status !== "available" || !Array.isArray(payload.points)');
  });

  it("keeps time travel, graph, and rank ladders available without unavailable chapter UI", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('endpoint("time", { eventId: String(requestEventKey) })');
    expect(source).toContain('endpoint("snapshot", { eventId: String(requestEventKey), timestamp })');
    expect(source).toContain('endpoint("graph", params)');
    expect(source).toContain('record.score ?? record.eventPoint ?? record.rankingScore');
    expect(source).toContain('record.rank ?? record.ranking');
    expect(source).toContain('await fetchGraphPoints(requestEventKey, requestRank, requestTimestamp ?? undefined)');
    expect(source).toContain('snapshotTimer = setTimeout');
    expect(source).toContain('translate("tracker.ranks.critical")');
    expect(source).toContain('translate("tracker.ranks.all")');
    expect(source).not.toContain('tracker.worldBloom');
    expect(source).not.toContain('tracker.chapterUnavailable');
    expect(source).toContain('aggregateAt: selectedEvent?.aggregateAt');
    expect(source).toContain('formatRewardRange(row.reward)');
    expect(source).toContain('<polyline points={graphPoints.map(');
  });

  it("guards stale time-travel requests and presents each endpoint failure distinctly", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("let timePointsRequestToken = 0;");
    expect(source).toContain("let snapshotRequestToken = 0;");
    expect(source).toContain("let graphRequestToken = 0;");
    expect(source).toContain("let observedEventKey: number | null = null;");
    expect(source).toContain("requestToken !== timePointsRequestToken || eventKey !== requestEventKey");
    expect(source).toContain("requestToken !== snapshotRequestToken || eventKey !== requestEventKey");
    expect(source).toContain("requestToken !== graphRequestToken || eventKey !== requestEventKey");
    expect(source).toContain('timeTravelMessage(timePointsStatus, "timePoint")');
    expect(source).toContain('timeTravelMessage(snapshotStatus, "snapshot")');
  });
});
