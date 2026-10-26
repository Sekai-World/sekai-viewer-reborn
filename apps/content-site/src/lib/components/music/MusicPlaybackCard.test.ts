import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicDetail } from "$lib/domain/music-detail";
import { resolveMusicVideoAssetURL } from "$lib/assets/music-video";
import MusicPlaybackCard from "./MusicPlaybackCard.svelte";

vi.mock("$lib/assets/music-video", () => ({ resolveMusicVideoAssetURL: vi.fn() }));
vi.mock("$env/dynamic/public", () => ({ env: { PUBLIC_REMOTE_ASSET_BASE_URL: "/storage" } }));
const howler = vi.hoisted(() => ({ unload: vi.fn(), created: vi.fn() }));
vi.mock("../../../../../../packages/ui-shell/node_modules/howler", () => ({
  Howl: class {
    constructor(options: { src: string[] }) {
      howler.created(options);
    }
    unload = howler.unload;
    playing = () => false;
    duration = () => 120;
    seek = () => 0;
    volume = () => 1;
  }
}));

const music: MusicDetail = {
  id: "8",
  title: "Song",
  assetBundleName: "0008",
  categories: [],
  composer: "Composer",
  arranger: null,
  lyricist: null,
  publishedAt: null,
  creatorArtist: null,
  liveStage: null,
  releaseCondition: null,
  difficulties: [],
  fillerSec: 2,
  tags: [],
  vocals: [
    {
      id: "v1",
      musicId: "8",
      vocalType: "Original",
      assetBundleName: "v1",
      characters: [{ characterId: 1, unit: "light_sound" }],
      overrideChara: null
    },
    {
      id: "v2",
      musicId: "8",
      vocalType: "Another",
      assetBundleName: "v2",
      characters: null,
      overrideChara: [{ characterId: 0, unit: "none" }]
    },
    {
      id: "missing",
      musicId: "8",
      vocalType: null,
      assetBundleName: null,
      characters: null,
      overrideChara: null
    }
  ],
  musicVideos: [
    { category: "mv_2d", assetBundleName: "0008", musicVocalId: null },
    { category: "original", assetBundleName: "original8", musicVocalId: "v1" },
    { category: "original", assetBundleName: "alternate8", musicVocalId: null },
    { category: "original", assetBundleName: "missing8", musicVocalId: "missing" }
  ]
};
const props = {
  music,
  region: "jp" as const,
  availableRegions: ["jp" as const],
  musicId: "8",
  title: "Song",
  vocalLabel: "Vocals",
  audioLabel: "Audio",
  musicVideoLabel: "Music Video",
  vocalTypeLabel: "Type",
  vocalCharacterLabel: "Character",
  lockedVocalLabel: "Fixed vocal version",
  noVocalsLabel: "No vocals",
  shortPreviewLabel: "Short",
  longPreviewLabel: "Full",
  noPreviewAvailableLabel: "No preview",
  playLabel: "Play",
  pauseLabel: "Pause",
  downloadLabel: "Download",
  downloadCloseLabel: "Close",
  volumeLabel: "Volume",
  seekLabel: "Seek",
  unavailableLabel: "Unavailable",
  variantLabel: "Video version",
  originalLabel: "Original",
  mv2dLabel: "2D MV",
  duplicateLabel: "Version",
  loadingLabel: "Loading",
  retryLabel: "Retry",
  noVideoLabel: "No video",
  unsupportedLabel: "Unsupported",
  audioUnavailableLabel: "Audio unavailable",
  downloadProgressMessages: {
    preparing: "Preparing",
    fetchingAudio: "Fetching",
    fetchingCover: "Cover",
    writingMetadata: "Metadata",
    finalizing: "Finalizing",
    ready: "Ready",
    failed: "Failed",
    cancelled: "Cancelled"
  }
};
const resolver = vi.mocked(resolveMusicVideoAssetURL);
const vocalSelector = () => screen.getByRole("group", { name: "Vocals" });
const vocalButton = (name: string) => screen.getByRole("button", { name });
const selectVocal = (name: string) => fireEvent.click(vocalButton(name));
const mode = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const video = () => screen.getByLabelText("Song Music Video") as HTMLVideoElement;
const soundtrack = () =>
  document.querySelector("video")?.parentElement?.querySelector("audio") as HTMLAudioElement;
const variant = (index: number) =>
  fireEvent.change(screen.getByRole("combobox", { name: "Video version" }), {
    target: { value: String(index) }
  });
async function ready() {
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
}

beforeEach(() => {
  resolver
    .mockReset()
    .mockImplementation(async (descriptor) => `/video/${descriptor.assetBundleName}.mp4`);
  howler.created.mockClear();
  howler.unload.mockClear();
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
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-low-motion");
});

describe("MusicPlaybackCard shared selection", () => {
  it("shares mobile dropdown selection with preview URLs, the pinned switch and fixed MV vocals", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 639px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    render(MusicPlaybackCard, props);
    await fireEvent.click(await screen.findByRole("button", { name: "Vocals: Original" }));
    await fireEvent.click(await screen.findByRole("option", { name: "Another" }));
    expect(screen.getByRole("button", { name: "Vocals: Another" })).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
    await fireEvent.click(screen.getByRole("switch", { name: "Short / Full" }));
    await fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(howler.created).toHaveBeenLastCalledWith(
        expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/short/v2/v2_short.mp3"] })
      )
    );
    await mode("Music Video");
    await ready();
    await variant(1);
    await ready();
    expect(screen.getByRole("button", { name: "Vocals: Original" })).toHaveProperty(
      "disabled",
      true
    );
    expect(soundtrack().getAttribute("src")).toContain("/v1/v1.mp3");
    await mode("Audio");
    expect(screen.getByRole("button", { name: "Vocals: Original" })).toHaveProperty(
      "disabled",
      false
    );
    expect(screen.getByRole("switch", { name: "Short / Full" })).toHaveProperty("checked", false);
  });

  it.each([true, false])(
    "uses the pinned native switch for exact preview URLs (MV available: %s)",
    async (hasMv) => {
      render(MusicPlaybackCard, {
        ...props,
        music: { ...music, musicVideos: hasMv ? music.musicVideos : [] }
      });
      const control = screen.getByRole("switch", { name: "Short / Full" });
      expect(control.tagName).toBe("INPUT");
      expect(control).toHaveProperty("checked", true);
      await fireEvent.click(control);
      expect(control).toHaveProperty("checked", false);
      await selectVocal("Another");
      expect(control).toHaveProperty("checked", false);
      await fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await waitFor(() =>
        expect(howler.created).toHaveBeenLastCalledWith(
          expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/short/v2/v2_short.mp3"] })
        )
      );
      if (hasMv) {
        await mode("Music Video");
        await ready();
        await mode("Audio");
        expect(screen.getByRole("switch", { name: "Short / Full" })).toHaveProperty(
          "checked",
          false
        );
      }
      await fireEvent.click(screen.getByRole("switch", { name: "Short / Full" }));
      await fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await waitFor(() =>
        expect(howler.created).toHaveBeenLastCalledWith(
          expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/long/v2/v2.mp3"] })
        )
      );
    }
  );

  it("keeps the preview switch in place but disabled for a single MV variant", async () => {
    render(MusicPlaybackCard, {
      ...props,
      music: { ...music, musicVideos: [music.musicVideos[0]!] }
    });
    await mode("Music Video");
    await ready();
    expect(screen.getByRole("switch", { name: "Short / Full" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("combobox")).toBeNull();
    await mode("Audio");
    expect(screen.getByRole("switch", { name: "Short / Full" })).toHaveProperty("disabled", false);
  });

  it("keeps long mode labels in a shared narrow-screen header with full accessible names", () => {
    const audioLabel = "A long localized audio playback label";
    const musicVideoLabel = "A long localized music video playback label";
    render(MusicPlaybackCard, { ...props, audioLabel, musicVideoLabel });
    const header = screen.getByTestId("music-playback-header");
    expect(header.classList.contains("grid-cols-1")).toBe(true);
    expect(header.classList.contains("grid-rows-[1.5rem_2.75rem]")).toBe(true);
    for (const name of [audioLabel, musicVideoLabel]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("title")).toBe(name);
      expect(button.classList.contains("min-h-11")).toBe(true);
      expect(button.querySelector(".truncate")?.textContent).toBe(name);
    }
  });

  it("cancels a measured size animation when its output width changes", async () => {
    let resized = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    render(MusicPlaybackCard, props);
    const output = screen.getByTestId("music-playback-output");
    let width = 300;
    const cancel = vi.fn();
    Object.defineProperty(output, "animate", { configurable: true, value: () => ({ cancel }) });
    vi.spyOn(output, "getBoundingClientRect").mockImplementation(
      () => ({ width, height: output.classList.contains("h-44") ? 200 : 130 }) as DOMRect
    );
    resized();
    await mode("Music Video");
    await ready();
    width = 220;
    resized();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(output.style.height).toBe("");
  });

  it("animates measured output sizes while immediately replacing and cleaning up presenters", async () => {
    const { container, unmount } = render(MusicPlaybackCard, props);
    const output = screen.getByTestId("music-playback-output");
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    Object.defineProperty(output, "animate", { configurable: true, value: animate });
    vi.spyOn(output, "getBoundingClientRect").mockImplementation(
      () => ({ height: output.classList.contains("h-44") ? 200 : 130 }) as DOMRect
    );
    await mode("Music Video");
    await ready();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(animate).toHaveBeenLastCalledWith([{ height: "130px" }, { height: "200px" }], {
      duration: 180,
      easing: "ease-out"
    });
    const oldVideo = video();
    await mode("Audio");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(container.querySelector("video")).toBeNull();
    expect(oldVideo.hasAttribute("src")).toBe(false);
    expect(animate).toHaveBeenLastCalledWith([{ height: "200px" }, { height: "130px" }], {
      duration: 180,
      easing: "ease-out"
    });
    expect(output.style.height).toBe("");
    expect(output.classList.contains("overflow-visible")).toBe(true);
    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it.each(["system", "site"])(
    "skips size motion for the %s reduced-motion preference",
    async (preference) => {
      if (preference === "system") {
        vi.stubGlobal("matchMedia", () => ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }));
      } else {
        document.documentElement.setAttribute("data-low-motion", "");
      }
      render(MusicPlaybackCard, props);
      const output = screen.getByTestId("music-playback-output");
      const animate = vi.fn();
      Object.defineProperty(output, "animate", { configurable: true, value: animate });
      await mode("Music Video");
      await ready();
      await mode("Audio");
      expect(animate).not.toHaveBeenCalled();
      expect(output.style.height).toBe("");
    }
  );

  it("keeps the compact controls mode-specific and avoids empty embedded sections", async () => {
    const { container } = render(MusicPlaybackCard, props);

    expect(screen.getByTestId("music-playback-header").className).toContain("h-14");
    expect(screen.getByTestId("music-playback-vocal-toolbar").className).toContain("h-14");
    expect(screen.getByTestId("music-playback-mode-toolbar").className).toContain("h-11");
    expect(
      screen
        .getByTestId("music-playback-vocal-toolbar")
        .contains(screen.getByTestId("music-playback-mode-toolbar"))
    ).toBe(true);
    expect(screen.getByTestId("music-playback-output").className).not.toContain("h-44");
    const modeGroup = screen.getByRole("group", { name: "Audio / Music Video" });
    expect(modeGroup).toBeTruthy();
    expect(screen.getByRole("button", { name: "Audio" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Music Video" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(vocalSelector()).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Vocals" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Audio" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Song" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Short / Full" })).toHaveProperty("checked", true);
    expect(screen.queryByRole("button", { name: "Short" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Full" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Video version" })).toBeNull();
    expect(screen.queryByRole("button", { name: "No vocals" })).toBeNull();
    expect(screen.queryByText("No preview")).toBeNull();
    expect(container.querySelectorAll(".content-card-inset")).toHaveLength(0);

    await mode("Music Video");
    await ready();
    expect(screen.getByTestId("music-playback-output").className).toContain("h-44");
    expect(screen.getByTestId("music-playback-output").classList.contains("sm:h-52")).toBe(true);
    expect(screen.getByTestId("music-playback-output").classList.contains("lg:h-[640px]")).toBe(
      true
    );
    expect(screen.getByRole("button", { name: "Audio" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(screen.getByRole("button", { name: "Music Video" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.queryByRole("button", { name: "Short" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Full" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Video version" })).toBeTruthy();
    expect(container.querySelectorAll("video")).toHaveLength(1);
    expect(container.querySelectorAll("audio")).toHaveLength(1);

    await mode("Audio");
    expect(screen.getByTestId("music-playback-output").className).not.toContain("h-44");
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("switch", { name: "Short / Full" })).toHaveProperty("checked", true);
    expect(screen.queryByRole("combobox", { name: "Video version" })).toBeNull();
  });

  it("uses one vocal selection for both outputs and renders only one output inside one card", async () => {
    const onPlayback = vi.fn();
    const { container } = render(MusicPlaybackCard, { ...props, onPlayback });
    expect(container.querySelectorAll(".card")).toHaveLength(1);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(vocalButton("Original").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "No vocals" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    await selectVocal("Another");
    await fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(howler.created).toHaveBeenCalledWith(
        expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/long/v2/v2.mp3"] })
      )
    );
    expect(onPlayback).toHaveBeenCalledTimes(1);
    await mode("Music Video");
    await ready();
    expect(howler.unload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Short" })).toBeNull();
    expect(soundtrack().getAttribute("src")).toContain("/v2/v2.mp3");
    await selectVocal("Original");
    expect(soundtrack().getAttribute("src")).toContain("/v1/v1.mp3");
    expect(resolver).toHaveBeenCalledTimes(1);
    await mode("Audio");
    expect(container.querySelector("video")).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(howler.created).toHaveBeenLastCalledWith(
        expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/long/v1/v1.mp3"] })
      )
    );
  });

  it("reconciles explicit-vocal variants, disables the shared selector, and retains that vocal when unlocked", async () => {
    render(MusicPlaybackCard, props);
    await selectVocal("Another");
    await mode("Music Video");
    await ready();
    await variant(1);
    await ready();
    expect(vocalButton("Original").getAttribute("aria-pressed")).toBe("true");
    expect(vocalButton("Another")).toHaveProperty("disabled", true);
    expect(screen.getByText("Fixed vocal version")).toBeTruthy();
    expect(soundtrack().getAttribute("src")).toContain("/v1/v1.mp3");
    await variant(2);
    await ready();
    expect(vocalButton("Another")).toHaveProperty("disabled", false);
    expect(vocalButton("Original").getAttribute("aria-pressed")).toBe("true");
    await selectVocal("Another");
    await variant(0);
    await ready();
    expect(soundtrack().getAttribute("src")).toContain("/v2/v2.mp3");
    await variant(3);
    await ready();
    expect(soundtrack()).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Audio unavailable");
    await variant(0);
    await ready();
    expect(soundtrack().getAttribute("src")).toContain("/v1/v1.mp3");
  });

  it("enforces explicit variants when returning from Audio, but lets Audio use another vocal", async () => {
    render(MusicPlaybackCard, props);
    await mode("Music Video");
    await ready();
    await variant(1);
    await ready();
    await mode("Audio");
    expect(vocalButton("Another")).toHaveProperty("disabled", false);
    await selectVocal("Another");
    await mode("Music Video");
    await ready();
    expect(soundtrack().getAttribute("src")).toContain("/v1/v1.mp3");
  });

  it("coordinates local playback, pauses via the route token, and stops native media before showing Audio", async () => {
    const onPlayback = vi.fn();
    const { rerender } = render(MusicPlaybackCard, { ...props, onPlayback });
    await mode("Music Video");
    await ready();
    await act(() => video().play());
    expect(onPlayback).toHaveBeenCalledTimes(1);
    const oldVideo = video();
    const oldAudio = soundtrack();
    await rerender({ ...props, onPlayback, pauseToken: 1 });
    expect(oldAudio.paused).toBe(true);
    expect(oldVideo.paused).toBe(true);
    await act(() => video().play());
    await mode("Audio");
    expect(oldAudio.paused).toBe(true);
    expect(oldAudio.hasAttribute("src")).toBe(false);
    expect(oldVideo.paused).toBe(true);
    expect(oldVideo.hasAttribute("src")).toBe(false);
  });

  it("hides the MV mode without descriptors, keeps working audio, and resets on a new song", async () => {
    const { rerender, container } = render(MusicPlaybackCard, {
      ...props,
      music: { ...music, musicVideos: [] }
    });
    expect(container.querySelector('button[title="Music Video"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Music Video" })).toBeNull();
    expect(screen.getByRole("group", { name: "Audio" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Audio" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Audio" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(howler.created).toHaveBeenCalledWith(
        expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/long/v1/v1.mp3"] })
      )
    );
    expect(resolver).not.toHaveBeenCalled();
    await rerender(props);
    expect(screen.getByRole("group", { name: "Audio / Music Video" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Music Video" })).toBeTruthy();
    await mode("Music Video");
    await ready();
    await variant(2);
    await ready();
    const oldVideo = video();
    const oldAudio = soundtrack();
    await act(() => oldVideo.play());
    await rerender({ ...props, music: { ...music, musicVideos: [] } });
    expect(screen.getByRole("heading", { name: "Audio" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Audio" })).toBeTruthy();
    expect(container.querySelector('button[title="Music Video"]')).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(oldVideo.paused).toBe(true);
    expect(oldVideo.hasAttribute("src")).toBe(false);
    expect(oldAudio.paused).toBe(true);
    expect(oldAudio.hasAttribute("src")).toBe(false);
    await rerender(props);
    expect(screen.getByRole("button", { name: "Music Video" })).toBeTruthy();
    await mode("Music Video");
    await ready();
    await variant(2);
    await ready();
    await rerender({ ...props, music: { ...music, musicVideos: [music.musicVideos[0]!] } });
    await ready();
    expect(video().getAttribute("src")).toBe("/video/0008.mp4");
    await rerender({ ...props, musicId: "9" });
    expect(container.querySelector("video")).toBeNull();
    expect(vocalButton("Original").getAttribute("aria-pressed")).toBe("true");
    await rerender({ ...props, music: { ...music, musicVideos: [], vocals: [] } });
    expect(screen.getByText("No vocals")).toBeTruthy();
    expect(screen.getByText("No preview")).toBeTruthy();
  });
});
