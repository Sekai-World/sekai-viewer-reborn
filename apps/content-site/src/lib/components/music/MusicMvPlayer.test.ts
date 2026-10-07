import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMusicVideoAssetURL } from "$lib/assets/music-video";
import type { MusicVideoDescriptor, MusicVocal } from "$lib/domain/music-detail";
import MusicMvPlayer from "./MusicMvPlayer.svelte";

vi.mock("$lib/assets/music-video", () => ({ resolveMusicVideoAssetURL: vi.fn() }));
vi.mock("$env/dynamic/public", () => ({ env: { PUBLIC_REMOTE_ASSET_BASE_URL: "/storage" } }));

const labels = {
  title: "Tell Your World",
  heading: "Music Video",
  videoLabel: "Music Video",
  variantLabel: "Video version",
  originalLabel: "Original",
  mv2dLabel: "2D MV",
  duplicateLabel: "Version",
  vocalLabel: "Vocals",
  loadingLabel: "Loading video",
  retryLabel: "Retry",
  noVideoLabel: "Music video is not available.",
  unsupportedLabel: "This music video could not be played.",
  audioUnavailableLabel: "Audio unavailable. Try another vocal version."
};
const descriptors: MusicVideoDescriptor[] = [
  { category: "mv_2d", assetBundleName: "0008", musicVocalId: null },
  { category: "original", assetBundleName: "original8", musicVocalId: "v2" }
];
const vocals: MusicVocal[] = ["v1", "v2"].map((id) => ({
  id,
  musicId: "8",
  vocalType: id,
  assetBundleName: id,
  characters: null,
  overrideChara: null
}));
const props = { ...labels, descriptors, vocals };
const resolver = vi.mocked(resolveMusicVideoAssetURL);
const video = (): HTMLVideoElement =>
  screen.getByLabelText("Tell Your World Music Video") as HTMLVideoElement;
const audio = (): HTMLAudioElement => document.querySelector("audio")!;

beforeEach(() => {
  resolver
    .mockReset()
    .mockImplementation(async (descriptor) => `/video/${descriptor.assetBundleName}.mp4`);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement
  ) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement
  ) {
    const wasPaused = this.paused;
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    if (!wasPaused) this.dispatchEvent(new Event("pause"));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function ready(): Promise<void> {
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
}
async function playVideo(): Promise<void> {
  await act(() => video().play());
}

describe("MusicMvPlayer descriptors and listing lifecycle", () => {
  it("hides the entire card without descriptors and makes no listing request", () => {
    const { container } = render(MusicMvPlayer, { ...props, descriptors: [] });
    expect(container.querySelector("article")).toBeNull();
    expect(resolver).not.toHaveBeenCalled();
  });

  it("resolves the descriptor with the supplied music asset server and native controls", async () => {
    render(MusicMvPlayer, { ...props, audioServer: "en", poster: "/jacket.webp" });
    await ready();
    expect(resolver).toHaveBeenCalledWith(
      descriptors[0],
      expect.objectContaining({ server: "en", signal: expect.any(AbortSignal) })
    );
    expect(video().getAttribute("poster")).toBe("/jacket.webp");
    expect(video().getAttribute("preload")).toBe("metadata");
    expect(video().hasAttribute("controls")).toBe(true);
    expect(video().hasAttribute("playsinline")).toBe(true);
    expect(audio().getAttribute("src")).toBe("/storage/sekai-en-assets/music/long/v1/v1.mp3");
  });

  it("ignores an old listing after switching and resets selection for new song props", async () => {
    let finishOld!: (source: string) => void;
    resolver.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        })
    );
    const { rerender } = render(MusicMvPlayer, props);
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    const signal = resolver.mock.calls[0]![1]!.signal!;
    await fireEvent.change(screen.getByLabelText(labels.variantLabel), { target: { value: "1" } });
    await ready();
    expect(signal.aborted).toBe(true);
    await act(() => finishOld("/old.mp4"));
    expect(video().getAttribute("src")).toBe("/video/original8.mp4");
    expect(audio().getAttribute("src")).toContain("/v2/v2.mp3");
    await rerender({ ...props, title: "Next song", descriptors: [...descriptors] });
    await waitFor(() =>
      expect((screen.getByLabelText(labels.variantLabel) as HTMLSelectElement).value).toBe("0")
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Next song Music Video").getAttribute("src")).toBe(
        "/video/0008.mp4"
      )
    );
  });

  it("retries listing and media failures without invalidating a valid listing", async () => {
    resolver.mockRejectedValueOnce(new Error("listing failed"));
    render(MusicMvPlayer, props);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(labels.unsupportedLabel)
    );
    await fireEvent.click(screen.getByRole("button", { name: labels.retryLabel }));
    await ready();
    await fireEvent.error(video());
    expect(screen.getByRole("alert").textContent).toContain(labels.unsupportedLabel);
    await fireEvent.click(screen.getByRole("button", { name: labels.retryLabel }));
    await ready();
    expect(resolver).toHaveBeenCalledTimes(3);
  });

  it("does not substitute a random vocal when an explicit vocal is missing", async () => {
    render(MusicMvPlayer, {
      ...props,
      descriptors: [{ ...descriptors[0]!, musicVocalId: "missing" }]
    });
    await ready();
    expect(document.querySelector("audio")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(labels.audioUnavailableLabel);
    await playVideo();
    expect(video().paused).toBe(true);
  });
});

describe("MusicMvPlayer separate audio synchronization", () => {
  it("syncs play, pause, seek, drift, rate, volume, mute and end from native video controls", async () => {
    render(MusicMvPlayer, props);
    await ready();
    video().currentTime = 10;
    await playVideo();
    expect(audio().paused).toBe(false);
    expect(audio().currentTime).toBe(10);
    video().playbackRate = 1.5;
    await fireEvent.rateChange(video());
    video().volume = 0.4;
    video().muted = true;
    await fireEvent.volumeChange(video());
    expect(audio().playbackRate).toBe(1.5);
    expect(audio().volume).toBe(0.4);
    expect(audio().muted).toBe(true);
    video().currentTime = 20;
    await fireEvent.seeking(video());
    expect(audio().currentTime).toBe(20);
    expect(audio().paused).toBe(true);
    await fireEvent.seeked(video());
    expect(audio().paused).toBe(false);
    audio().currentTime = 18;
    await fireEvent.timeUpdate(video());
    expect(audio().currentTime).toBe(20);
    await act(() => video().pause());
    expect(audio().paused).toBe(true);
    await playVideo();
    await fireEvent.ended(video());
    expect(audio().paused).toBe(true);
  });

  it("pauses audio during video buffering and resumes at canplay; pauses video during audio buffering", async () => {
    render(MusicMvPlayer, props);
    await ready();
    await playVideo();
    await fireEvent.waiting(video());
    expect(audio().paused).toBe(true);
    await fireEvent.canPlay(video());
    expect(audio().paused).toBe(false);
    await fireEvent.waiting(audio());
    expect(video().paused).toBe(true);
    await fireEvent.canPlay(audio());
    expect(video().paused).toBe(false);
    expect(audio().paused).toBe(false);
  });

  it("shows audio load/play failures and recovers on canplay without autoplay", async () => {
    render(MusicMvPlayer, props);
    await ready();
    await fireEvent.error(audio());
    expect(screen.getByRole("alert").textContent).toContain(labels.audioUnavailableLabel);
    await fireEvent.canPlay(audio());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(video().paused).toBe(true);
    Object.defineProperty(audio(), "play", {
      configurable: true,
      value: vi.fn().mockRejectedValueOnce(new Error("blocked"))
    });
    await playVideo();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(labels.audioUnavailableLabel)
    );
    expect(video().paused).toBe(true);
    await fireEvent.click(screen.getByRole("button", { name: labels.retryLabel }));
    await ready();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores a stale play rejection after pause or a vocal switch and retains the new audio src", async () => {
    render(MusicMvPlayer, props);
    await ready();
    let rejectPlay!: (reason: Error) => void;
    Object.defineProperty(audio(), "play", {
      configurable: true,
      value: vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectPlay = reject;
          })
      )
    });
    await playVideo();
    await fireEvent.change(screen.getByLabelText(labels.vocalLabel), { target: { value: "v2" } });
    await act(() => rejectPlay(new Error("old play failed")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(audio().getAttribute("src")).toContain("/v2/v2.mp3");
    expect(video().paused).toBe(true);
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("coordinates locally, responds to preview pause requests, and clears media on unmount", async () => {
    const onPlayback = vi.fn();
    const { rerender, unmount } = render(MusicMvPlayer, { ...props, onPlayback });
    await ready();
    const oldAudio = audio();
    const oldVideo = video();
    await playVideo();
    expect(onPlayback).toHaveBeenCalledTimes(1);
    await rerender({ ...props, onPlayback, pauseToken: 1 });
    expect(oldAudio.paused).toBe(true);
    expect(oldVideo.paused).toBe(true);
    await playVideo();
    unmount();
    expect(oldAudio.paused).toBe(true);
    expect(oldAudio.hasAttribute("src")).toBe(false);
    expect(resolver.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  });
});
