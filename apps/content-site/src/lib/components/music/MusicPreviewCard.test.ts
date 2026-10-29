import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MusicPreviewCard from "./MusicPreviewCard.svelte";

vi.mock("$app/env/public", () => ({ PUBLIC_REMOTE_ASSET_BASE_URL: "/storage" }));
vi.mock("$app/paths", () => ({ resolve: (path: string) => path }));
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

const props = {
  selectedVocal: {
    id: "1",
    musicId: "8",
    vocalType: "Original",
    assetBundleName: "v1",
    characters: null,
    overrideChara: null
  },
  region: "jp" as const,
  availableRegions: ["jp" as const],
  musicId: "8",
  title: "Song",
  vocalLabel: "Vocals",
  vocalTypeLabel: "Type",
  vocalCharacterLabel: "Character",
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

beforeEach(() => {
  howler.created.mockClear();
  howler.unload.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("notifies the local MV coordinator before requesting preview playback and unloads on an MV pause request", async () => {
  const onPlayback = vi.fn();
  const { rerender } = render(MusicPreviewCard, { ...props, onPlayback });
  await fireEvent.click(screen.getByRole("button", { name: "Play" }));
  expect(onPlayback).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(howler.created).toHaveBeenCalledTimes(1));
  await rerender({ ...props, onPlayback, pauseToken: 1 });
  expect(howler.unload).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Full" }).className).toContain("btn-primary");
});

it("renders without a nested card shell when embedded", () => {
  const { container } = render(MusicPreviewCard, { ...props, embedded: true });

  expect(container.querySelector("article")).toBeNull();
  expect(container.querySelector("section")).toBeTruthy();
  expect(container.querySelector(".card")).toBeNull();
  const audioWrapper = container.querySelector('[class~="min-h-0"]');
  expect(audioWrapper?.classList.contains("p-3")).toBe(true);
  expect(audioWrapper?.classList.contains("sm:p-4")).toBe(true);
  expect(audioWrapper?.classList.contains("content-card-inset")).toBe(false);
  expect(audioWrapper?.classList.contains("flex-1")).toBe(false);
  expect(container.querySelector(".h-full")).toBeNull();
});

it("updates controlled vocal audio, preserves preview controls and exposes all download formats", async () => {
  const { container, rerender } = render(MusicPreviewCard, { ...props, fillerSec: 2 });
  expect(container.querySelector("article")).toBeTruthy();
  for (const format of ["MP3", "FLAC", "WAV"]) {
    expect(screen.getByRole("button", { name: format })).toBeTruthy();
  }
  await fireEvent.click(screen.getByRole("button", { name: "Short" }));
  expect(screen.getByRole("button", { name: "Short" }).getAttribute("aria-pressed")).toBe("true");
  await fireEvent.click(screen.getByRole("button", { name: "Play" }));
  await waitFor(() =>
    expect(howler.created).toHaveBeenLastCalledWith(
      expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/short/v1/v1_short.mp3"] })
    )
  );
  await rerender({
    ...props,
    selectedVocal: { ...props.selectedVocal, id: "2", assetBundleName: "v2", vocalType: null },
    fillerSec: -1
  });
  await fireEvent.click(screen.getByRole("button", { name: "Play" }));
  await waitFor(() =>
    expect(howler.created).toHaveBeenLastCalledWith(
      expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/short/v2/v2_short.mp3"] })
    )
  );
  await fireEvent.click(screen.getByRole("button", { name: "Full" }));
  await fireEvent.click(screen.getByRole("button", { name: "Play" }));
  await waitFor(() =>
    expect(howler.created).toHaveBeenLastCalledWith(
      expect.objectContaining({ src: ["/storage/sekai-jp-assets/music/long/v2/v2.mp3"] })
    )
  );
});

it("shows a compact unavailable state without substituting an unselected vocal", () => {
  render(MusicPreviewCard, { ...props, selectedVocal: null });
  expect(screen.getByText("No preview")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
});
