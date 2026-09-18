// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StoryTextRows from "./StoryTextRows.svelte";
import type { StoryTextRowView } from "./StoryTextRows.svelte";

const labels = {
  voicePlay: "Play voice",
  voiceStop: "Stop",
  voiceUnavailable: "Voice unavailable",
  backgroundLabel: "Background change",
  showBackground: "Show background",
  bgmLabel: "BGM",
  seLabel: "Sound effect",
  seStopLabel: "Stop sound effect",
  fullscreenLabel: "Full-screen text",
  movieLabel: "Watch the movie scene",
  previewClose: "Close",
  previewDownload: "Download image",
  previewOpenInNewWindow: "Open in new window",
  audioPlay: "Play",
  audioPause: "Pause",
  audioDownload: "Download audio",
  audioDownloadClose: "Close download",
  audioVolume: "Volume",
  audioSeek: "Seek",
  audioUnavailable: "Audio unavailable",
  audioDownloadPreparing: "Preparing…",
  audioDownloadFetchingAudio: "Fetching audio…",
  audioDownloadFetchingCover: "Fetching cover…",
  audioDownloadWritingMetadata: "Writing metadata…",
  audioDownloadFinalizing: "Finalizing…",
  audioDownloadReady: "Ready",
  audioDownloadFailed: "Failed",
  audioDownloadCancelled: "Cancelled"
};

const rows: StoryTextRowView[] = [
  { kind: "background", name: "Street", imageUrl: "/storage/bg.webp" },
  { kind: "bgm", name: "Cheerful Theme", url: "/storage/bgm.mp3" },
  {
    kind: "talk",
    name: "花里みのり",
    body: "こんにちは！",
    characterId: 5,
    voiceUrls: ["/storage/voice.mp3", "/storage/partvoice.mp3"]
  },
  { kind: "se", stop: true },
  { kind: "fullscreen-text", text: "To the stage!", voiceUrls: ["/storage/fs.mp3"] }
];

const getAudioElement = (container: HTMLElement): HTMLAudioElement => {
  const element = container.querySelector("audio");
  if (!element) {
    throw new Error("Expected a voice button to render an audio element.");
  }
  return element;
};

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockReturnValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StoryTextRows", () => {
  it("renders the talk line with a ring voice toggle that plays the first source", async () => {
    const { container } = render(StoryTextRows, { rows: [rows[2]], labels });

    const badge = container.querySelector("span.badge");
    expect(badge?.querySelector("img")?.getAttribute("src")).toBe("/chr_ts/chr_ts_5_g1.png");

    await fireEvent.click(screen.getByRole("button", { name: "Play voice" }));

    expect(getAudioElement(container).getAttribute("src")).toBe("/storage/voice.mp3");
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: "Play voice" })).toBeTruthy();
  });

  it("omits the avatar for ids without a local bust", () => {
    const { container } = render(
      StoryTextRows,
      { rows: [{ ...rows[2], characterId: 50 }], labels }
    );
    expect(container.querySelector("span.badge img")).toBeNull();
  });

  it("falls through to the part-voice fallback and then reports unavailable", async () => {
    const { container } = render(StoryTextRows, { rows: [rows[2]], labels });

    await fireEvent.click(screen.getByRole("button", { name: "Play voice" }));
    const audioElement = getAudioElement(container);
    await fireEvent(audioElement, new Event("error"));
    expect(audioElement.getAttribute("src")).toBe("/storage/partvoice.mp3");

    await fireEvent(audioElement, new Event("error"));
    const button = screen.getByRole("button", {
      name: "Voice unavailable"
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("keeps background images unloaded until the row is revealed", async () => {
    render(StoryTextRows, { rows, labels });

    // Hidden by default: a reveal button instead of the preview trigger.
    expect(screen.queryByRole("button", { name: "Background change" })).toBeNull();
    const reveal = screen.getByRole("button", { name: "Show background" });
    expect(reveal.querySelector("img")).toBeNull();

    await fireEvent.click(reveal);

    const trigger = screen.getByRole("button", { name: "Background change" });
    expect(trigger.querySelector("img")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show background" })).toBeNull();
  });

  it("plays BGM rows through the shared audio player with a seek control", () => {
    render(StoryTextRows, { rows, labels });

    expect(screen.getByText("Cheerful Theme")).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Seek" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("renders stop-only SE rows and full-screen text without extra playback", () => {
    render(StoryTextRows, { rows, labels });

    expect(screen.getByText("Stop sound effect")).toBeTruthy();
    expect(screen.getByText("To the stage!")).toBeTruthy();
    // Exactly two voice toggles: the talk line and the full-screen text row.
    expect(screen.getAllByRole("button", { name: "Play voice" }).length).toBe(2);
  });
});
