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
    deckPower: 1,
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

  it("paginates more than 100 ranked results locally and preserves their global ranks", async () => {
    const { container } = renderPage(createPageData());

    expect(getRows(container)).toHaveLength(50);
    expect(getRank(getRows(container)[0])).toBe("1");
    expect(getRank(getRows(container)[49])).toBe("50");
    expect(screen.getByText("Showing 1-50 of 126 results · Page 1 of 3")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(getRows(container)).toHaveLength(50);
    expect(getRank(getRows(container)[0])).toBe("51");
    expect(getRank(getRows(container)[49])).toBe("100");
    expect(screen.getByText("Showing 51-100 of 126 results · Page 2 of 3")).toBeTruthy();
    expect(goto).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(getRows(container)).toHaveLength(26);
    expect(getRank(getRows(container)[0])).toBe("101");
    expect(getRank(getRows(container)[25])).toBe("126");
    expect(screen.getByText("Showing 101-126 of 126 results · Page 3 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
    expect(goto).not.toHaveBeenCalled();
  });

  it("uses the page selector for a final partial page and clamps navigation boundaries", async () => {
    const { container } = renderPage(createPageData(createResults(103)));
    const pageSelect = screen.getByRole("combobox", { name: "Page" }) as HTMLSelectElement;

    await fireEvent.change(pageSelect, { target: { value: "3" } });

    expect(pageSelect.value).toBe("3");
    expect(getRows(container)).toHaveLength(3);
    expect(getRank(getRows(container)[0])).toBe("101");
    expect(getRank(getRows(container)[2])).toBe("103");
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);

    await fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(pageSelect.value).toBe("2");
    expect(getRows(container)).toHaveLength(50);
    expect(getRank(getRows(container)[0])).toBe("51");
    expect(goto).not.toHaveBeenCalled();
  });

  it("resets for same-size replacements and clamps when the result set shrinks", async () => {
    const data = createPageData(createResults(103));
    const { container, rerender } = renderPage(data);

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect((screen.getByRole("combobox", { name: "Page" }) as HTMLSelectElement).value).toBe("2");

    const replacementItems = data.items.map((item, index) =>
      index === 75 ? { ...item, musicId: item.musicId + 10_000 } : item
    );
    const replacementData = { ...data, items: replacementItems };
    await rerender({ params: {}, data: replacementData, form: null });

    await waitFor(() => {
      expect((screen.getByRole("combobox", { name: "Page" }) as HTMLSelectElement).value).toBe("1");
    });
    expect(getRows(container)).toHaveLength(50);
    expect(getRank(getRows(container)[0])).toBe("1");
    expect(screen.getByText("Showing 1-50 of 103 results · Page 1 of 3")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await rerender({
      params: {},
      data: { ...replacementData, items: createResults(10) },
      form: null
    });

    await waitFor(() => {
      expect((screen.getByRole("combobox", { name: "Page" }) as HTMLSelectElement).value).toBe("1");
    });
    expect(getRows(container)).toHaveLength(10);
    expect(screen.getByText("Showing 1-10 of 10 results · Page 1 of 1")).toBeTruthy();
  });

  it("keeps the selected page when the translation bundle updates", async () => {
    const data = createPageData(createResults(103));
    const { rerender } = renderPage(data);

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await rerender({
      params: {},
      data: {
        ...data,
        i18nMessages: { "musicRecommender.title": "Translated recommender title" }
      },
      form: null
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Translated recommender title"
      );
    });
    expect((screen.getByRole("combobox", { name: "Page" }) as HTMLSelectElement).value).toBe("2");
    expect(screen.getByText("Showing 51-100 of 103 results · Page 2 of 3")).toBeTruthy();
  });

  it("resets pagination when the metric, source, or submitted inputs change", async () => {
    renderPage(createPageData());
    const getPageSelect = (): HTMLSelectElement =>
      screen.getByRole("combobox", { name: "Page" }) as HTMLSelectElement;

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await fireEvent.change(screen.getByRole("combobox", { name: "Rank by metric" }), {
      target: { value: "eventPoints" }
    });
    await waitFor(() => {
      expect(getPageSelect().value).toBe("1");
      expect(screen.getByRole("table")).toBeTruthy();
    });
    expect(goto).toHaveBeenCalledTimes(1);

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await fireEvent.change(screen.getByRole("combobox", { name: "Music metadata source" }), {
      target: { value: "moesekai" }
    });
    await waitFor(() => {
      expect(getPageSelect().value).toBe("1");
      expect(screen.getByRole("table")).toBeTruthy();
    });
    expect(goto).toHaveBeenCalledTimes(2);

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await fireEvent.click(screen.getByRole("button", { name: "Recalculate recommendations" }));
    await waitFor(() => {
      expect(getPageSelect().value).toBe("1");
      expect(screen.getByRole("table")).toBeTruthy();
    });
    expect(goto).toHaveBeenCalledTimes(3);
  });

  it("keeps small result sets on one page and omits pagination for empty results", async () => {
    const smallResult = renderPage(createPageData(createResults(2)));

    expect(getRows(smallResult.container)).toHaveLength(2);
    expect(screen.getByText("Showing 1-2 of 2 results · Page 1 of 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);

    cleanup();
    renderPage(createPageData([]));

    expect(screen.getByText("No songs match these complete inputs.")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Recommendation pages" })).toBeNull();
  });

  it("keeps pagination controls outside the horizontally scrolling table wrapper", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source.indexOf("</table>\n        </div>\n        <nav")).toBeGreaterThan(-1);
  });

  it("provides localized pagination labels and a compact page selector", async () => {
    const messages = JSON.parse(await readFile(messagesPath, "utf8")) as Record<string, string>;

    expect(messages["musicRecommender.pagination"]).toBe("Recommendation pages");
    expect(messages["musicRecommender.paginationSummary"]).toContain("{total}");
    expect(messages["musicRecommender.previousPage"]).toBe("Previous");
    expect(messages["musicRecommender.nextPage"]).toBe("Next");
  });
});
