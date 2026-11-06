import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComicItem } from "#lib/domain/comic.js";
import type { ContentSiteTranslator } from "#lib/i18n/runtime.js";
import ComicPreviewDialog from "./ComicPreviewDialog.svelte";

type NavigationOptions = {
  shallow?: boolean;
  replace?: boolean;
  persistState?: boolean;
  state?: App.PageState;
};
type HistoryEntry = { state: App.PageState; shallowURL: URL | null };

const kit = vi.hoisted(() => ({
  setState: (state: App.PageState): void => {
    void state;
  },
  setShallowURL: (url: URL | null): void => {
    void url;
  },
  goto: vi.fn<(url: string | URL, options: NavigationOptions) => Promise<void>>()
}));

vi.mock("$app/state", async () => {
  const { SvelteMap } = await import("svelte/reactivity");
  const state = new SvelteMap<string, App.PageState>([["current", {}]]);
  const shallowURL = new SvelteMap<string, URL | null>([["current", null]]);
  kit.setState = (value) => state.set("current", value);
  kit.setShallowURL = (value) => shallowURL.set("current", value);
  return {
    page: {
      url: new URL("http://localhost/comics/jp"),
      get state() {
        return state.get("current") ?? {};
      },
      get shallow() {
        const url = shallowURL.get("current");
        return url ? { url } : null;
      }
    }
  };
});
vi.mock("$app/navigation", () => ({ goto: kit.goto }));
vi.mock("$app/env/public", () => ({ PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }));

const comics: ComicItem[] = [
  { id: 1001, title: "First", assetbundleName: "comic_0001" },
  { id: 1002, title: "Second", assetbundleName: "comic_0002" },
  { id: 1003, title: "Third", assetbundleName: "comic_0003" }
];
const catalogueKey = "jp:";
const t: ContentSiteTranslator = (key) => key;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
let entries: HistoryEntry[];
let index: number;

const travel = (delta: number): void => {
  index = Math.max(0, Math.min(entries.length - 1, index + delta));
  kit.setState(entries[index].state);
  kit.setShallowURL(entries[index].shallowURL);
};

beforeEach(() => {
  entries = [{ state: {}, shallowURL: null }];
  index = 0;
  kit.setState({});
  kit.setShallowURL(null);
  kit.goto.mockReset().mockImplementation(async (url, options) => {
    const entry = { state: options.state ?? {}, shallowURL: options.shallow ? new URL(url) : null };
    if (options.replace) {
      entries[index] = entry;
    } else {
      entries.splice(index + 1);
      entries.push(entry);
      index += 1;
    }
    kit.setState(entry.state);
    kit.setShallowURL(entry.shallowURL);
  });
  vi.spyOn(history, "back").mockImplementation(() => {
    queueMicrotask(() => travel(-1));
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    }
  });
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-comic-preview-id]").forEach((element) => element.remove());
  vi.restoreAllMocks();
  if (originalShowModal) {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  } else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) {
    Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  } else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

const open = async (list: readonly ComicItem[] = comics) => {
  const tiles = list.map((comic) => {
    const tile = document.createElement("button");
    tile.dataset.comicPreviewId = String(comic.id);
    document.body.append(tile);
    return tile;
  });
  const { component } = render(ComicPreviewDialog, { catalogueKey, region: "jp", comics: list, t });
  await component.show(list[0], tiles[0]);
  await tick();
  return tiles;
};

const shownImage = (): string | null =>
  screen.getByRole("dialog").querySelector("img")?.getAttribute("src") ?? null;

describe("ComicPreviewDialog", () => {
  it("opens the comic in its own history entry, from the page's region", async () => {
    await open();

    expect(entries).toHaveLength(2);
    expect(screen.getByRole("dialog", { name: "First" })).toBeTruthy();
    expect(shownImage()).toContain("/sekai-jp-assets/comic/one_frame/comic_0001.webp");
  });

  it("steps with the buttons and wraps around at both ends", async () => {
    await open();

    await fireEvent.click(screen.getByRole("button", { name: "comic.previewNext" }));
    await tick();
    expect(shownImage()).toContain("comic_0002");

    await fireEvent.click(screen.getByRole("button", { name: "comic.previewPrevious" }));
    await tick();
    await fireEvent.click(screen.getByRole("button", { name: "comic.previewPrevious" }));
    await tick();
    expect(shownImage()).toContain("comic_0003");

    await fireEvent.click(screen.getByRole("button", { name: "comic.previewNext" }));
    await tick();
    expect(shownImage()).toContain("comic_0001");
  });

  it("steps with the arrow keys, but not with a modifier held", async () => {
    await open();

    await fireEvent.keyDown(window, { key: "ArrowRight" });
    await tick();
    expect(shownImage()).toContain("comic_0002");

    await fireEvent.keyDown(window, { key: "ArrowLeft" });
    await tick();
    expect(shownImage()).toContain("comic_0001");

    await fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    await fireEvent.keyDown(window, { key: "Enter" });
    await tick();
    expect(shownImage()).toContain("comic_0001");
  });

  it("ignores arrow keys while closed", async () => {
    render(ComicPreviewDialog, { catalogueKey, region: "jp", comics, t });

    await fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(kit.goto).not.toHaveBeenCalled();
  });

  it("keeps one history entry while stepping, so Back closes the preview", async () => {
    await open();

    await fireEvent.keyDown(window, { key: "ArrowRight" });
    await tick();
    await fireEvent.keyDown(window, { key: "ArrowRight" });
    await tick();
    expect(entries).toHaveLength(2);

    travel(-1);
    await tick();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns focus to the comic last shown when it closes", async () => {
    const tiles = await open();

    await fireEvent.keyDown(window, { key: "ArrowRight" });
    await tick();
    travel(-1);
    await tick();

    expect(document.activeElement).toBe(tiles[1]);
  });

  it("consumes the preview's history entry when dismissed", async () => {
    await open();

    const dialog = screen.getByRole("dialog");
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
    await tick();

    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it("does not stack entries when a second comic is opened over the first", async () => {
    const tile = document.createElement("button");
    const { component } = render(ComicPreviewDialog, { catalogueKey, region: "jp", comics, t });

    await component.show(comics[0], tile);
    await tick();
    await component.show(comics[1], tile);

    expect(entries).toHaveLength(2);
    expect(shownImage()).toContain("comic_0001");
  });

  it("steps only through the comics it is given", async () => {
    await open([comics[0], comics[2]]);

    await fireEvent.keyDown(window, { key: "ArrowRight" });
    await tick();

    expect(shownImage()).toContain("comic_0003");
  });

  it("shows no stepping controls for a single comic", async () => {
    await open([comics[0]]);

    expect(screen.queryByRole("button", { name: "comic.previewNext" })).toBeNull();

    await fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(kit.goto).toHaveBeenCalledTimes(1);
  });

  it("does not open from a state that belongs to another list", async () => {
    kit.setShallowURL(new URL("http://localhost/comics/jp"));
    kit.setState({ comicPreview: { catalogueKey: "jp:first", comic: comics[0] } });

    render(ComicPreviewDialog, { catalogueKey, region: "jp", comics, t });
    await tick();

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
