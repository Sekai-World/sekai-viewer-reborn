// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import Live2dModelStudio from "./Live2dModelStudio.svelte";

const motions = ["Idle", "WalkForward", "Talk"];
const expressions = ["Neutral", "Happy", "Surprised"];

const labels = {
  controlsTitle: "Controls",
  motion: "Motion",
  motionEmpty: "Choose a motion",
  expression: "Expression",
  expressionEmpty: "Choose an expression",
  noneLoaded: "None loaded",
  apply: "Apply",
  pause: "Pause",
  resume: "Resume",
  idleBreath: "Idle breath",
  reload: "Reload",
  reset: "Reset",
  controlsHint: "Controls unavailable"
};

afterEach(() => {
  cleanup();
});

function renderStudio(
  callbacks: { onApplyMotion?: () => void; onApplyExpression?: () => void } = {}
) {
  const onApplyMotion = callbacks.onApplyMotion ?? vi.fn();
  const onApplyExpression = callbacks.onApplyExpression ?? vi.fn();

  return {
    ...render(Live2dModelStudio, {
      labels,
      controlsEnabled: true,
      motions,
      expressions,
      selectedMotion: "",
      selectedExpression: "",
      onApplyMotion,
      onApplyExpression
    }),
    onApplyMotion,
    onApplyExpression
  };
}

function getCombobox(name: string): HTMLInputElement {
  const input = screen.getByRole("combobox", { name });
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Expected ${name} to be an input combobox`);
  }

  return input;
}

function getApplyButton(index: number): HTMLButtonElement {
  const button = screen.getAllByRole("button", { name: labels.apply })[index];
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Expected an Apply button");
  }

  return button;
}

function getClearButton(label: string): HTMLButtonElement {
  const button = screen.getByRole("button", { name: `${label} ${labels.reset}` });
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${label} clear button`);
  }

  return button;
}

function getOptionNames(listboxName: string): string[] {
  return within(screen.getByRole("listbox", { name: listboxName }))
    .getAllByRole("option")
    .map((option) => option.textContent?.trim() ?? "");
}

function getPlaybackButton(): HTMLButtonElement {
  const button = screen.getByRole("button", { name: /^(Pause|Resume)$/ });
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Expected the playback toggle button");
  }

  return button;
}

describe("Live2dModelStudio selectors", () => {
  it("opens the complete motion and expression lists from empty fields", async () => {
    renderStudio();

    await fireEvent.focus(getCombobox(labels.motion));
    expect(getOptionNames(labels.motion)).toEqual(motions);

    await fireEvent.click(getCombobox(labels.expression));
    expect(getOptionNames(labels.expression)).toEqual(expressions);
  });

  it("filters motions case-insensitively and validates the Apply action", async () => {
    const onApplyMotion = vi.fn();
    renderStudio({ onApplyMotion });
    const motion = getCombobox(labels.motion);
    const applyMotion = getApplyButton(0);

    await fireEvent.focus(motion);
    await fireEvent.input(motion, { target: { value: "wAlK" } });
    expect(getOptionNames(labels.motion)).toEqual(["WalkForward"]);

    await fireEvent.input(motion, { target: { value: "not-a-motion" } });
    expect(applyMotion.disabled).toBe(true);

    await fireEvent.input(motion, { target: { value: "WalkForward" } });
    expect(applyMotion.disabled).toBe(false);

    await fireEvent.click(screen.getByRole("button", { name: "WalkForward" }));
    expect(motion.value).toBe("WalkForward");
    expect(screen.queryByRole("listbox", { name: labels.motion })).toBeNull();

    await fireEvent.click(applyMotion);
    expect(onApplyMotion).toHaveBeenCalledOnce();
  });

  it("filters expressions case-insensitively, selects an option, and invokes Apply", async () => {
    const onApplyExpression = vi.fn();
    render(Live2dModelStudio, {
      labels,
      controlsEnabled: true,
      motions,
      expressions,
      selectedMotion: "",
      selectedExpression: "",
      onApplyExpression
    });

    const expression = getCombobox(labels.expression);
    const applyExpression = getApplyButton(1);

    await fireEvent.click(expression);
    await fireEvent.input(expression, { target: { value: "hAp" } });
    expect(getOptionNames(labels.expression)).toEqual(["Happy"]);

    await fireEvent.input(expression, { target: { value: "not-an-expression" } });
    expect(applyExpression.disabled).toBe(true);

    await fireEvent.input(expression, { target: { value: "Happy" } });
    expect(applyExpression.disabled).toBe(false);

    await fireEvent.click(screen.getByRole("button", { name: "Happy" }));
    expect(expression.value).toBe("Happy");
    expect(screen.queryByRole("listbox", { name: labels.expression })).toBeNull();

    await fireEvent.click(applyExpression);
    expect(onApplyExpression).toHaveBeenCalledOnce();
  });

  it("clears motion text, keeps its list open, and refocuses the motion input", async () => {
    renderStudio();

    const motion = getCombobox(labels.motion);
    await fireEvent.input(motion, { target: { value: "Walk" } });
    expect(getOptionNames(labels.motion)).toEqual(["WalkForward"]);
    expect(getClearButton(labels.motion).disabled).toBe(false);

    await fireEvent.click(getClearButton(labels.motion));

    expect(motion.value).toBe("");
    expect(document.activeElement).toBe(motion);
    expect(getOptionNames(labels.motion)).toEqual(motions);
    expect(
      screen.queryByRole("button", { name: `${labels.expression} ${labels.reset}` })
    ).toBeNull();
  });

  it("clears expression text independently and hides both clear buttons when empty", async () => {
    renderStudio();

    const motion = getCombobox(labels.motion);
    const expression = getCombobox(labels.expression);
    await fireEvent.input(motion, { target: { value: "Idle" } });
    await fireEvent.input(expression, { target: { value: "Happy" } });

    expect(getClearButton(labels.motion)).toBeTruthy();
    expect(getClearButton(labels.expression)).toBeTruthy();

    await fireEvent.click(getClearButton(labels.expression));

    expect(expression.value).toBe("");
    expect(document.activeElement).toBe(expression);
    expect(getOptionNames(labels.expression)).toEqual(expressions);
    expect(motion.value).toBe("Idle");
    expect(getClearButton(labels.motion)).toBeTruthy();

    await fireEvent.click(getClearButton(labels.motion));
    expect(motion.value).toBe("");
    expect(screen.queryByRole("button", { name: `${labels.motion} ${labels.reset}` })).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${labels.expression} ${labels.reset}` })
    ).toBeNull();
  });

  it("does not render clear buttons while controls are disabled", async () => {
    render(Live2dModelStudio, {
      labels,
      controlsEnabled: false,
      motions,
      expressions,
      selectedMotion: "Idle",
      selectedExpression: "Neutral"
    });

    expect(screen.queryByRole("button", { name: `${labels.motion} ${labels.reset}` })).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${labels.expression} ${labels.reset}` })
    ).toBeNull();
  });

  it("shows pause first and invokes the pause callback", async () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    render(Live2dModelStudio, {
      labels,
      controlsEnabled: true,
      onPause,
      onResume
    });

    const playbackButton = getPlaybackButton();
    expect(playbackButton.textContent).toContain(labels.pause);
    expect(playbackButton.getAttribute("data-playback-icon")).toBe("pause");

    await fireEvent.click(playbackButton);

    expect(onPause).toHaveBeenCalledOnce();
    expect(onResume).not.toHaveBeenCalled();
  });

  it("shows resume and invokes the resume callback while paused", async () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    render(Live2dModelStudio, {
      labels,
      controlsEnabled: true,
      paused: true,
      onPause,
      onResume
    });

    const playbackButton = getPlaybackButton();
    expect(playbackButton.textContent).toContain(labels.resume);
    expect(playbackButton.getAttribute("aria-pressed")).toBe("true");
    expect(playbackButton.getAttribute("data-playback-icon")).toBe("play");

    await fireEvent.click(playbackButton);

    expect(onResume).toHaveBeenCalledOnce();
    expect(onPause).not.toHaveBeenCalled();
  });

  it("keeps the playback toggle disabled until controls are enabled", () => {
    render(Live2dModelStudio, {
      labels,
      controlsEnabled: false,
      onPause: vi.fn(),
      onResume: vi.fn()
    });

    expect(getPlaybackButton().disabled).toBe(true);
  });
});
