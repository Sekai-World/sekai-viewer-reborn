import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AudioPlayer from "./audio-player.svelte";

type MockHowlOptions = {
  onload?: () => void;
  onplay?: () => void;
  onpause?: () => void;
  onstop?: () => void;
  onend?: () => void;
  onseek?: () => void;
};

type MockHowl = {
  currentTime: number;
  playingState: boolean;
  seek: (nextTime?: number) => MockHowl | number;
  playing: () => boolean;
  duration: () => number;
  play: () => number;
  pause: () => MockHowl;
  volume: (nextVolume?: number) => MockHowl | number;
  unload: () => null;
};

const mockedHowl = vi.hoisted(() => vi.fn<(options: MockHowlOptions) => MockHowl>());

vi.mock("howler", () => ({ Howl: mockedHowl }));

class MockAudio {
  preload = "";
  src = "";
  duration = Number.NaN;

  addEventListener(): void {}
  removeAttribute(): void {}
  load(): void {}
  pause(): void {}
}

const playerProps = {
  src: "/track.mp3",
  title: "Track",
  downloadProgressMessages: {
    preparing: "Preparing",
    fetchingAudio: "Fetching audio",
    fetchingCover: "Fetching cover",
    writingMetadata: "Writing metadata",
    finalizing: "Finalizing",
    ready: "Ready",
    failed: "Failed",
    cancelled: "Cancelled"
  },
  playLabel: "Play",
  pauseLabel: "Pause",
  downloadLabel: "Download",
  downloadCloseLabel: "Close",
  volumeLabel: "Volume",
  seekLabel: "Seek",
  unavailableLabel: "Unavailable"
};

const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;
const frames = new Map<number, FrameRequestCallback>();
const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback): number => {
  const id = frames.size + 1;
  frames.set(id, callback);
  return id;
});
const cancelAnimationFrameMock = vi.fn((id: number): void => {
  frames.delete(id);
});

let currentHowl: MockHowl | undefined;

const createMockHowl = (options: MockHowlOptions): MockHowl => {
  const instance: MockHowl = {
    currentTime: 0,
    playingState: false,
    seek: (nextTime) => {
      if (nextTime === undefined) {
        return instance.currentTime;
      }

      const wasPlaying = instance.playingState;
      instance.currentTime = nextTime;

      if (wasPlaying) {
        // Howler pauses internally while seeking and resumes without emitting
        // `play`; the eventual `seek` event is the first reliable resume point.
        instance.playingState = false;
        window.setTimeout(() => {
          instance.playingState = true;
          options.onseek?.();
        }, 0);
      } else {
        options.onseek?.();
      }

      return instance;
    },
    playing: () => instance.playingState,
    duration: () => 120,
    play: () => {
      instance.playingState = true;
      options.onplay?.();
      return 1;
    },
    pause: () => {
      instance.playingState = false;
      options.onpause?.();
      return instance;
    },
    volume: (nextVolume) => (nextVolume === undefined ? 1 : instance),
    unload: () => {
      instance.playingState = false;
      return null;
    }
  };

  return instance;
};

const runNextFrame = (timestamp: number): void => {
  const nextFrame = frames.entries().next();
  if (nextFrame.done) {
    throw new Error("Expected a pending progress frame.");
  }

  const [id, callback] = nextFrame.value;
  frames.delete(id);
  callback(timestamp);
};

const renderPlayingPlayer = async () => {
  const rendered = render(AudioPlayer, playerProps);
  await fireEvent.click(screen.getByRole("button", { name: "Play" }));
  await waitFor(() => expect(mockedHowl).toHaveBeenCalledOnce());
  await waitFor(() => expect(currentHowl?.playingState).toBe(true));
  await tick();
  return rendered;
};

beforeEach(() => {
  frames.clear();
  requestAnimationFrameMock.mockClear();
  cancelAnimationFrameMock.mockClear();
  mockedHowl.mockReset();
  currentHowl = undefined;
  window.requestAnimationFrame = requestAnimationFrameMock;
  window.cancelAnimationFrame = cancelAnimationFrameMock;
  vi.stubGlobal("Audio", MockAudio);

  mockedHowl.mockImplementation(function (options) {
    currentHowl = createMockHowl(options);
    queueMicrotask(() => options.onload?.());
    return currentHowl;
  });
});

afterEach(() => {
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AudioPlayer", () => {
  it("restarts progress syncing after Howler resumes a playing seek", async () => {
    const { unmount } = await renderPlayingPlayer();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    runNextFrame(1000);
    expect(frames.size).toBe(1);

    const range = screen.getByRole("slider", { name: "Seek" }) as HTMLInputElement;
    range.value = "30";
    await fireEvent.input(range);
    await fireEvent.pointerUp(range);
    await tick();

    // The active frame can observe Howler's short internal pause and exit.
    runNextFrame(1016);
    expect(frames.size).toBe(0);

    vi.runOnlyPendingTimers();
    await tick();

    // onseek is also responsible for recovering the loop because Howler's
    // internal resume does not emit the component's onplay callback.
    expect(frames.size).toBe(1);
    runNextFrame(1100);
    runNextFrame(1200);
    await tick();

    expect(Number(range.value)).toBeGreaterThan(30);
    unmount();
  });

  it("keeps a paused seek at the selected position", async () => {
    const { unmount } = await renderPlayingPlayer();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const range = screen.getByRole("slider", { name: "Seek" }) as HTMLInputElement;
    range.value = "45";
    await fireEvent.input(range);
    await fireEvent.pointerUp(range);
    await tick();

    expect(currentHowl?.playingState).toBe(false);
    expect(frames.size).toBe(0);
    expect(range.value).toBe("45");
    unmount();
  });
});
