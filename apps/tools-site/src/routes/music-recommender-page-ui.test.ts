// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JP_SOLO_FORMULA_VERSION, MUSIC_META_SOURCES } from "$lib/music-recommender";
import { goto } from "../lib/test/app-navigation";
import type { PageData } from "./music-recommender/$types";
import MusicRecommenderPage from "./music-recommender/+page.svelte";

const pagePath = resolve(process.cwd(), "src/routes/music-recommender/+page.svelte");
const layoutPath = resolve(process.cwd(), "src/routes/+layout.svelte");
const layoutServerPath = resolve(process.cwd(), "src/routes/+layout.server.ts");
const messagesPath = resolve(
  process.cwd(),
  "../../packages/i18n-source/tools-site/music-recommender.json"
);
const runtimePath = resolve(process.cwd(), "src/lib/i18n/runtime.ts");

const createResults = (count: number): PageData["items"] =>
  Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    musicId: 1_000 + index,
    difficulty: "expert",
    musicTime: 180,
    score: 100_000 - index,
    eventPoints: 200_000 - index
  }));

const createPageData = (items = createResults(126)): PageData => ({
  status: "available",
  source: MUSIC_META_SOURCES["sekai-best"],
  metric: "score",
  inputs: {
    source: "sekai-best",
    metric: "score",
    mode: "jp-solo",
    deckPower: 200000,
    deckBonus: 0,
    boostMultiplier: 1,
    skillRates: Array.from({ length: 6 }, () => 0),
    noSkill: false
  },
  items,
  formulaVersion: JP_SOLO_FORMULA_VERSION,
  provenance: null,
  sourceHash: null,
  reasonCode: null,
  reason: null,
  missingFields: [],
  invalidFields: [],
  uiLocale: "en",
  i18nMessages: {},
  globalNotices: [],
  siteVersion: "test"
});

const getRows = (container: HTMLElement): HTMLTableRowElement[] =>
  Array.from(container.querySelectorAll<HTMLTableRowElement>("tbody tr"));

const getRank = (row: HTMLTableRowElement | undefined): string | undefined =>
  row?.querySelector(".rank-cell")?.textContent?.trim();

const renderPage = (data: PageData) =>
  render(MusicRecommenderPage, { params: {}, data, form: null });

const createMissingInputPageData = (): PageData => ({
  ...createPageData([]),
  status: "unavailable",
  inputs: { ...createPageData([]).inputs, deckPower: null },
  reasonCode: "missing-inputs",
  reason: "A raw JP Solo deck power total is required for this calculation.",
  missingFields: ["deckPower"],
  invalidFields: []
});

beforeEach(() => {
  goto.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("music recommender UI contract", () => {
  it("consumes the generated page data contract and keeps calculations server-side", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain('type PageData = PageProps["data"]');
    expect(source).toContain('type MusicRecommendation = PageData["items"][number]');
    expect(source).toContain("let { data }: PageProps = $props()");
    expect(source).toContain("reloadWithQuery({ source: next })");
    expect(source).toContain("sourceHash");
    expect(source).toContain("lastModifiedAt");
    expect(source).toContain("formulaVersion");
    expect(source).toContain("durationNotRanked");
    expect(source).not.toContain("RecommenderPageData");
    expect(source).not.toContain("as unknown");
    expect(source).not.toContain("sourceRevision");
    expect(source).not.toContain("calculateJpSoloYield");
    expect(source).not.toContain("rankMusicRecommendations");
  });

  it("exposes the required states, inputs, and JP Solo-only mode", async () => {
    const source = await readFile(pagePath, "utf8");
    expect(source).toContain("let noSkill = $state");
    expect(source).toContain("Array.from({ length: 6 }");
    expect(source).toContain('"musicRecommender.incomplete"');
    expect(source).toContain('data.status === "unavailable"');
    expect(source).toContain("getUnavailableMessageKey(data.reasonCode)");
    expect(source).toContain("FIELD_DETAIL_REASON_CODES.has(data.reasonCode)");
    expect(source).not.toMatch(/data\.reason(?!Code)/);
    expect(source).toContain("data.missingFields.join");
    expect(source).toContain("data.invalidFields.join");
    expect(source).toContain('id: "jp-solo"');
    expect(source).toContain("enabled: false");
  });

  it("registers the dedicated namespace and navigation entry", async () => {
    const [layout, layoutServer, runtime, messages] = await Promise.all([
      readFile(layoutPath, "utf8"),
      readFile(layoutServerPath, "utf8"),
      readFile(runtimePath, "utf8"),
      readFile(messagesPath, "utf8")
    ]);
    expect(layout).toContain('href: "/music-recommender"');
    expect(layout).toContain('page.url.pathname === "/music-recommender"');
    expect(layoutServer).toContain('"music-recommender"] as const');
    expect(runtime).toContain("musicRecommenderSourceMessages");
    expect(JSON.parse(messages)).toMatchObject({
      "musicRecommender.title": "JP Solo music recommender"
    });
  });

  it("keeps an invalid source unknown and does not render a fallback source link", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).toContain("data.source === null");
    expect(source).toContain('translate("musicRecommender.sourceUnavailable")');
    expect(source).toContain("{#if data.source}");
    expect(source).toContain("href={data.source.url}");
    expect(source).not.toContain("SOURCE_URLS[source]");
  });

  it("shows last-modified provenance instead of a revision", async () => {
    const [source, messagesText] = await Promise.all([
      readFile(pagePath, "utf8"),
      readFile(messagesPath, "utf8")
    ]);
    const messages = JSON.parse(messagesText) as Record<string, string>;

    expect(source).toContain('translate("musicRecommender.lastModified")');
    expect(source).toContain("data.provenance?.freshness.lastModifiedAt");
    expect(messages["musicRecommender.lastModified"]).toBe("Source last modified");
    expect(messages["musicRecommender.sourceRevision"]).toBeUndefined();
  });

  it("renders only the first ten recommendations and preserves their global ranks", async () => {
    const { container } = renderPage(createPageData());

    expect(getRows(container)).toHaveLength(10);
    expect(getRank(getRows(container)[0])).toBe("1");
    expect(getRank(getRows(container)[9])).toBe("10");
    expect(screen.getByRole("heading", { level: 2, name: "Recommended songs" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: /recommendation pages/i })).toBeNull();
    expect(goto).not.toHaveBeenCalled();
  });

  it("defers required feedback for blank power until submit and validates integers", async () => {
    const { container } = renderPage(createMissingInputPageData());
    const input = container.querySelector('input[placeholder="e.g. 200000"]') as HTMLInputElement;

    expect(screen.getByText("Total team power")).toBeTruthy();
    expect(input.value).toBe("");
    expect(input.getAttribute("min")).toBe("1");
    expect(input.getAttribute("step")).toBe("1");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText("Enter a value.")).toBeNull();

    await fireEvent.submit(input.closest("form")!);

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Enter a value.")).toBeTruthy();

    await fireEvent.input(input, { target: { value: "1.5" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Enter a positive whole-number team power.")).toBeTruthy();

    await fireEvent.input(input, { target: { value: "200000" } });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText("Enter a positive whole-number team power.")).toBeNull();

    const source = await readFile(pagePath, "utf8");
    const messages = JSON.parse(await readFile(messagesPath, "utf8")) as Record<string, string>;
    expect(source).toContain('translate("musicRecommender.score")');
    expect(messages["musicRecommender.score"]).toBe("Estimated live score");
    expect(messages["musicRecommender.scoreMetric"]).toBe("Estimated score per live");
  });

  it("updates the visible recommendations when the ranked result set changes", async () => {
    const data = createPageData();
    const { container, rerender } = renderPage(data);

    const replacementItems = data.items.map((item, index) => ({
      ...item,
      musicId: item.musicId + 10_000 + index
    }));
    const replacementData = { ...data, items: replacementItems };
    await rerender({ params: {}, data: replacementData, form: null });

    await waitFor(() => expect(getRows(container)).toHaveLength(10));
    expect(getRank(getRows(container)[0])).toBe("1");
    expect(getRows(container)[0].textContent).toContain("Music 11000");
  });

  it("keeps metric, source, and provenance output available", async () => {
    const data = createPageData();
    data.provenance = {
      sourceId: "sekai-best",
      sourceUrl: MUSIC_META_SOURCES["sekai-best"].url,
      recordCount: data.items.length,
      fetchedAt: "2026-01-01T00:00:00Z",
      contentHash: `sha256:${"a".repeat(64)}`,
      freshness: {
        status: "fresh",
        checkedAt: "2026-01-01T00:00:00Z",
        responseDate: "2026-01-01T00:00:00Z",
        responseAgeMs: 0,
        lastModifiedAt: "2026-01-01T00:00:00Z"
      }
    };
    const { container } = renderPage(data);

    await fireEvent.change(screen.getByRole("combobox", { name: "Rank by metric" }), {
      target: { value: "eventPoints" }
    });
    await fireEvent.change(screen.getByRole("combobox", { name: "Music metadata source" }), {
      target: { value: "moesekai" }
    });

    expect(getRows(container)).toHaveLength(10);
    expect(screen.getByText("Source hash")).toBeTruthy();
    expect(screen.getByText(`sha256:${"a".repeat(64)}`)).toBeTruthy();
    expect(screen.getByText("Source last modified")).toBeTruthy();
    expect(goto).toHaveBeenCalledTimes(2);
  });

  it("keeps the recommendation heading localized", async () => {
    const data = createPageData();
    const { rerender } = renderPage(data);
    await rerender({
      params: {},
      data: {
        ...data,
        i18nMessages: { "musicRecommender.results": "Top picks" }
      },
      form: null
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "Top picks" })).toBeTruthy()
    );
  });

  it("renders small result sets and omits pagination for empty results", async () => {
    const smallResult = renderPage(createPageData(createResults(2)));

    expect(getRows(smallResult.container)).toHaveLength(2);
    expect(screen.queryByRole("navigation")).toBeNull();

    cleanup();
    renderPage(createPageData([]));

    expect(screen.getByText("No songs match these complete inputs.")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Recommendation pages" })).toBeNull();
  });

  it("uses the localized recommendation heading and removes obsolete pagination keys", async () => {
    const messages = JSON.parse(await readFile(messagesPath, "utf8")) as Record<string, string>;

    expect(messages["musicRecommender.results"]).toBe("Recommended songs");
    expect(messages["musicRecommender.deckPower"]).toBe("Total team power");
    expect(messages["musicRecommender.deckPowerPlaceholder"]).toBe("e.g. 200000");
    expect(messages["musicRecommender.deckPowerInvalid"]).toBe(
      "Enter a positive whole-number team power."
    );
    expect(messages["musicRecommender.scoreMetric"]).toBe("Estimated score per live");
    expect(messages["musicRecommender.score"]).toBe("Estimated live score");
    expect(messages["musicRecommender.pagination"]).toBeUndefined();
    expect(messages["musicRecommender.paginationSummary"]).toBeUndefined();
    expect(messages["musicRecommender.previousPage"]).toBeUndefined();
    expect(messages["musicRecommender.nextPage"]).toBeUndefined();
  });
});
