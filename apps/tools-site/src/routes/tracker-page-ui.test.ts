import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(process.cwd(), "src/routes/tracker/[region]/+page.svelte");

describe("tracker page UI contract", () => {
  it("renders live, historical, invalid, error, and empty semantic states", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain('data.selection.mode === "live"');
    expect(source).toContain('translate("tracker.historical")');
    expect(source).toContain('data.selectionStatus === "invalid-event-id"');
    expect(source).toContain('"tracker.eventIdInvalid"');
    expect(source).toContain('trackerStatus === "sdk-error"');
    expect(source).toContain('trackerStatus === "network-error"');
    expect(source).toContain('trackerStatus === "invalid-data"');
    expect(source).toContain('"tracker.empty"');
  });

  it("keeps selection navigation and refresh controls accessible", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain('href={`${trackerPath}?eventId=${catalog.currentEvent.id}`}');
    expect(source).toContain('action={trackerPath}');
    expect(source).toContain('name="eventId"');
    expect(source).toContain('await invalidate("tools-site:tracker:rankings")');
    expect(source).toContain("disabled={isRefreshing}");
    expect(source).toContain("aria-label={isRefreshing");
    expect(source).toContain('title={translate("tracker.refreshRankings")}');
    expect(source).toContain('<table class="table tracker-table">');
    expect(source).not.toContain("aria-hidden");
    expect(source).toContain('class="tracker-table-wrap"');
    expect(source.match(/class="tracker-ranking-cards"/g)).toHaveLength(1);
    expect(source).toContain('class="tracker-ranking-card"');
    expect(source).toMatch(/class="btn tracker-touch-action\b/);
    expect(source).toContain('class="tracker-detail-panel"');
    expect(source).toContain('aria-expanded={expandedRank === row.ladderRank}');
    expect(source).toContain('aria-controls="tracker-inspector-detail"');
    expect(source).toContain('id="tracker-inspector-detail"');
    expect(source).toContain('aria-controls={`tracker-detail-${row.ladderRank}`}');
    expect(source).toContain('onclick={() => (expandedRank = null)}>{translate("tracker.detailsClose")}</button>');
    expect(source).toContain('.tracker-workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);');
    expect(source).toContain('.tracker-ranking-cards { display: none; }');
    expect(source).toContain('@media (max-width: 47.999rem)');
    expect(source).toContain('.tracker-table-wrap, .tracker-inspector { display: none; }');
    expect(source).toContain('.tracker-ranking-cards { display: grid; gap: .75rem; }');
    expect(source).toContain('scope="col"');
    expect(source.match(/const selectedRow = \$derived/g)).toHaveLength(1);
  });

  it("connects time-travel snapshots and rank graphs through route-local endpoints", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain('endpoint("time", { eventId: String(data.selection.eventId) })');
    expect(source).toContain('endpoint("snapshot", { eventId: String(data.selection.eventId), timestamp })');
    expect(source).toContain('endpoint("graph", params)');
    expect(source).toContain('record.score ?? record.eventPoint ?? record.rankingScore');
    expect(source).toContain('record.rank ?? record.ranking');
    expect(source).toContain('typeof record.timestamp === "string"');
    expect(source).toContain('Number.isFinite(parsed)');
    expect(source).toContain('await fetchGraphPoints(rank, snapshotTimestamp ?? undefined)');
    expect(source).toMatch(/if\s*\(snapshotTimestamp\s*&&\s*points\.length\s*<\s*2\)\s*\{\s*points\s*=\s*await fetchGraphPoints\(rank\);\s*graphMode\s*=\s*"trend";/);
    expect(source).toContain("snapshotTimer = setTimeout");
    expect(source).toContain("clearTimeout(snapshotTimer)");
    expect(source).toContain('translate("tracker.latest")');
    expect(source).toContain('translate("tracker.graphClose")');
    expect(source).toContain('const eventKey = $derived(data.selection.eventId ?? catalog?.currentEvent?.id ?? null)');
    expect(source).toContain('const graphPointsLabel = $derived(interpolate("tracker.graphPoints", { count: graphPoints.length }))');
    expect(source).toContain('<polyline points={graphPoints.map(');
  });

  it("shows a dedicated friendly message when historical rankings fail upstream", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain('trackerStatus === "upstream-error"');
    expect(source).toContain('translate("tracker.error.historyUpstream")');
  });
});
