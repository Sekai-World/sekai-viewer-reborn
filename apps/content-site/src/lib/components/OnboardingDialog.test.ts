import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingDialog from "./OnboardingDialog.svelte";

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
    onSkip: vi.fn(),
    onClose: vi.fn(),
    onStepChange: vi.fn()
  };
  const result = render(OnboardingDialog, {
    open: true,
    title: "Tour",
    progressLabel: "Progress",
    previousLabel: "Previous",
    nextLabel: "Next",
    finishLabel: "Finish",
    skipLabel: "Skip",
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

describe("spotlight onboarding", () => {
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
    await fireEvent.click(controls.getAllByRole("button", { name: "Close" })[1]!);
    await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledTimes(1));
    expect(dialog.open).toBe(false);
    await rerender({ open: false });
    await rerender({ open: true });
    await waitFor(() => expect(callbacks.onStepChange).toHaveBeenLastCalledWith(0));
    expect(controls.getByRole("heading").textContent).toBe("home");
  });

  it.each(["close", "backdrop", "native-close", "skip", "complete"])(
    "closes through %s without double notification or reopening",
    async (mode) => {
      const { controls, callbacks, dialog } = createTour();
      await waitFor(() => expect(dialog.open).toBe(true));
      if (mode === "complete") {
        for (let index = 1; index < 6; index += 1) {
          await fireEvent.click(controls.getByRole("button", { name: "Next" }));
        }
        await fireEvent.click(controls.getByRole("button", { name: "Finish" }));
      } else if (mode === "skip") {
        await fireEvent.click(controls.getByRole("button", { name: "Skip" }));
      } else if (mode === "native-close") {
        // The browser's Escape action closes the native dialog and emits close.
        dialog.close();
      } else {
        const buttons = controls.getAllByRole("button", { name: "Close" });
        await fireEvent.click(buttons[mode === "backdrop" ? 0 : 1]!);
      }
      const expected =
        mode === "skip"
          ? callbacks.onSkip
          : mode === "complete"
            ? callbacks.onComplete
            : callbacks.onClose;
      await waitFor(() => expect(expected).toHaveBeenCalledTimes(1));
      expect(dialog.open).toBe(false);
      expect(callbacks.onClose).toHaveBeenCalledTimes(
        mode === "skip" || mode === "complete" ? 0 : 1
      );
    }
  );

  it("uses a closable fallback, never a fabricated highlight, for missing targets", async () => {
    const { dialog, controls } = createTour();
    await waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.querySelector(".onboarding-tour-spotlight")).toBeNull();
    expect(dialog.querySelector(".onboarding-tour-coach-fallback")).not.toBeNull();
    expect(controls.getAllByRole("button", { name: "Close" })).toHaveLength(2);
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
    const skip = within(coach).getByRole("button", { name: "Skip" });
    const next = within(coach).getByRole("button", { name: "Next" });
    const disabled = document.createElement("button");
    disabled.textContent = "Disabled";
    disabled.disabled = true;
    const hidden = document.createElement("button");
    hidden.textContent = "Hidden";
    hidden.hidden = true;
    skip.after(disabled, hidden);

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

    skip.focus();
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
