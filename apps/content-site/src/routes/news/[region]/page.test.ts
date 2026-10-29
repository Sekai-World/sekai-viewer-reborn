import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import type { I18nMessages } from "@platform/i18n-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameNewsItem, GameNewsLoadResult, GameNewsTag } from "#lib/server/game-news.js";

vi.mock("#lib/settings/content-display.js", () => ({
  getContentDisplaySettings: () => ({ showSpoilerContent: false })
}));

import "#lib/icons/mdi.js";
import NewsPage from "./+page.svelte";
import type { PageData } from "./$types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const messages: I18nMessages = {
  home: "Home",
  closeLabel: "Close",
  "gameNews.title": "Game News",
  "gameNews.filtersLabel": "Game news filters",
  "gameNews.tagsLabel": "News categories",
  "gameNews.tags.information": "Information",
  "gameNews.tags.event": "Event",
  "gameNews.tags.gacha": "Gacha",
  "gameNews.tags.music": "Music",
  "gameNews.tags.campaign": "Campaign",
  "gameNews.tags.bug": "Bug",
  "gameNews.tags.update": "Update",
  "gameNews.showSpoilers": "Show future news",
  "gameNews.unavailableTitle": "Game News is not connected yet",
  "gameNews.unavailableDescription": "News will appear here when the content source is available.",
  "gameNews.error": "Game News could not be loaded.",
  "gameNews.empty": "No news matches these filters.",
  "gameNews.spoilerHidden": "Future news is hidden.",
  "gameNews.openInternal": "Open in viewer",
  "gameNews.openExternal": "Open original",
  "gameNews.internalFrameTitle": "Game News content",
  "gameNews.pagination": "Game news pages",
  "gameNews.previous": "Previous",
  "gameNews.next": "Next"
};

const tags = [
  { value: "information", label: "Information" },
  { value: "event", label: "Event" },
  { value: "gacha", label: "Gacha" },
  { value: "music", label: "Music" },
  { value: "campaign", label: "Campaign" },
  { value: "bug", label: "Bug" },
  { value: "update", label: "Update" }
] as const satisfies readonly { value: GameNewsTag; label: string }[];

const createItem = (
  overrides: Partial<Pick<GameNewsItem, "id" | "title" | "informationTag" | "startAt">> = {}
): GameNewsItem => {
  const id = overrides.id ?? 1;

  return {
    id,
    seq: id,
    displayOrder: null,
    bannerAssetbundleName: null,
    informationType: "normal",
    informationTag: overrides.informationTag ?? "information",
    browseType: "unsupported",
    platform: "all",
    title: overrides.title ?? `News ${id}`,
    path: "",
    startAt: overrides.startAt ?? Date.now() - 60_000,
    endAt: null,
    region: "jp",
    target: { kind: "none", reason: "unsupported-browse-type" },
    internalUrl: null,
    externalUrl: null,
    internalUrlKind: "none",
    externalUrlKind: "none"
  };
};

const createPageData = (news: GameNewsLoadResult, region: "jp" | "en" = "jp"): PageData =>
  ({
    region,
    news,
    i18nMessages: messages,
    uiLocale: "en",
    preferredRegion: "jp",
    globalNotices: [],
    siteVersion: "test"
  }) as PageData;

const renderPage = (news: GameNewsLoadResult) =>
  render(NewsPage, {
    data: createPageData(news),
    params: { region: "jp" },
    form: null
  });

const getShownTitles = (): string[] =>
  within(screen.getByRole("tabpanel"))
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent ?? "");

describe("Game News page behavior", () => {
  it("renders and applies each of the seven legacy tag filters", async () => {
    const items = tags.map(({ value, label }, index) =>
      createItem({
        id: index + 1,
        title: `${label} news`,
        informationTag: value,
        startAt: Date.now() - (tags.length - index) * 1_000
      })
    );
    renderPage({ status: "ready", items });

    expect(screen.getAllByRole("tab")).toHaveLength(7);
    const tablist = screen.getByRole("tablist", { name: "News categories" });
    expect(within(tablist).getAllByRole("tab")).toHaveLength(7);

    for (const { value, label } of tags) {
      const tab = screen.getByRole("tab", { name: label });
      await fireEvent.click(tab);

      expect(tab.getAttribute("aria-selected")).toBe("true");
      expect(getShownTitles()).toEqual([`${label} news`]);
      expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
        `game-news-tab-${value}`
      );
    }
  });

  it("filters only strictly future items, keeping an item that starts exactly now", async () => {
    const now = Date.parse("2025-05-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    renderPage({
      status: "ready",
      items: [
        createItem({ id: 1, title: "Past news", startAt: now - 1 }),
        createItem({ id: 2, title: "News starting now", startAt: now }),
        createItem({ id: 3, title: "Future news", startAt: now + 1 })
      ]
    });

    expect(getShownTitles()).toEqual(["News starting now", "Past news"]);
    expect(screen.queryByRole("heading", { name: "Future news" })).toBeNull();

    await fireEvent.click(screen.getByRole("checkbox", { name: "Show future news" }));

    expect(getShownTitles()).toEqual(["Future news", "News starting now", "Past news"]);
  });

  it("sorts by start time descending and paginates locally in groups of ten", async () => {
    const now = Date.now();
    const items = Array.from({ length: 12 }, (_, index) =>
      createItem({
        id: index + 1,
        title: `News ${index + 1}`,
        startAt: now - (12 - index) * 1_000
      })
    );
    renderPage({ status: "ready", items });

    expect(getShownTitles()).toEqual([
      "News 12",
      "News 11",
      "News 10",
      "News 9",
      "News 8",
      "News 7",
      "News 6",
      "News 5",
      "News 4",
      "News 3"
    ]);
    expect(screen.getByText("1 / 2")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(getShownTitles()).toEqual(["News 2", "News 1"]);
    expect(screen.getByText("2 / 2")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(getShownTitles()[0]).toBe("News 12");
  });

  it("resets pagination when the selected tag changes", async () => {
    const informationItems = Array.from({ length: 11 }, (_, index) =>
      createItem({
        id: index + 1,
        title: `Information ${index + 1}`,
        startAt: Date.now() - (11 - index) * 1_000
      })
    );
    renderPage({
      status: "ready",
      items: [
        ...informationItems,
        createItem({ id: 12, title: "Update news", informationTag: "update" })
      ]
    });

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 2")).toBeTruthy();

    await fireEvent.click(screen.getByRole("tab", { name: "Update" }));

    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(getShownTitles()).toEqual(["Update news"]);
  });

  it("resets the current page when hiding spoilers reduces the result count", async () => {
    const now = Date.parse("2025-05-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const items = Array.from({ length: 11 }, (_, index) =>
      createItem({
        id: index + 1,
        title: index === 10 ? "Future news" : `Past news ${index + 1}`,
        startAt: index === 10 ? now + 1 : now - (10 - index) * 1_000
      })
    );
    renderPage({ status: "ready", items });

    await fireEvent.click(screen.getByRole("checkbox", { name: "Show future news" }));
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 2")).toBeTruthy();

    await fireEvent.click(screen.getByRole("checkbox", { name: "Show future news" }));

    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(getShownTitles()).toHaveLength(10);
    expect(screen.queryByRole("heading", { name: "Future news" })).toBeNull();
    expect(screen.queryByText("No news matches these filters.")).toBeNull();
  });

  it.each([
    [{ status: "unavailable" }, "Game News is not connected yet"],
    [{ status: "error" }, "Game News could not be loaded."],
    [{ status: "empty" }, "No news matches these filters."]
  ] as const)("shows the %s load state", (news, message) => {
    renderPage(news);

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Game news pages" })).toBeNull();
  });

  it("shows an empty state when no items match the selected tag", () => {
    renderPage({
      status: "ready",
      items: [createItem({ informationTag: "event" })]
    });

    expect(screen.getByText("No news matches these filters.")).toBeTruthy();
  });
});
