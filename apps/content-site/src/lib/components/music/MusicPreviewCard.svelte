<script lang="ts">
  import type { MusicVocal } from "#lib/domain/music-detail.js";
  import type { SupportedRegion } from "#lib/domain/regions.js";
  import {
    getMusicAssetServer,
    getMusicLongPreviewAssetURL,
    getMusicShortPreviewAssetURL
  } from "#lib/assets/index.js";
  import { AudioPlayer } from "@platform/ui-shell";

  type DownloadProgressMessages = {
    preparing: string;
    fetchingAudio: string;
    fetchingCover: string;
    writingMetadata: string;
    finalizing: string;
    ready: string;
    failed: string;
    cancelled: string;
  };

  type PreviewMode = "short" | "long";
  type AudioFormat = "mp3" | "flac" | "wav";

  const AUDIO_FORMATS: AudioFormat[] = ["mp3", "flac", "wav"];

  let {
    selectedVocal,
    embedded = false,
    previewMode: previewModeProp,
    onPreviewModeChange,
    showPreviewControls = true,
    pauseToken = 0,
    onPlayback,
    region,
    availableRegions,
    musicId,
    title,
    shortPreviewLabel,
    longPreviewLabel,
    noPreviewAvailableLabel,
    downloadProgressMessages,
    playLabel,
    pauseLabel,
    downloadLabel,
    downloadCloseLabel,
    volumeLabel,
    seekLabel,
    unavailableLabel,
    jacketUrl,
    artist,
    fillerSec
  }: {
    selectedVocal: MusicVocal | null;
    embedded?: boolean;
    previewMode?: PreviewMode;
    onPreviewModeChange?: (mode: PreviewMode) => void;
    showPreviewControls?: boolean;
    pauseToken?: number;
    onPlayback?: () => void;
    region: SupportedRegion;
    availableRegions: SupportedRegion[];
    musicId: string;
    title: string;
    shortPreviewLabel: string;
    longPreviewLabel: string;
    noPreviewAvailableLabel: string;
    downloadProgressMessages: DownloadProgressMessages;
    playLabel: string;
    pauseLabel: string;
    downloadLabel: string;
    downloadCloseLabel: string;
    volumeLabel: string;
    seekLabel: string;
    unavailableLabel: string;
    jacketUrl?: string;
    artist?: string;
    fillerSec?: number | null;
  } = $props();

  let internalPreviewMode = $state<PreviewMode>("long");
  const previewMode = $derived(previewModeProp ?? internalPreviewMode);

  function setPreviewMode(mode: PreviewMode): void {
    internalPreviewMode = mode;
    onPreviewModeChange?.(mode);
  }

  const buildPreviewURL = (vocal: MusicVocal, mode: PreviewMode): string => {
    const name = vocal.assetBundleName!;
    const server = getMusicAssetServer(region, availableRegions);
    return mode === "short"
      ? getMusicShortPreviewAssetURL(name, server)
      : getMusicLongPreviewAssetURL(name, server);
  };

  const currentSrc = $derived(selectedVocal ? buildPreviewURL(selectedVocal, previewMode) : null);
  const subtitle = $derived(selectedVocal?.vocalType ?? "");
  const currentOffset = $derived(
    previewMode === "long" && fillerSec != null && fillerSec > 0 ? fillerSec : 0
  );

  const getDownloadName = (format: AudioFormat): string =>
    `${musicId}-${region}-${selectedVocal?.id ?? "vocal"}-${previewMode}.${format}`;

  const downloadHref = (format: AudioFormat): string => {
    const params = new URLSearchParams({
      format,
      vocalId: selectedVocal?.id ?? "",
      mode: previewMode === "short" ? "short" : "long"
    });
    return `/music/${region}/${musicId}/download?${params}`;
  };

  const progressHref = $derived(`/music/${region}/${musicId}/download/progress`);
  const downloadOptions = $derived(
    selectedVocal
      ? AUDIO_FORMATS.map((format) => ({
          label: format.toUpperCase(),
          href: downloadHref(format),
          progressHref,
          downloadName: getDownloadName(format)
        }))
      : []
  );

  function coordinatePlayback(event: MouseEvent): void {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button?.getAttribute("aria-label") === playLabel) onPlayback?.();
  }
</script>

<svelte:element
  this={embedded ? "section" : "article"}
  class={embedded ? "flex flex-col gap-3" : "card content-card-shell shadow-sm"}
>
  <div class={embedded ? "flex flex-col gap-3" : "card-body gap-4 p-3 sm:p-5"}>
    {#if !selectedVocal}
      <p
        class="flex h-full items-center justify-center rounded-lg border border-(--archive-border-subtle) p-3 text-center text-sm opacity-60"
      >
        {noPreviewAvailableLabel}
      </p>
    {:else}
      {#if showPreviewControls}
        <div class="flex min-h-11 flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm min-h-11 flex-1 {previewMode === 'short'
              ? 'btn-primary'
              : 'btn-ghost border border-base-content/15'}"
            aria-pressed={previewMode === "short"}
            onclick={() => setPreviewMode("short")}
          >
            {shortPreviewLabel}
          </button>
          <button
            type="button"
            class="btn btn-sm min-h-11 flex-1 {previewMode === 'long'
              ? 'btn-primary'
              : 'btn-ghost border border-base-content/15'}"
            aria-pressed={previewMode === "long"}
            onclick={() => setPreviewMode("long")}
          >
            {longPreviewLabel}
          </button>
        </div>
      {/if}

      <div
        class={embedded ? "min-h-0 w-full p-3 sm:p-4" : "content-card-inset rounded-xl p-3 sm:p-4"}
        onclickcapture={coordinatePlayback}
      >
        {#key pauseToken}
          <AudioPlayer
            src={currentSrc}
            {title}
            {subtitle}
            {downloadOptions}
            downloadName={getDownloadName("mp3")}
            offset={currentOffset}
            {downloadProgressMessages}
            {playLabel}
            {pauseLabel}
            {downloadLabel}
            {downloadCloseLabel}
            {volumeLabel}
            {seekLabel}
            {unavailableLabel}
            artworkUrl={jacketUrl}
            {artist}
          />
        {/key}
      </div>
    {/if}
  </div>
</svelte:element>
