import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve(process.cwd(), "src/routes/tracker/[region]/+page.svelte");

describe("tracker page UI contract", () => {
  it("renders live, historical, invalid, error, and empty semantic states", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain('data.selection.mode === "live"');
    expect(source).toContain('"tracker.status.history"');
    expect(source).toContain('data.selectionStatus === "invalid-event-id"');
    expect(source).toContain('"tracker.eventIdInvalid"');
    expect(source).toContain('data.status === "sdk-error"');
    expect(source).toContain('data.status === "network-error"');
    expect(source).toContain('data.status === "invalid-data"');
    expect(source).toContain('"tracker.empty"');
  });

  it("keeps selection navigation and refresh controls accessible", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain('href={trackerPath}');
    expect(source).toContain('action={trackerPath}');
    expect(source).toContain('name="eventId"');
    expect(source).toContain("await invalidateAll()");
    expect(source).toContain("disabled={isRefreshing}");
    expect(source).toContain("aria-label={isRefreshing");
    expect(source).toContain("title={isRefreshing");
    expect(source).toContain('<table class="table tracker-table">');
    expect(source).toContain('scope="col"');
  });
});
