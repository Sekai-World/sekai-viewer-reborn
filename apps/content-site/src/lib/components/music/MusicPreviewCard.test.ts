import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MusicPreviewCard from "./MusicPreviewCard.svelte";

vi.mock("$env/dynamic/public", () => ({ env: { PUBLIC_REMOTE_ASSET_BASE_URL: "/storage" } }));
vi.mock("$app/paths", () => ({ resolve: (path: string) => path }));
const howler = vi.hoisted(() => ({ unload: vi.fn(), created: vi.fn() }));
vi.mock("../../../../../../packages/ui-shell/node_modules/howler", () => ({
  Howl: class {
    constructor() {
      howler.created();
    }
    unload = howler.unload;
    playing = () => false;
    duration = () => 120;
    seek = () => 0;
    volume = () => 1;
  }
}));

const props = {
  vocals: [
    {
      id: "1",
      musicId: "8",
      vocalType: "Original",
      assetBundleName: "v1",
      characters: null,
      overrideChara: null
    }
  ],
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
