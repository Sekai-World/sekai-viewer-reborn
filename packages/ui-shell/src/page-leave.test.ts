import { render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_LEAVE_RESET_MS, type PageLeaveNavigation } from "./page-leave.svelte";
import PageLeaveHost from "./test-fixtures/page-leave-host.svelte";

const renderHost = () => {
  let callback: ((navigation: PageLeaveNavigation) => void) | undefined;
  const view = render(PageLeaveHost, {
    beforeNavigate: (registered: (navigation: PageLeaveNavigation) => void) => {
      callback = registered;
    }
  });
  const navigate = (navigation: Partial<PageLeaveNavigation>) => {
    callback?.({
      type: "link",
      willUnload: true,
      to: { url: new URL("https://tools.example.test/tracker") },
      ...navigation
    });
    flushSync();
  };
  return { ...view, navigate, state: () => screen.getByRole("status").textContent };
};

describe("trackPageLeave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a link navigation that unloads the document", () => {
    const { navigate, state } = renderHost();
    expect(state()).toBe("idle");

    navigate({});

    expect(state()).toBe("leaving");
  });

  it("ignores client-side navigations, tab closes, and non-http links", () => {
    const { navigate, state } = renderHost();

    navigate({ willUnload: false });
    navigate({ type: "leave", to: null });
    navigate({ to: { url: new URL("mailto:someone@example.test") } });

    expect(state()).toBe("idle");
  });

  it("clears when the page is restored from the back/forward cache", () => {
    const { navigate, state } = renderHost();
    navigate({});

    window.dispatchEvent(new Event("pageshow"));
    flushSync();

    expect(state()).toBe("idle");
  });

  it("clears on its own when the page never unloads", () => {
    const { navigate, state } = renderHost();
    navigate({});

    vi.advanceTimersByTime(PAGE_LEAVE_RESET_MS - 1);
    flushSync();
    expect(state()).toBe("leaving");

    vi.advanceTimersByTime(1);
    flushSync();
    expect(state()).toBe("idle");
  });

  it("clears when another callback cancels the navigation", async () => {
    const { navigate, state } = renderHost();
    const event = new Event("click", { cancelable: true });

    navigate({ event });
    event.preventDefault();
    await Promise.resolve();
    flushSync();

    expect(state()).toBe("idle");
  });

  it("restarts the reset timer on a second leave", () => {
    const { navigate, state } = renderHost();
    navigate({});
    vi.advanceTimersByTime(PAGE_LEAVE_RESET_MS - 1);

    navigate({});
    vi.advanceTimersByTime(PAGE_LEAVE_RESET_MS - 1);
    flushSync();

    expect(state()).toBe("leaving");
  });

  it("stops listening once the host is destroyed", () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHost();

    unmount();

    expect(removeListener).toHaveBeenCalledWith("pageshow", expect.any(Function));
    removeListener.mockRestore();
  });
});
