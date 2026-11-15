import { render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NAVIGATION_PROGRESS_ANNOUNCE_DELAY_MS,
  NAVIGATION_PROGRESS_DIM_DELAY_MS,
  NAVIGATION_PROGRESS_FINISH_MS,
  NAVIGATION_PROGRESS_MIN_VISIBLE_MS,
  NAVIGATION_PROGRESS_SHOW_DELAY_MS
} from "./navigation-progress.svelte";
import ViewerShell from "./viewer-shell.svelte";

const renderShell = async (navigating: boolean) => {
  const view = render(ViewerShell, {
    drawerId: "test-drawer",
    navTitle: "Test Nav",
    navigationLoadingLabel: "Loading page",
    navigating
  });
  const setNavigating = async (value: boolean) => {
    await view.rerender({ navigating: value });
    flushSync();
  };
  const advance = (ms: number) => {
    vi.advanceTimersByTime(ms);
    flushSync();
  };
  const phase = () =>
    view.container.ownerDocument.querySelector(".navigation-progress")?.getAttribute("data-phase");
  const main = () => screen.getByRole("main");
  const announcement = () =>
    screen.getAllByRole("status").find((element) => element.classList.contains("sr-only"))
      ?.textContent;
  return { setNavigating, advance, phase, main, announcement };
};

describe("ViewerShell navigation feedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays idle and leaves main untouched when nothing is navigating", async () => {
    const { advance, phase, main, announcement } = await renderShell(false);

    advance(NAVIGATION_PROGRESS_ANNOUNCE_DELAY_MS);

    expect(phase()).toBe("idle");
    expect(main().hasAttribute("aria-busy")).toBe(false);
    expect(main().classList.contains("viewer-shell-main-pending")).toBe(false);
    expect(announcement()).toBe("");
  });

  it("shows the bar only after the show delay", async () => {
    const { setNavigating, advance, phase, main } = await renderShell(false);
    await setNavigating(true);

    advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS - 1);
    expect(phase()).toBe("idle");
    expect(main().hasAttribute("aria-busy")).toBe(false);

    advance(1);
    expect(phase()).toBe("loading");
    expect(main().getAttribute("aria-busy")).toBe("true");
  });

  it("shows nothing for a navigation that settles before the show delay", async () => {
    const { setNavigating, advance, phase } = await renderShell(false);
    await setNavigating(true);
    advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS - 1);

    await setNavigating(false);
    advance(NAVIGATION_PROGRESS_ANNOUNCE_DELAY_MS);

    expect(phase()).toBe("idle");
  });

  it("dims the outgoing content and announces only on longer waits", async () => {
    const { setNavigating, advance, main, announcement } = await renderShell(false);
    await setNavigating(true);

    advance(NAVIGATION_PROGRESS_DIM_DELAY_MS - 1);
    expect(main().classList.contains("viewer-shell-main-pending")).toBe(false);
    advance(1);
    expect(main().classList.contains("viewer-shell-main-pending")).toBe(true);
    expect(announcement()).toBe("");

    advance(NAVIGATION_PROGRESS_ANNOUNCE_DELAY_MS - NAVIGATION_PROGRESS_DIM_DELAY_MS);
    expect(announcement()).toBe("Loading page");
  });

  it("keeps the bar for a minimum time, then finishes and returns to idle", async () => {
    const { setNavigating, advance, phase, main, announcement } = await renderShell(false);
    await setNavigating(true);
    advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS);

    await setNavigating(false);
    expect(phase()).toBe("loading");
    expect(main().hasAttribute("aria-busy")).toBe(false);
    expect(main().classList.contains("viewer-shell-main-pending")).toBe(false);
    expect(announcement()).toBe("");

    advance(NAVIGATION_PROGRESS_MIN_VISIBLE_MS);
    expect(phase()).toBe("done");

    advance(NAVIGATION_PROGRESS_FINISH_MS);
    expect(phase()).toBe("idle");
  });

  it("keeps showing the bar when a new navigation starts before it settles", async () => {
    const { setNavigating, advance, phase, main } = await renderShell(false);
    await setNavigating(true);
    advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
    await setNavigating(false);

    await setNavigating(true);
    expect(phase()).toBe("loading");
    expect(main().getAttribute("aria-busy")).toBe("true");

    advance(NAVIGATION_PROGRESS_MIN_VISIBLE_MS + NAVIGATION_PROGRESS_FINISH_MS);
    expect(phase()).toBe("loading");
  });

  it("restarts from idle when a navigation starts during the finishing fade", async () => {
    const { setNavigating, advance, phase } = await renderShell(false);
    await setNavigating(true);
    advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS);
    await setNavigating(false);
    advance(NAVIGATION_PROGRESS_MIN_VISIBLE_MS);
    expect(phase()).toBe("done");

    await setNavigating(true);
    expect(phase()).toBe("idle");

    advance(NAVIGATION_PROGRESS_FINISH_MS);
    expect(phase()).toBe("loading");
  });

  it("finishes at once when the bar has already been visible long enough", async () => {
    const { setNavigating, advance, phase } = await renderShell(false);
    await setNavigating(true);
    advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS + NAVIGATION_PROGRESS_MIN_VISIBLE_MS);

    await setNavigating(false);
    advance(0);

    expect(phase()).toBe("done");
  });

  it("hides the bar from assistive technology while it is showing", async () => {
    const { advance, phase } = await renderShell(true);
    advance(NAVIGATION_PROGRESS_SHOW_DELAY_MS);

    expect(phase()).toBe("loading");
    expect(document.querySelector(".navigation-progress")?.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });
});
