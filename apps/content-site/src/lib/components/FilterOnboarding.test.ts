import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeforeNavigate } from "$app/navigation";
import { tick } from "svelte";
import FilterOnboarding from "./FilterOnboarding.svelte";
import { readFilterGuideSeen, writeFilterGuideSeen } from "#lib/filter-onboarding.js";

type NavigationDetails = Pick<BeforeNavigate, "shallow" | "type">;
const navigationCallbacks = vi.hoisted(() => [] as ((navigation: NavigationDetails) => void)[]);

vi.mock("$app/navigation", () => ({
  beforeNavigate: (callback: (navigation: NavigationDetails) => void) =>
    navigationCallbacks.push(callback)
}));

const triggerBeforeNavigate = (navigation: NavigationDetails): void => {
  navigationCallbacks.forEach((callback) => callback(navigation));
};

vi.mock("#lib/filter-onboarding.js", () => ({
  readFilterGuideSeen: vi.fn(() => false),
  writeFilterGuideSeen: vi.fn()
}));

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeEach(() => {
  navigationCallbacks.length = 0;
  vi.mocked(readFilterGuideSeen).mockReset().mockReturnValue(false);
  vi.mocked(writeFilterGuideSeen).mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    }
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (!this.open) return;
      this.open = false;
      queueMicrotask(() => this.dispatchEvent(new Event("close")));
    }
  });
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("dialog[data-test-filter]").forEach((dialog) => dialog.remove());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalShowModal)
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

const labels: Record<string, string> = {
  "filterGuide.prompt.title": "Would you like a filter guide?",
  "filterGuide.prompt.accept": "Show guide",
  "filterGuide.prompt.skip": "Use filters",
  "onboarding.nextLabel": "Next",
  "onboarding.previousLabel": "Previous",
  "onboarding.finishLabel": "Finish",
  closeLabel: "Close"
};

const setup = () => {
  const filter = document.createElement("dialog");
  filter.dataset.testFilter = "";
  const name = document.createElement("input");
  name.dataset.filterGuide = "name";
  name.scrollIntoView = vi.fn();
  const actions = document.createElement("button");
  actions.dataset.filterGuide = "actions";
  actions.scrollIntoView = vi.fn();
  const panel = document.createElement("div");
  panel.className = "modal-box";
  panel.append(name, actions);
  filter.append(panel);
  document.body.append(filter);
  const result = render(FilterOnboarding, {
    scope: "cards",
    dialog: filter,
    translate: (key: string) => labels[key] ?? key,
    targets: ["name", "actions"]
  });
  const prompt = result.container.querySelector<HTMLDialogElement>("dialog.modal")!;
  const tour = result.container.querySelector<HTMLDialogElement>("dialog.onboarding-tour")!;
  const openFilters = vi.fn(() => filter.showModal());
  const open = () => result.component.requestOpen(openFilters);
  return { ...result, filter, panel, prompt, tour, name, actions, openFilters, open };
};

const mockEntryAnimation = (panel: HTMLElement) => {
  let complete = () => {};
  let cancel = () => {};
  const finished = new Promise<void>((resolve, reject) => {
    complete = resolve;
    cancel = () => reject(new Error("Animation cancelled"));
  });
  const getAnimations = vi.fn(() => [
    { playState: "running", effect: { getComputedTiming: () => ({ endTime: 180 }) }, finished },
    {
      playState: "running",
      effect: { getComputedTiming: () => ({ endTime: Infinity }) },
      finished: new Promise<void>(() => {})
    },
    {
      playState: "paused",
      effect: { getComputedTiming: () => ({ endTime: 180 }) },
      finished: new Promise<void>(() => {})
    }
  ]);
  Object.defineProperty(panel, "getAnimations", { configurable: true, value: getAnimations });
  return { complete, cancel, finished, getAnimations };
};

describe("first-use filter guide", () => {
  it("snapshots a rendered conditional control without shifting indices on later prop updates", async () => {
    const { panel, prompt, tour, open, rerender, actions } = setup();
    const supportUnit = document.createElement("fieldset");
    supportUnit.dataset.filterGuide = "supportUnit";
    supportUnit.scrollIntoView = vi.fn();
    panel.insertBefore(supportUnit, actions);
    await rerender({ targets: ["name", "supportUnit", "actions"] });
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));
    await rerender({ targets: ["name", "actions"] });
    await fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    expect(supportUnit.scrollIntoView).toHaveBeenCalledOnce();
    expect(within(tour).getByRole("heading").textContent).toBe(
      "filterGuide.steps.supportUnit.title"
    );
    await fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    expect(actions.scrollIntoView).toHaveBeenCalledOnce();
    expect(within(tour).getByRole("button", { name: "Finish" })).toBeTruthy();
  });

  it("excludes an unavailable conditional target instead of counting a fallback step", async () => {
    const { prompt, tour, open, rerender, actions } = setup();
    await rerender({ targets: ["name", "supportUnit", "actions"] });
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));
    await fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    expect(actions.scrollIntoView).toHaveBeenCalledOnce();
    expect(within(tour).getByRole("heading").textContent).toBe("filterGuide.steps.actions.title");
    expect(within(tour).getByRole("button", { name: "Finish" })).toBeTruthy();
  });

  it("leaves filters usable without starting an empty tour", async () => {
    const { prompt, tour, filter, name, actions, open } = setup();
    name.remove();
    actions.remove();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    expect(filter.open).toBe(true);
    expect(tour.open).toBe(false);
  });

  it("stops rather than presenting a fallback if a snapshotted control disappears", async () => {
    const { prompt, tour, filter, actions, open } = setup();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));
    actions.remove();
    await fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    await waitFor(() => expect(tour.open).toBe(false));
    expect(filter.open).toBe(true);
  });
  it("waits for finite modal-box entry animations, not infinite or paused effects", async () => {
    const { panel, prompt, tour, filter, open, openFilters, name } = setup();
    const { complete, getAnimations } = mockEntryAnimation(panel);
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    expect(filter.open).toBe(true);
    expect(tour.open).toBe(false);
    expect(name.scrollIntoView).not.toHaveBeenCalled();
    expect(getAnimations).toHaveBeenCalledExactlyOnceWith();
    open();
    expect(openFilters).toHaveBeenCalledTimes(1);
    complete();
    await waitFor(() => expect(tour.open).toBe(true));
    expect(name.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("starts immediately when reduced motion leaves no entry animations", async () => {
    const { panel, prompt, tour, open } = setup();
    Object.defineProperty(panel, "getAnimations", { value: () => [] });
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    expect(tour.open).toBe(true);
  });

  it.each(["navigation", "filter close", "disposal"])(
    "ignores an entry completion after %s",
    async (exit) => {
      const { panel, prompt, tour, filter, open, unmount, name } = setup();
      const { complete, finished } = mockEntryAnimation(panel);
      open();
      await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
      expect(tour.open).toBe(false);
      if (exit === "navigation") triggerBeforeNavigate({ shallow: false, type: "goto" });
      else if (exit === "filter close") filter.close();
      else unmount();
      complete();
      await finished;
      await tick();
      expect(tour.open).toBe(false);
      expect(name.scrollIntoView).not.toHaveBeenCalled();
    }
  );

  it("handles cancelled entry animations without an unhandled rejection", async () => {
    const { panel, prompt, tour, filter, open } = setup();
    const { cancel } = mockEntryAnimation(panel);
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    cancel();
    await waitFor(() => expect(tour.open).toBe(true));
    expect(filter.open).toBe(true);
  });

  it("does not prompt before filter-open and ignores duplicate opens while asking", async () => {
    const { prompt, tour, filter, open, openFilters } = setup();
    expect(prompt.open).toBe(false);
    expect(readFilterGuideSeen).not.toHaveBeenCalled();
    open();
    open();
    expect(prompt.open).toBe(true);
    expect(filter.open).toBe(false);
    expect(openFilters).not.toHaveBeenCalled();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Use filters" }));
    await waitFor(() => expect(openFilters).toHaveBeenCalledTimes(1));
    expect(filter.open).toBe(true);
    expect(tour.open).toBe(false);
    expect(writeFilterGuideSeen).toHaveBeenCalledExactlyOnceWith("cards");
    filter.close();
    open();
    expect(openFilters).toHaveBeenCalledTimes(2);
    expect(prompt.open).toBe(false);
  });

  it("opens real filters before the accepted tour, scrolls each step and leaves filters open", async () => {
    const { prompt, tour, filter, name, actions, open, openFilters } = setup();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));
    expect(filter.open).toBe(true);
    expect(openFilters).toHaveBeenCalledTimes(1);
    expect(name.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "instant" });
    expect(writeFilterGuideSeen).toHaveBeenCalledExactlyOnceWith("cards");
    await fireEvent.click(within(tour).getByRole("button", { name: "Next" }));
    expect(actions.scrollIntoView).toHaveBeenCalledOnce();
    await fireEvent.click(within(tour).getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(tour.open).toBe(false));
    expect(filter.open).toBe(true);
    filter.close();
    open();
    expect(prompt.open).toBe(false);
    expect(openFilters).toHaveBeenCalledTimes(2);
  });

  it.each(["cancel", "close"])(
    "treats native %s as declining without blocking the filter panel",
    async (event) => {
      const { prompt, tour, filter, open } = setup();
      open();
      if (event === "cancel") await fireEvent(prompt, new Event("cancel", { cancelable: true }));
      else prompt.close();
      await waitFor(() => expect(filter.open).toBe(true));
      expect(tour.open).toBe(false);
      expect(writeFilterGuideSeen).toHaveBeenCalledExactlyOnceWith("cards");
    }
  );

  it("uses the stored catalogue choice without prompting after remount", () => {
    vi.mocked(readFilterGuideSeen).mockReturnValue(true);
    const { prompt, filter, open } = setup();
    open();
    expect(readFilterGuideSeen).toHaveBeenCalledWith("cards");
    expect(prompt.open).toBe(false);
    expect(filter.open).toBe(true);
    expect(writeFilterGuideSeen).not.toHaveBeenCalled();
  });

  it("remembers the choice in-session even when storage cannot persist it", async () => {
    const { prompt, filter, open } = setup();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Use filters" }));
    filter.close();
    open();
    expect(readFilterGuideSeen).toHaveBeenCalledTimes(1);
    expect(prompt.open).toBe(false);
    expect(filter.open).toBe(true);
  });

  it("stops an active tour when its underlying filter closes", async () => {
    const { prompt, tour, filter, open } = setup();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));
    filter.close();
    await waitFor(() => expect(tour.open).toBe(false));
  });

  it("does not open filters after navigation destroys a pending prompt", async () => {
    const { prompt, filter, open, openFilters, unmount } = setup();
    open();
    expect(prompt.open).toBe(true);
    unmount();
    await Promise.resolve();
    expect(openFilters).not.toHaveBeenCalled();
    expect(filter.open).toBe(false);
    expect(writeFilterGuideSeen).not.toHaveBeenCalled();
  });

  it("cancels pending consent on same-component region navigation", async () => {
    const { prompt, filter, open, openFilters } = setup();
    open();
    triggerBeforeNavigate({ shallow: false, type: "goto" });
    await Promise.resolve();
    expect(prompt.open).toBe(false);
    expect(filter.open).toBe(false);
    expect(openFilters).not.toHaveBeenCalled();
    expect(writeFilterGuideSeen).not.toHaveBeenCalled();
  });

  it("closes both guide and filter on navigation during the tour", async () => {
    const { prompt, tour, filter, open } = setup();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));
    triggerBeforeNavigate({ shallow: false, type: "goto" });
    await waitFor(() => expect(tour.open).toBe(false));
    expect(filter.open).toBe(false);
  });

  it("keeps the guide and filter open during a shallow goto navigation", async () => {
    const { prompt, tour, filter, open } = setup();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));

    triggerBeforeNavigate({ shallow: true, type: "goto" });

    expect(prompt.open).toBe(false);
    expect(tour.open).toBe(true);
    expect(filter.open).toBe(true);
  });

  it("does not start a stale accepted tour if navigation occurs while filters open", async () => {
    const { prompt, tour, filter, open, openFilters } = setup();
    openFilters.mockImplementationOnce(() => {
      filter.showModal();
      triggerBeforeNavigate({ shallow: false, type: "goto" });
    });
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    expect(filter.open).toBe(false);
    expect(tour.open).toBe(false);
  });

  it("keeps the guide dismissible when a target is missing", async () => {
    const { prompt, tour, filter, name, open } = setup();
    name.remove();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));
    expect(tour.querySelector(".onboarding-tour-background-fallback")).not.toBeNull();
    await fireEvent.click(
      within(tour.querySelector("aside")!).getByRole("button", { name: "Close" })
    );
    await waitFor(() => expect(tour.open).toBe(false));
    expect(filter.open).toBe(true);
  });

  it("closes a tour only through its close control while leaving its filter dialog usable", async () => {
    const { prompt, tour, filter, open } = setup();
    open();
    await fireEvent.click(within(prompt).getByRole("button", { name: "Show guide" }));
    await waitFor(() => expect(tour.open).toBe(true));
    expect(within(tour).queryByRole("button", { name: "Skip guide" })).toBeNull();
    await fireEvent.click(within(tour).getByRole("button", { name: "Close" }));
    expect(tour.open).toBe(false);
    expect(filter.open).toBe(true);
  });
});
