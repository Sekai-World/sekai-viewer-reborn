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

class MockAudio {
  static instances: MockAudio[] = [];
  preload = "";
  src = "";
  loop = false;
  duration = Number.NaN;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplay: (() => void) | null = null;
  currentTime = 0;
  paused = true;
  play = vi.fn(() => {
    this.paused = false;
    this.onplay?.();
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
  removeAttribute = vi.fn();
  addEventListener = vi.fn();

  constructor() {
    MockAudio.instances.push(this);
  }
}

const rows: StoryTextRowView[] = [
  { kind: "background", name: "Street", imageUrl: "/storage/bg.webp" },
  { kind: "bgm", name: "Cheerful Theme", url: "/storage/bgm.mp3" },
  {
    kind: "talk",
    name: "花里みのり",
    body: "こんにちは！",
    voiceUrls: ["/storage/voice.mp3", "/storage/partvoice.mp3"]
  },
  { kind: "se", stop: true },
  { kind: "fullscreen-text", text: "To the stage!", voiceUrls: ["/storage/fs.mp3"] }
];

beforeEach(() => {
  MockAudio.instances = [];
  vi.stubGlobal("Audio", MockAudio);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StoryTextRows", () => {
  it("renders the talk line with a circular voice toggle that plays the first source", async () => {
    render(StoryTextRows, { rows: [rows[2]], labels });

    const play = screen.getByRole("button", { name: "Play voice" });
    await fireEvent.click(play);

    expect(MockAudio.instances[0]?.src).toBe("/storage/voice.mp3");
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(MockAudio.instances[0]?.pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play voice" })).toBeTruthy();
  });

  it("falls through to the fallback source when the canonical voice fails", async () => {
    render(StoryTextRows, { rows: [rows[2]], labels });

    await fireEvent.click(screen.getByRole("button", { name: "Play voice" }));
    const element = MockAudio.instances[0];
    element?.onerror?.();

    expect(MockAudio.instances[0]?.src).toBe("/storage/partvoice.mp3");
  });

  it("exposes the background row as a preview trigger with the caption label", () => {
    render(StoryTextRows, { rows, labels });

    const trigger = screen.getByRole("button", { name: "Background change" });
    expect(trigger.querySelector("img")).not.toBeNull();
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
