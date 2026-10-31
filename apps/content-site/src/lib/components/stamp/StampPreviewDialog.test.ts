import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StampItem } from "#lib/domain/stamp.js";
import type { ContentSiteTranslator } from "#lib/i18n/runtime.js";
import StampPreviewDialog from "./StampPreviewDialog.svelte";
import StampTile from "./StampTile.svelte";

type NavigationOptions = {
  shallow?: boolean;
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
      url: new URL("http://localhost/stamps/jp?category=character&name=hello#results"),
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

const stamp: StampItem = {
  id: 38,
  name: "[スタンプ]咲希：Hello!",
  characterIds: [],
  category: "character",
  stampType: "normal",
  assetbundleName: "stamp0038",
  description: "A stamp shop reward"
};
const catalogueKey = "jp:category=character&name=hello";
const messages: Record<string, string> = {
  closeLabel: "Close",
  imageUnavailable: "Image unavailable",
  "stamp.previewDownload": "Download",
  "stamp.previewOpenInNewWindow": "Open image in new window",
  "stamp.previewName": "Name",
  "stamp.previewCharacters": "Characters",
  "stamp.previewObtain": "How to obtain"
};
const t: ContentSiteTranslator = (key) => messages[key] ?? key;
const props = { catalogueKey, region: "jp", characters: [], t } as const;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
let entries: HistoryEntry[];
let index: number;
let returnFocus: WeakMap<HTMLDialogElement, HTMLElement>;

const travel = (delta: number): void => {
  index = Math.max(0, Math.min(entries.length - 1, index + delta));
  kit.setState(entries[index].state);
  kit.setShallowURL(entries[index].shallowURL);
};

beforeEach(() => {
  entries = [{ state: {}, shallowURL: null }];
  index = 0;
  returnFocus = new WeakMap();
  kit.setState({});
  kit.setShallowURL(null);
  kit.goto.mockReset().mockImplementation(async (url, options) => {
    const state = options.state ?? {};
    const shallowURL = options.shallow ? new URL(url) : null;
    entries.splice(index + 1);
    entries.push({ state, shallowURL });
    index += 1;
    kit.setState(state);
    kit.setShallowURL(shallowURL);
  });
  vi.spyOn(history, "back").mockImplementation(() => {
    // Native traversal is asynchronous; multiple close events must not skip the list.
    queueMicrotask(() => travel(-1));
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (document.activeElement instanceof HTMLElement) {
        returnFocus.set(this, document.activeElement);
      }
      this.setAttribute("open", "");
      this.querySelector<HTMLElement>("summary, button")?.focus();
    }
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
      returnFocus.get(this)?.focus({ preventScroll: true });
      this.dispatchEvent(new Event("close"));
    }
  });
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-stamp-preview-id]").forEach((element) => element.remove());
  if (originalShowModal) {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  } else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) {
    Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  } else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

const setup = () => {
  const trigger = document.createElement("button");
  trigger.dataset.stampPreviewId = String(stamp.id);
  trigger.textContent = "Hello!";
  document.body.append(trigger);
  return { ...render(StampPreviewDialog, props), trigger };
};

const getDialog = (): HTMLDialogElement => screen.getByRole("dialog", { name: "Hello!" });

const rects = (visible = true): DOMRectList => {
  const values = visible ? [new DOMRect(0, 0, 44, 44)] : [];
  return Object.assign(values, { item: (index: number) => values[index] ?? null });
};

// jsdom has no layout or native sequential focus navigation. Give the real
// controls geometry, with closed-details links excluded just as in Chromium.
const layoutControls = (dialog: HTMLDialogElement): void => {
  dialog
    .querySelectorAll<HTMLElement>("summary, a[href], button, [tabindex]")
    .forEach((element) => {
      vi.spyOn(element, "getClientRects").mockReturnValue(
        rects(!element.matches("details:not([open]) a"))
      );
    });
};

describe("stamp list history-only preview", () => {
  it("keeps the tile a named native button and passes the actual trigger into the preview", async () => {
    const { component } = render(StampPreviewDialog, props);
    render(StampTile, {
      stamp,
      imageSrc: null,
      imageUnavailableLabel: "Image unavailable",
      onOpen: (trigger) => void component.show(stamp, trigger)
    });
    const trigger = screen.getByRole("button", { name: "Hello!" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("type")).toBe("button");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    await fireEvent.click(trigger);
    expect(getDialog().open).toBe(true);
    travel(-1);
    await tick();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens one same-URL Kit 3 shallow entry without persisting state or resetting the list", async () => {
    const { component, trigger } = setup();
    const first = component.show(stamp, trigger);
    const second = component.show(stamp, trigger);
    await Promise.all([first, second]);
    await tick();

    expect(kit.goto).toHaveBeenCalledExactlyOnceWith(
      "http://localhost/stamps/jp?category=character&name=hello#results",
      {
        shallow: true,
        persistState: false,
        state: { stampPreview: { catalogueKey, stamp } }
      }
    );
    expect(getDialog().open).toBe(true);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(entries).toHaveLength(2);
  });

  it("Back closes once, returns focus to the tile, and Forward reopens without another goto", async () => {
    const { component, trigger } = setup();
    const focus = vi.spyOn(trigger, "focus");
    await component.show(stamp, trigger);
    await tick();
    expect(getDialog().contains(document.activeElement)).toBe(true);

    travel(-1);
    await tick();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(history.back).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });

    travel(1);
    await tick();
    expect(getDialog().open).toBe(true);
    expect(getDialog().contains(document.activeElement)).toBe(true);
    expect(kit.goto).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("repairs BODY focus on the frame after Forward without scrolling", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frames.push(callback)
    );
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    const openingFrame = frames.length;
    travel(-1);
    await tick();
    expect(cancel).toHaveBeenCalledWith(openingFrame);

    travel(1);
    await tick();
    const download = within(getDialog()).getByLabelText("Download");
    const focus = vi.spyOn(download, "focus");
    // Reproduce WebKit's native history focus restoration after showModal.
    download.blur();
    expect(document.activeElement).toBe(document.body);
    frames.at(-1)!(0);

    expect(document.activeElement).toBe(download);
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(kit.goto).toHaveBeenCalledTimes(1);
    expect(history.back).not.toHaveBeenCalled();
  });

  it("does not move focus away from a control or another dialog before the repair frame", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frames.push(callback)
    );
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    const dialog = getDialog();
    const link = within(dialog).getByRole("link", { name: "Open image in new window" });
    link.focus();
    frames.at(-1)!(0);
    expect(document.activeElement).toBe(link);

    const other = document.createElement("dialog");
    const button = document.createElement("button");
    other.append(button);
    document.body.append(other);
    try {
      other.showModal();
      frames.at(-1)!(0);
      expect(document.activeElement).toBe(button);
    } finally {
      other.remove();
    }
  });

  it("falls back to Close when image actions are unavailable", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frames.push(callback)
    );
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    const dialog = getDialog();
    dialog.querySelector("details")!.remove();
    within(dialog).getByRole("link", { name: "Open image in new window" }).remove();
    expect(document.activeElement).toBe(document.body);
    frames.at(-1)!(0);
    expect(document.activeElement).toBe(
      within(dialog).getAllByRole("button", { name: "Close" })[0]
    );
  });

  it("cancels pending focus repair on close and unmount and ignores a stale closed frame", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frames.push(callback)
    );
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const { component, trigger, unmount } = setup();
    await component.show(stamp, trigger);
    await tick();
    const firstFrame = frames.length;
    travel(-1);
    await tick();
    expect(cancel).toHaveBeenCalledWith(firstFrame);
    frames[firstFrame - 1](0);
    expect(document.activeElement).toBe(trigger);

    travel(1);
    await tick();
    const lastFrame = frames.length;
    unmount();
    expect(cancel).toHaveBeenCalledWith(lastFrame);
  });

  it.each(["close button", "Escape", "backdrop"])(
    "%s uses native dismissal and consumes only the preview entry",
    async (method) => {
      const { component, trigger } = setup();
      await component.show(stamp, trigger);
      await tick();
      const dialog = getDialog();
      if (method === "Escape") {
        const cancel = new Event("cancel", { cancelable: true });
        await fireEvent(dialog, cancel);
        expect(cancel.defaultPrevented).toBe(false);
      } else {
        const buttons = within(dialog).getAllByRole("button", { name: "Close" });
        const button = method === "backdrop" ? buttons[buttons.length - 1] : buttons[0];
        expect(button.closest("form")?.getAttribute("method")).toBe("dialog");
        await fireEvent.submit(button.closest("form")!);
      }
      // jsdom has no native dialog dismissal/default form action; emulate only that part.
      dialog.close();
      dialog.dispatchEvent(new Event("close"));
      await tick();

      expect(history.back).toHaveBeenCalledTimes(1);
      expect(index).toBe(0);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    }
  );

  it("ignores an old queued close event after Forward has reopened the native dialog", async () => {
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    travel(-1);
    await tick();
    travel(1);
    await tick();
    await fireEvent(getDialog(), new Event("close"));

    expect(history.back).not.toHaveBeenCalled();
    expect(getDialog().open).toBe(true);
  });

  it("repeated open/close cycles replace the forward branch rather than accumulating entries", async () => {
    const { component, trigger } = setup();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await component.show(stamp, trigger);
      await tick();
      getDialog().close();
      await tick();
      expect(index).toBe(0);
      expect(entries).toHaveLength(2);
    }
    expect(history.back).toHaveBeenCalledTimes(3);
  });

  it("normal navigation clears the preview without requesting Back, and stale filter/region state is ignored", async () => {
    const { component, trigger, rerender } = setup();
    await component.show(stamp, trigger);
    await tick();
    // A regular Kit navigation gets empty state, unlike shallow traversal.
    await kit.goto(new URL("http://localhost/cards/jp"), {});
    await tick();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(history.back).not.toHaveBeenCalled();

    travel(-1);
    await tick();
    expect(getDialog().open).toBe(true);
    await rerender({ ...props, catalogueKey: "tw:category=bond", region: "tw" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(history.back).not.toHaveBeenCalled();
  });

  it("can open another stamp after closing and preserves unrelated page state", async () => {
    const unrelated: App.PageState & { retained: boolean } = { retained: true };
    entries[0] = { state: unrelated, shallowURL: null };
    kit.setState(unrelated);
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    getDialog().close();
    await tick();
    const another = { ...stamp, id: 39, name: "Another stamp" };
    await component.show(another, trigger);
    await tick();
    expect(screen.getByRole("dialog", { name: "Another stamp" })).toBeTruthy();
    expect(entries).toHaveLength(2);
    expect(kit.goto.mock.calls[0][1].state).toMatchObject({ retained: true });
    expect(kit.goto.mock.calls[1][1].state?.stampPreview?.stamp.id).toBe(39);
  });

  it("direct entry and reload with Kit's empty non-persisted page state show only the list", async () => {
    const { component, trigger, unmount } = setup();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(kit.goto).not.toHaveBeenCalled();
    await component.show(stamp, trigger);
    await tick();
    expect(getDialog().open).toBe(true);

    unmount();
    kit.setState({});
    kit.setShallowURL(null);
    render(StampPreviewDialog, props);
    await tick();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(history.back).not.toHaveBeenCalled();
    expect(kit.goto).toHaveBeenCalledTimes(1);
  });

  it.each([null, new URL("http://localhost/cards/jp")])(
    "ignores even a matching stale payload without a same-URL shallow entry (%s)",
    async (shallowURL) => {
      kit.setState({ stampPreview: { catalogueKey, stamp } });
      kit.setShallowURL(shallowURL);
      setup();
      await tick();

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(kit.goto).not.toHaveBeenCalled();
      expect(history.back).not.toHaveBeenCalled();
    }
  );

  it("keeps the native accessible dialog, localized controls, downloads, and scrollable mobile box", async () => {
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    const dialog = getDialog();
    expect(dialog.tagName).toBe("DIALOG");
    expect(within(dialog).getByRole("img", { name: "Hello!" }).getAttribute("alt")).toBe("Hello!");
    expect(within(dialog).getByText("A stamp shop reward")).toBeTruthy();
    expect(within(dialog).getByLabelText("Download")).toBeTruthy();
    const newWindow = within(dialog).getByRole("link", { name: "Open image in new window" });
    expect(newWindow.getAttribute("target")).toBe("_blank");
    expect(newWindow.getAttribute("rel")).toBe("noreferrer");
    expect(
      within(dialog).getByRole("link", { name: "Download PNG" }).getAttribute("download")
    ).toBe("");
    expect(dialog.querySelector(".modal-box")?.classList).toContain("overflow-y-auto");
    expect(dialog.querySelector(".modal-box")?.classList).toContain("max-h-[92dvh]");
  });

  it("wraps boundary Tab and Shift+Tab inside the stamp dialog without affecting Escape or restore focus", async () => {
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    const dialog = getDialog();
    layoutControls(dialog);
    const first = within(dialog).getByLabelText("Download");
    const last = within(dialog).getAllByRole("button", { name: "Close" }).at(-1)!;
    first.focus();

    const backward = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    await fireEvent(first, backward);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    const forward = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await fireEvent(last, forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    await fireEvent(first, escape);
    expect(escape.defaultPrevented).toBe(false);
    dialog.close();
    await tick();
    expect(document.activeElement).toBe(trigger);
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it("leaves native interior Tab order and download-menu activation unchanged", async () => {
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    const dialog = getDialog();
    layoutControls(dialog);
    const summary = within(dialog).getByLabelText("Download");
    summary.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await fireEvent(summary, tab);
    expect(tab.defaultPrevented).toBe(false);
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    await fireEvent(summary, enter);
    expect(enter.defaultPrevented).toBe(false);

    dialog.querySelector("details")!.open = true;
    const download = within(dialog).getByRole("link", { name: "Download PNG" });
    vi.mocked(download.getClientRects).mockReturnValue(rects());
    download.focus();
    const menuTab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await fireEvent(download, menuTab);
    expect(menuTab.defaultPrevented).toBe(false);
    expect(history.back).not.toHaveBeenCalled();
  });

  it("excludes hidden, disabled, and non-tabbable controls and recomputes after image actions disappear", async () => {
    const { component, trigger } = setup();
    await component.show(stamp, trigger);
    await tick();
    const dialog = getDialog();
    const hidden = document.createElement("button");
    hidden.hidden = true;
    dialog.prepend(hidden);
    for (const attributes of [
      { disabled: "" },
      { tabindex: "-1" },
      { style: "visibility: hidden" }
    ]) {
      const excluded = document.createElement("button");
      for (const [key, value] of Object.entries(attributes)) excluded.setAttribute(key, value);
      dialog.append(excluded);
    }
    layoutControls(dialog);
    const first = within(dialog).getByLabelText("Download");
    const last = within(dialog).getAllByRole("button", { name: "Close" }).at(-1)!;
    first.focus();
    await fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    // The shared image error state removes its download and new-window actions.
    dialog.querySelector("details")!.remove();
    within(dialog).getByRole("link", { name: "Open image in new window" }).remove();
    await fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(
      within(dialog).getAllByRole("button", { name: "Close" })[0]
    );
  });

  it("does not intercept another preview and removes its listener when unmounted", async () => {
    const { component, trigger, unmount } = setup();
    await component.show(stamp, trigger);
    await tick();
    const dialog = getDialog();
    layoutControls(dialog);
    const other = document.createElement("dialog");
    const otherButton = document.createElement("button");
    other.append(otherButton);
    document.body.append(other);
    try {
      other.showModal();
      const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      await fireEvent(otherButton, tab);
      expect(tab.defaultPrevented).toBe(false);
      const remove = vi.spyOn(dialog, "removeEventListener");
      unmount();
      expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
    } finally {
      other.remove();
    }
  });
});
