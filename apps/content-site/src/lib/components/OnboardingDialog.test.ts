import { cleanup, configure, fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingDialog from "./OnboardingDialog.svelte";

// The tour waits on animation frames, which jsdom schedules on timers. Under CPU load
// (turbo runs every package in parallel) the first mount can outlast the default 1 s.
configure({ asyncUtilTimeout: 4000 });

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeEach(() => {
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
  document.querySelectorAll("[data-onboarding-target]").forEach((element) => element.remove());
  vi.unstubAllGlobals();
  if (originalShowModal)
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

const createTour = (
  resolveTarget?: (target: string) => HTMLElement | readonly HTMLElement[] | null
) => {
  const callbacks = {
    onComplete: vi.fn(),
    onClose: vi.fn(),
    onStepChange: vi.fn<(stepIndex: number) => void | Promise<void>>()
  };
  const result = render(OnboardingDialog, {
    open: true,
    title: "Tour",
    progressLabel: "Progress",
    previousLabel: "Previous",
    nextLabel: "Next",
    finishLabel: "Finish",
    closeLabel: "Close",
    steps: ["home", "navigation", "settings", "region", "theme", "language"].map((target) => ({
      icon: "mdi:cog-outline",
      title: target,
      description: `About ${target}`,
      target
    })),
    ...callbacks,
    resolveTarget
  });
  const dialog = result.container.querySelector("dialog")!;
  return { ...result, callbacks, dialog, controls: within(dialog) };
};

const createMeasuredTour = () => {
  const target = document.createElement("input");
  target.type = "checkbox";
  target.dataset.onboardingTarget = "home";
  document.body.append(target);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    return this === target ? new DOMRect(40, 60, 180, 44) : new DOMRect(0, 0, 320, 220);
  });
  return { ...createTour(() => target), target };
};

describe("spotlight onboarding", () => {
  it("advances one step through the accessible highlight without activating the underlying input", async () => {
    const { dialog, controls, callbacks, target } = createMeasuredTour();
    const underlyingClick = vi.fn();
    target.addEventListener("click", underlyingClick);
    await waitFor(() => expect(controls.getByRole("button", { name: "Next: home" })).toBeTruthy());
    const spotlight = controls.getByRole("button", { name: "Next: home" });
    expect(controls.getAllByRole("button", { name: /^Next$/ })).toHaveLength(1);
    await fireEvent.click(spotlight);
    expect(callbacks.onStepChange.mock.calls.map(([index]) => index)).toEqual([0, 1]);
    expect(controls.getByRole("heading").textContent).toBe("navigation");
    expect(underlyingClick).not.toHaveBeenCalled();
    expect(target.checked).toBe(false);
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(controls.getByRole("button", { name: /^Next$/ }));
  });

  it("ignores scrim, background, dialog and coach-description clicks", async () => {
    const { dialog, controls, callbacks, target } = createMeasuredTour();
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const surfaces = [
      dialog,
      dialog.querySelector(".onboarding-tour-background")!,
      ...dialog.querySelectorAll(".onboarding-tour-scrim"),
      dialog.querySelector("aside")!,
      dialog.querySelector("aside p")!
    ];
    for (const surface of surfaces) await fireEvent.click(surface);
    expect(callbacks.onStepChange.mock.calls.map(([index]) => index)).toEqual([0]);
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(controls.queryByRole("button", { name: "Skip" })).toBeNull();
    expect(target.checked).toBe(false);
    expect(dialog.open).toBe(true);
  });

  it("leaves final highlight clicks inert and completes exactly once only through Finish", async () => {
    const { dialog, controls, callbacks } = createMeasuredTour();
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    for (let index = 1; index < 6; index += 1)
      await fireEvent.click(controls.getByRole("button", { name: /^Next$/ }));
    const finalHighlight = dialog.querySelector<HTMLButtonElement>(".onboarding-tour-spotlight")!;
    expect(finalHighlight.disabled).toBe(true);
    await fireEvent.click(finalHighlight);
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
    const finish = controls.getByRole("button", { name: "Finish" });
    await fireEvent.click(finish);
    await fireEvent.click(finish);
    await waitFor(() => expect(dialog.open).toBe(false));
    expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    expect(callbacks.onClose).not.toHaveBeenCalled();
  });

  it("ignores stale highlight clicks throughout asynchronous target preparation", async () => {
    const { dialog, controls, callbacks } = createMeasuredTour();
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const spotlight = dialog.querySelector<HTMLButtonElement>(".onboarding-tour-spotlight")!;
    let ready = () => {};
    callbacks.onStepChange.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          ready = resolve;
        })
    );
    await fireEvent.click(spotlight);
    expect(spotlight.disabled).toBe(true);
    await fireEvent.click(spotlight);
    await fireEvent.click(spotlight);
    expect(callbacks.onStepChange.mock.calls.map(([index]) => index)).toEqual([0, 1]);
    expect(controls.getByRole("heading").textContent).toBe("navigation");
    expect(callbacks.onClose).not.toHaveBeenCalled();
    ready();
    await waitFor(() => expect(spotlight.disabled).toBe(false));
    await fireEvent.click(spotlight);
    expect(callbacks.onStepChange).toHaveBeenLastCalledWith(2);
  });

  it("ignores a moving rectangle until its CSS geometry transition has settled", async () => {
    const { dialog, callbacks } = createMeasuredTour();
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const spotlight = dialog.querySelector<HTMLButtonElement>(".onboarding-tour-spotlight")!;
    let moving = true;
    Object.defineProperty(spotlight, "getAnimations", {
      value: () => (moving ? [{ playState: "running" }] : [])
    });
    await fireEvent.click(spotlight);
    expect(callbacks.onStepChange.mock.calls.map(([index]) => index)).toEqual([0]);
    moving = false;
    await fireEvent.click(spotlight);
    expect(callbacks.onStepChange).toHaveBeenLastCalledWith(1);
  });

  it("blocks Escape and native cancel without dismissing or letting other Escape handlers run", async () => {
    const { dialog, callbacks } = createTour();
    await waitFor(() => expect(dialog.open).toBe(true));
    const lowerEscape = vi.fn();
    document.addEventListener("keydown", lowerEscape);
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    dialog.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(lowerEscape).not.toHaveBeenCalled();
    const cancel = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(callbacks.onClose).not.toHaveBeenCalled();
    document.removeEventListener("keydown", lowerEscape);
  });

  it("does not advance or dismiss on any fallback surface when a target is unavailable", async () => {
    const { dialog, callbacks } = createTour();
    await waitFor(() => expect(dialog.open).toBe(true));
    await fireEvent.click(dialog.querySelector(".onboarding-tour-background-fallback")!);
    await fireEvent.click(dialog.querySelector("aside p")!);
    await fireEvent.click(dialog);
    expect(callbacks.onStepChange.mock.calls.map(([index]) => index)).toEqual([0]);
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });

  it("includes the advance target in the Tab trap and transfers focus to Next on activation", async () => {
    const { dialog, controls } = createMeasuredTour();
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const spotlight = dialog.querySelector<HTMLButtonElement>(".onboarding-tour-spotlight")!;
    const next = controls.getByRole("button", { name: /^Next$/ });
    const close = controls.getByRole("button", { name: "Close" });
    next.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(spotlight);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(close);
    spotlight.focus();
    await fireEvent.click(spotlight, { detail: 0 });
    expect(document.activeElement).toBe(next);
  });

  it.each(["parent-close", "destroy"])(
    "removes keyboard interception after %s without user notification",
    async (mode) => {
      const { dialog, callbacks, rerender, unmount, target } = createMeasuredTour();
      await waitFor(() => expect(dialog.open).toBe(true));
      if (mode === "parent-close") await rerender({ open: false });
      else unmount();
      const escape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true
      });
      const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      document.dispatchEvent(escape);
      document.dispatchEvent(tab);
      expect(escape.defaultPrevented).toBe(false);
      expect(tab.defaultPrevented).toBe(false);
      await fireEvent.click(target);
      expect(target.checked).toBe(true);
      expect(callbacks.onClose).not.toHaveBeenCalled();
    }
  );

  it("keeps focus on the primary button when Next becomes Finish", async () => {
    const { dialog, controls } = createTour();
    const close = within(dialog.querySelector("aside")!).getByRole("button", { name: "Close" });
    await waitFor(() => expect(document.activeElement).toBe(close));
    const primary = controls.getByRole("button", { name: "Next" });
    primary.focus();
    for (let step = 1; step < 6; step += 1) await fireEvent.click(primary);
    expect(controls.getByRole("button", { name: "Finish" })).toBe(primary);
    expect(document.activeElement).toBe(primary);
  });
  it("gives concurrently mounted tours distinct title and description IDs", () => {
    const first = createTour();
    const second = createTour();
    for (const attribute of ["aria-labelledby", "aria-describedby"]) {
      const firstId = first.dialog.getAttribute(attribute)!;
      const secondId = second.dialog.getAttribute(attribute)!;
      expect(firstId).not.toBe(secondId);
      expect(first.dialog.querySelector(`[id="${firstId}"]`)).not.toBeNull();
      expect(second.dialog.querySelector(`[id="${secondId}"]`)).not.toBeNull();
    }
  });
  it("preserves the spotlight and cutout while preparing and moving to the next target", async () => {
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    const target = document.createElement("button");
    target.dataset.onboardingTarget = "home";
    document.body.append(target);
    let rect = new DOMRect(40, 60, 180, 44);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      return this === target ? rect : new DOMRect(0, 0, 320, 220);
    });
    const { dialog, controls, callbacks } = createTour(() => target);
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const spotlight = dialog.querySelector<HTMLElement>(".onboarding-tour-spotlight")!;
    const panels = [...dialog.querySelectorAll<HTMLElement>(".onboarding-tour-scrim")];
    let finishPreparation = () => {};
    callbacks.onStepChange.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishPreparation = resolve))
    );
    await fireEvent.click(controls.getByRole("button", { name: "Next" }));
    expect(dialog.querySelector(".onboarding-tour-spotlight")).toBe(spotlight);
    expect(dialog.querySelector(".onboarding-tour-background-fallback")).toBeNull();
    expect(spotlight.style.left).toBe("32px");

    // Drawer mutations or scroll events during preparation must not measure an unfinished target.
    rect = new DOMRect(500, 300, 240, 100);
    const frames: FrameRequestCallback[] = [];
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    await fireEvent.scroll(window);
    frames.forEach((callback) => callback(0));
    expect(spotlight.style.left).toBe("32px");
    requestFrame.mockRestore();
    finishPreparation();

    await waitFor(() => expect(spotlight.style.left).toBe("492px"));
    expect(dialog.querySelector(".onboarding-tour-spotlight")).toBe(spotlight);
    dialog.querySelectorAll(".onboarding-tour-scrim").forEach((panel, index) => {
      expect(panel).toBe(panels[index]);
    });
    expect(spotlight.style.top).toBe("292px");
    expect(spotlight.style.width).toBe("256px");
    expect(spotlight.style.height).toBe("116px");
    expect(panels[0]!.style.height).toBe(spotlight.style.top);
    expect(panels[1]!.style.top).toBe("408px");
    expect(panels[2]!.style.width).toBe(spotlight.style.left);
    expect(panels[2]!.style.height).toBe(spotlight.style.height);
    expect(panels[3]!.style.left).toBe("748px");
    expect(panels[3]!.style.height).toBe(spotlight.style.height);
  });

  it("clears old geometry for missing targets and mounts a fresh spotlight on reopening", async () => {
    const target = document.createElement("button");
    target.dataset.onboardingTarget = "home";
    document.body.append(target);
    let rect = new DOMRect(40, 60, 180, 44);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      return this === target ? rect : new DOMRect(0, 0, 320, 220);
    });
    const { dialog, controls, callbacks, rerender } = createTour((name) =>
      name === "home" ? target : null
    );
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    await fireEvent.click(controls.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).toBeNull());
    expect(dialog.querySelectorAll(".onboarding-tour-scrim")).toHaveLength(0);
    expect(dialog.querySelector(".onboarding-tour-background-fallback")).not.toBeNull();
    await fireEvent.click(controls.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const previousSpotlight = dialog.querySelector(".onboarding-tour-spotlight");
    dialog.close();
    await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledTimes(1));
    expect(dialog.querySelector(".onboarding-tour-spotlight")).toBeNull();
    rect = new DOMRect(200, 140, 44, 44);
    await rerender({ open: false });
    await rerender({ open: true });
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const reopenedSpotlight = dialog.querySelector<HTMLElement>(".onboarding-tour-spotlight")!;
    expect(reopenedSpotlight).not.toBe(previousSpotlight);
    expect(reopenedSpotlight.style.left).toBe("192px");
    expect(reopenedSpotlight.style.top).toBe("132px");
  });

  it.each([390, 1440])("positions beside a real control within a %spx viewport", async (width) => {
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("innerHeight", 844);
    const target = document.createElement("button");
    target.dataset.onboardingTarget = "home";
    document.body.append(target);
    const targetRect = new DOMRect(width - 72, 32, 44, 44);
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      targetRect
    ] as unknown as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      return this === target ? targetRect : new DOMRect(0, 0, 320, 220);
    });
    const { dialog } = createTour();
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const spotlight = dialog.querySelector<HTMLElement>(".onboarding-tour-spotlight")!;
    const coach = dialog.querySelector<HTMLElement>(".onboarding-tour-coach")!;
    expect(parseFloat(spotlight.style.left)).toBe(width - 80);
    expect(parseFloat(spotlight.style.top)).toBe(24);
    expect(parseFloat(coach.style.left)).toBeGreaterThanOrEqual(12);
    expect(parseFloat(coach.style.left) + parseFloat(coach.style.width)).toBeLessThanOrEqual(
      width - 12
    );
    expect(parseFloat(coach.style.top) + 220).toBeLessThanOrEqual(832);
    expect(dialog.querySelectorAll(".onboarding-tour-scrim")).toHaveLength(4);
  });

  it("prepares each real target, supports Previous, and resets on manual reopening", async () => {
    const { controls, callbacks, rerender, dialog } = createTour();
    await waitFor(() => expect(callbacks.onStepChange).toHaveBeenLastCalledWith(0));
    for (let index = 1; index < 6; index += 1) {
      await fireEvent.click(controls.getByRole("button", { name: "Next" }));
      expect(callbacks.onStepChange).toHaveBeenLastCalledWith(index);
    }
    await fireEvent.click(controls.getByRole("button", { name: "Previous" }));
    expect(callbacks.onStepChange).toHaveBeenLastCalledWith(4);
    await fireEvent.click(controls.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledTimes(1));
    expect(dialog.open).toBe(false);
    await rerender({ open: false });
    await rerender({ open: true });
    await waitFor(() => expect(callbacks.onStepChange).toHaveBeenLastCalledWith(0));
    expect(controls.getByRole("heading").textContent).toBe("home");
  });

  it.each(["close", "native-close", "complete"])(
    "closes through %s without double notification or reopening",
    async (mode) => {
      const { controls, callbacks, dialog } = createTour();
      await waitFor(() => expect(dialog.open).toBe(true));
      if (mode === "complete") {
        for (let index = 1; index < 6; index += 1) {
          await fireEvent.click(controls.getByRole("button", { name: "Next" }));
        }
        await fireEvent.click(controls.getByRole("button", { name: "Finish" }));
      } else if (mode === "native-close") {
        // A programmatic parent cleanup can still close the native dialog.
        dialog.close();
      } else {
        const close = controls.getByRole("button", { name: "Close" });
        await fireEvent.click(close);
        await fireEvent.click(close);
      }
      const expected = mode === "complete" ? callbacks.onComplete : callbacks.onClose;
      await waitFor(() => expect(expected).toHaveBeenCalledTimes(1));
      expect(dialog.open).toBe(false);
      expect(callbacks.onClose).toHaveBeenCalledTimes(mode === "complete" ? 0 : 1);
    }
  );

  it("uses a closable fallback, never a fabricated highlight, for missing targets", async () => {
    const { dialog, controls } = createTour();
    await waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.querySelector(".onboarding-tour-spotlight")).toBeNull();
    expect(dialog.querySelector(".onboarding-tour-coach-fallback")).not.toBeNull();
    expect(controls.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  it("resolves real shell links without adding onboarding attributes to them", async () => {
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    const link = document.createElement("a");
    link.href = "/";
    document.body.append(link);
    const rect = new DOMRect(20, 96, 220, 44);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      return this === link ? rect : new DOMRect(0, 0, 320, 220);
    });
    const resolver = vi.fn(() => link);
    const { dialog, controls } = createTour(resolver);
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    expect(resolver).toHaveBeenCalledWith("home");
    expect(dialog.querySelector<HTMLElement>(".onboarding-tour-spotlight")!.style.top).toBe("88px");
    await fireEvent.click(controls.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(resolver).toHaveBeenCalledWith("navigation"));
    expect(link.hasAttribute("data-onboarding-target")).toBe(false);
    link.remove();
  });

  it("highlights the visible union of a grouped target", async () => {
    vi.stubGlobal("innerWidth", 600);
    vi.stubGlobal("innerHeight", 400);
    const first = document.createElement("li");
    const second = document.createElement("li");
    document.body.append(first, second);
    const firstRect = new DOMRect(40, 60, 180, 44);
    const secondRect = new DOMRect(40, 160, 220, 44);
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
      this: HTMLElement
    ) {
      return (this === first
        ? [firstRect]
        : this === second
          ? [secondRect]
          : [new DOMRect(0, 0, 320, 220)]) as unknown as DOMRectList;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      return this === first
        ? firstRect
        : this === second
          ? secondRect
          : new DOMRect(0, 0, 320, 220);
    });

    const { dialog } = createTour(() => [first, second]);
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const spotlight = dialog.querySelector<HTMLElement>(".onboarding-tour-spotlight")!;
    expect(spotlight.style.left).toBe("32px");
    expect(spotlight.style.top).toBe("52px");
    expect(spotlight.style.width).toBe("236px");
    expect(spotlight.style.height).toBe("160px");
    first.remove();
    second.remove();
  });

  it("clips grouped targets to their visible scroll container", async () => {
    vi.stubGlobal("innerWidth", 600);
    vi.stubGlobal("innerHeight", 400);
    const scroller = document.createElement("div");
    const target = document.createElement("li");
    scroller.style.overflowY = "hidden";
    scroller.append(target);
    document.body.append(scroller);
    const scrollerRect = new DOMRect(20, 80, 260, 120);
    const targetRect = new DOMRect(0, 60, 180, 80);
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      targetRect
    ] as unknown as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      return this === scroller
        ? scrollerRect
        : this === target
          ? targetRect
          : new DOMRect(0, 0, 320, 220);
    });
    const originalGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudoElement) => {
      const style = originalGetComputedStyle(element, pseudoElement);
      if (element === scroller) {
        Object.defineProperty(style, "overflowY", { configurable: true, value: "hidden" });
      }
      return style;
    });
    const { dialog } = createTour(() => target);
    await waitFor(() => expect(dialog.querySelector(".onboarding-tour-spotlight")).not.toBeNull());
    const spotlight = dialog.querySelector<HTMLElement>(".onboarding-tour-spotlight")!;
    expect(spotlight.style.left).toBe("4px");
    expect(spotlight.style.top).toBe("72px");
    expect(spotlight.style.width).toBe("184px");
    expect(spotlight.style.height).toBe("76px");
    scroller.remove();
  });

  it("restores focus without scrolling away from the restored page position", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const focus = vi.spyOn(trigger, "focus");
    vi.spyOn(trigger, "getClientRects").mockReturnValue([
      new DOMRect(0, 0, 44, 44)
    ] as unknown as DOMRectList);
    const { dialog, callbacks } = createTour();
    await waitFor(() => expect(dialog.open).toBe(true));
    dialog.close();
    await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
    trigger.remove();
  });

  it("cycles Tab within the visible coach controls in DOM order", async () => {
    const { dialog, controls } = createTour();
    await waitFor(() => expect(dialog.open).toBe(true));
    const coach = dialog.querySelector<HTMLElement>(".onboarding-tour-coach")!;
    const close = within(coach).getByRole("button", { name: "Close" });
    const next = within(coach).getByRole("button", { name: "Next" });
    const disabled = document.createElement("button");
    disabled.textContent = "Disabled";
    disabled.disabled = true;
    const hidden = document.createElement("button");
    hidden.textContent = "Hidden";
    hidden.hidden = true;
    close.after(disabled, hidden);

    next.focus();
    const forward = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);

    close.focus();
    const backward = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(backward);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(next);

    close.focus();
    const skipsDisabled = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(skipsDisabled);
    expect(document.activeElement).toBe(next);
    expect(document.activeElement).not.toBe(disabled);
    expect(document.activeElement).not.toBe(hidden);
    expect(controls.getByRole("button", { name: "Next" })).toBe(next);
  });

  it.each([
    [false, "Close"],
    [true, "Next"]
  ])("recaptures focus from outside the coach with shiftKey=%s", async (shiftKey, expected) => {
    const { dialog } = createTour();
    await waitFor(() => expect(dialog.open).toBe(true));
    const coach = dialog.querySelector<HTMLElement>(".onboarding-tour-coach")!;
    document.body.tabIndex = -1;
    document.body.focus();
    expect(document.activeElement).toBe(document.body);

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(within(coach).getByRole("button", { name: expected }));
    document.body.removeAttribute("tabindex");
  });

  it("removes the document Tab handler when the tour closes", async () => {
    const { dialog, callbacks } = createTour();
    await waitFor(() => expect(dialog.open).toBe(true));
    dialog.close();
    await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledTimes(1));

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
