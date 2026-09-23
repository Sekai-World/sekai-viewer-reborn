import { fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VoicePlayButton from "./voice-play-button.svelte";

const circumference = 2 * Math.PI * 25;

const getAudioElement = (container: HTMLElement): HTMLAudioElement => {
  const element = container.querySelector("audio");
  if (!element) {
    throw new Error("Expected the component to render an audio element.");
  }
  return element;
};

const getProgressCircle = (container: HTMLElement): SVGCircleElement => {
  const element = container.querySelector<SVGCircleElement>("svg circle[stroke-dasharray]");
  if (!element) {
    throw new Error("Expected the component to render a progress ring.");
  }
  return element;
};

describe("VoicePlayButton", () => {
  let playSpy: ReturnType<typeof vi.spyOn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays the first source, tracks ring progress, and stops on toggle", async () => {
    const { container, getByRole, unmount } = render(VoicePlayButton, {
      sources: ["/a.mp3"],
      playLabel: "Play",
      stopLabel: "Stop"
    });

    await fireEvent.click(getByRole("button", { name: "Play" }));
    expect(getAudioElement(container).getAttribute("src")).toBe("/a.mp3");
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(getByRole("button", { name: "Stop" })).toBeTruthy();

    const audioElement = getAudioElement(container);
    Object.defineProperty(audioElement, "duration", {
      configurable: true,
      writable: true,
      value: 10
    });
    Object.defineProperty(audioElement, "currentTime", {
      configurable: true,
      writable: true,
      value: 2.5
    });
    await fireEvent(audioElement, new Event("timeupdate"));
    expect(Number(getProgressCircle(container).getAttribute("stroke-dashoffset"))).toBeCloseTo(
      circumference * 0.75
    );

    await fireEvent.click(getByRole("button", { name: "Stop" }));
    expect(pauseSpy).toHaveBeenCalled();
    expect(getByRole("button", { name: "Play" })).toBeTruthy();
    unmount();
  });

  it("advances to the fallback source on error and reports unavailable when exhausted", async () => {
    const { container, getByRole, unmount } = render(VoicePlayButton, {
      sources: ["/a.mp3", "/b.mp3"],
      playLabel: "Play",
      errorLabel: "Voice unavailable"
    });

    await fireEvent.click(getByRole("button", { name: "Play" }));
    await fireEvent(getAudioElement(container), new Event("error"));
    expect(getAudioElement(container).getAttribute("src")).toBe("/b.mp3");
    expect(playSpy).toHaveBeenCalledTimes(2);

    await fireEvent(getAudioElement(container), new Event("error"));
    const button = getByRole("button", { name: "Voice unavailable" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    unmount();
  });

  it("recovers when the sources prop changes after being unavailable", async () => {
    const { container, getByRole, rerender, unmount } = render(VoicePlayButton, {
      sources: ["/missing.mp3"],
      playLabel: "Play",
      errorLabel: "Voice unavailable"
    });

    await fireEvent.click(getByRole("button", { name: "Play" }));
    await fireEvent(getAudioElement(container), new Event("error"));
    expect(getByRole("button", { name: "Voice unavailable" }).hasAttribute("disabled")).toBe(true);

    await rerender({ sources: ["/fixed.mp3"], playLabel: "Play", errorLabel: "Voice unavailable" });
    expect(getByRole("button", { name: "Play" }).hasAttribute("disabled")).toBe(false);
    unmount();
  });
});
