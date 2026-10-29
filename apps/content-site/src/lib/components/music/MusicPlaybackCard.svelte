<script lang="ts">
  import { tick, untrack } from "svelte";
  import Icon from "@iconify/svelte";
  import type { SupportedRegion } from "#lib/domain/regions.js";
  import type { MusicDetail } from "#lib/domain/music-detail.js";
  import { getMusicAssetServer } from "#lib/assets/index.js";
  import MusicMvPlayer from "#lib/components/music/MusicMvPlayer.svelte";
  import MusicPreviewCard from "#lib/components/music/MusicPreviewCard.svelte";
  import MusicVocalSelector from "#lib/components/music/MusicVocalSelector.svelte";

  type PlaybackMode = "audio" | "mv";
  type PreviewMode = "short" | "long";
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

  let {
    music,
    region,
    availableRegions,
    musicId,
    title,
    vocalLabel,
    audioLabel,
    musicVideoLabel,
    vocalTypeLabel,
    vocalCharacterLabel,
    lockedVocalLabel,
    noVocalsLabel,
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
    variantLabel,
    originalLabel,
    mv2dLabel,
    duplicateLabel,
    loadingLabel,
    retryLabel,
    noVideoLabel,
    unsupportedLabel,
    audioUnavailableLabel,
    jacketUrl,
    artist,
    pauseToken = 0,
    onPlayback
  }: {
    music: MusicDetail;
    region: SupportedRegion;
    availableRegions: SupportedRegion[];
    musicId: string;
    title: string;
    vocalLabel: string;
    audioLabel: string;
    musicVideoLabel: string;
    vocalTypeLabel: string;
    vocalCharacterLabel: string;
    lockedVocalLabel: string;
    noVocalsLabel: string;
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
    variantLabel: string;
    originalLabel: string;
    mv2dLabel: string;
    duplicateLabel: string;
    loadingLabel: string;
    retryLabel: string;
    noVideoLabel: string;
    unsupportedLabel: string;
    audioUnavailableLabel: string;
    jacketUrl?: string;
    artist?: string;
    pauseToken?: number;
    onPlayback?: () => void;
  } = $props();

  const descriptors = $derived(music.musicVideos ?? []);
  const vocals = $derived(music.vocals ?? []);
  const vocalsWithAssets = $derived(
    vocals.filter((vocal) => vocal.assetBundleName && vocal.assetBundleName.trim().length > 0)
  );

  let activeMode = $state<PlaybackMode>("audio");
  let selectedVocalId = $state(
    untrack(() => music.vocals.find((vocal) => vocal.assetBundleName?.trim())?.id ?? "")
  );
  let selectedDescriptorIndex = $state(0);
  let selectionMusicId = $state(untrack(() => `${region}:${musicId}`));
  let previewMode = $state<PreviewMode>("long");
  let outputElement: HTMLDivElement;
  let outputAnimation: Animation | undefined;
  let modeChangeVersion = 0;

  function observeOutput(element: HTMLDivElement) {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const stopAnimation = () => {
      modeChangeVersion += 1;
      outputAnimation?.cancel();
      outputAnimation = undefined;
    };
    let width = element.getBoundingClientRect().width;
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            const nextWidth = element.getBoundingClientRect().width;
            if (nextWidth !== width) stopAnimation();
            width = nextWidth;
          });
    observer?.observe(element);
    motion?.addEventListener("change", stopAnimation);
    return {
      destroy() {
        stopAnimation();
        observer?.disconnect();
        motion?.removeEventListener("change", stopAnimation);
      }
    };
  }

  async function selectMode(mode: PlaybackMode): Promise<void> {
    if (mode === activeMode) return;
    const from = outputElement.getBoundingClientRect().height;
    const version = ++modeChangeVersion;
    outputAnimation?.cancel();
    outputAnimation = undefined;
    // Swap presenters immediately; only the surrounding output size is animated.
    activeMode = mode;
    await tick();
    if (
      version !== modeChangeVersion ||
      activeMode !== mode ||
      !outputElement.animate ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.hasAttribute("data-low-motion")
    )
      return;
    const to = outputElement.getBoundingClientRect().height;
    if (from === to) return;
    outputAnimation = outputElement.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 180,
      easing: "ease-out"
    });
  }

  const selectedDescriptor = $derived(descriptors[selectedDescriptorIndex] ?? null);
  const lockedVocalId = $derived(
    activeMode === "mv" ? (selectedDescriptor?.musicVocalId ?? null) : null
  );
  const selectedVocal = $derived(
    vocalsWithAssets.find((vocal) => vocal.id === selectedVocalId) ?? null
  );
  const hasMusicVideo = $derived(descriptors.length > 0);
  const audioServer = $derived(getMusicAssetServer(region, availableRegions));
  const descriptorOptions = $derived(
    descriptors.map((descriptor, index) => {
      const categoryLabel = descriptor.category === "original" ? originalLabel : mv2dLabel;
      const duplicateNumber = descriptors
        .slice(0, index)
        .filter((item) => item.category === descriptor.category).length;
      return {
        value: String(index),
        label:
          duplicateNumber > 0
            ? `${categoryLabel} ${duplicateLabel} ${duplicateNumber + 1}`
            : categoryLabel
      };
    })
  );

  $effect(() => {
    if (selectionMusicId !== `${region}:${musicId}`) {
      selectionMusicId = `${region}:${musicId}`;
      activeMode = "audio";
      selectedVocalId = "";
      selectedDescriptorIndex = 0;
      previewMode = "long";
    }

    if (descriptors.length === 0) {
      activeMode = "audio";
      selectedDescriptorIndex = 0;
    }

    if (descriptors.length > 0 && selectedDescriptorIndex >= descriptors.length) {
      selectedDescriptorIndex = 0;
    }

    const descriptor = descriptors[selectedDescriptorIndex];
    if (activeMode === "mv" && descriptor?.musicVocalId) {
      selectedVocalId = vocalsWithAssets.some((vocal) => vocal.id === descriptor.musicVocalId)
        ? descriptor.musicVocalId
        : "";
    } else if (!vocalsWithAssets.some((vocal) => vocal.id === selectedVocalId)) {
      selectedVocalId = vocalsWithAssets[0]?.id ?? "";
    }
  });

  function selectVocal(id: string): void {
    if (lockedVocalId || !vocalsWithAssets.some((vocal) => vocal.id === id)) return;
    selectedVocalId = id;
  }

  function selectDescriptor(index: number): void {
    const descriptor = descriptors[index];
    if (!descriptor) return;
    selectedDescriptorIndex = index;
    if (descriptor.musicVocalId) {
      selectedVocalId = vocalsWithAssets.some((vocal) => vocal.id === descriptor.musicVocalId)
        ? descriptor.musicVocalId
        : "";
    } else if (!vocalsWithAssets.some((vocal) => vocal.id === selectedVocalId)) {
      selectedVocalId = vocalsWithAssets[0]?.id ?? "";
    }
  }
</script>

<article class="card content-card-shell shadow-sm" data-testid="music-playback-card">
  <div class="card-body gap-3 p-3 sm:p-4">
    <header
      data-testid="music-playback-header"
      class="grid min-w-0 grid-cols-1 grid-rows-[1.5rem_2.75rem] items-center gap-2 border-b border-(--archive-border-subtle) pb-3 sm:h-14 sm:grid-cols-[minmax(0,1fr)_13rem] sm:grid-rows-1 sm:gap-3"
    >
      <h2 class="flex min-w-0 items-center gap-1.5 text-base font-semibold">
        <Icon
          icon={activeMode === "audio" ? "mdi:music-note-outline" : "mdi:eye-outline"}
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <span class="truncate" title={activeMode === "audio" ? audioLabel : musicVideoLabel}
          >{activeMode === "audio" ? audioLabel : musicVideoLabel}</span
        >
      </h2>
      <div
        class="join flex w-full min-w-0"
        role="group"
        aria-label={hasMusicVideo ? `${audioLabel} / ${musicVideoLabel}` : audioLabel}
      >
        <button
          type="button"
          class="btn btn-sm join-item min-h-11 min-w-0 flex-1 basis-0"
          title={audioLabel}
          class:btn-primary={activeMode === "audio"}
          class:btn-ghost={activeMode !== "audio"}
          aria-pressed={activeMode === "audio"}
          onclick={() => selectMode("audio")}
        >
          <span class="truncate">{audioLabel}</span>
        </button>
        {#if hasMusicVideo}
          <button
            type="button"
            class="btn btn-sm join-item min-h-11 min-w-0 flex-1 basis-0"
            title={musicVideoLabel}
            class:btn-primary={activeMode === "mv"}
            class:btn-ghost={activeMode !== "mv"}
            aria-pressed={activeMode === "mv"}
            onclick={() => selectMode("mv")}
          >
            <span class="truncate">{musicVideoLabel}</span>
          </button>
        {/if}
      </div>
    </header>

    <div
      data-testid="music-playback-vocal-toolbar"
      class="flex h-14 min-w-0 items-center gap-2 border-b border-(--archive-border-subtle)"
    >
      <MusicVocalSelector
        {vocals}
        {selectedVocalId}
        {lockedVocalId}
        {vocalLabel}
        {vocalTypeLabel}
        {vocalCharacterLabel}
        {lockedVocalLabel}
        {noVocalsLabel}
        onSelect={selectVocal}
      />
      <div
        data-testid="music-playback-mode-toolbar"
        class="flex h-11 w-28 shrink-0 items-center sm:w-36"
      >
        {#if activeMode === "mv" && descriptors.length > 1}
          <label class="block w-full">
            <span class="sr-only">{variantLabel}</span>
            <select
              class="select min-h-11 w-full"
              aria-label={variantLabel}
              value={selectedDescriptorIndex}
              onchange={(event) => selectDescriptor(Number(event.currentTarget.value))}
            >
              {#each descriptorOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
        {:else}
          <label
            class="flex min-h-11 w-full cursor-pointer items-center justify-end gap-1 text-xs"
            class:cursor-default={activeMode === "mv"}
          >
            <span class="min-w-0 max-w-10 truncate text-right" title={shortPreviewLabel}
              >{shortPreviewLabel}</span
            >
            <input
              type="checkbox"
              role="switch"
              class="toggle toggle-primary toggle-sm shrink-0"
              aria-label={`${shortPreviewLabel} / ${longPreviewLabel}`}
              checked={previewMode === "long"}
              disabled={activeMode === "mv"}
              onchange={(event) => (previewMode = event.currentTarget.checked ? "long" : "short")}
            />
            <span class="min-w-0 max-w-10 truncate" title={longPreviewLabel}
              >{longPreviewLabel}</span
            >
          </label>
        {/if}
      </div>
    </div>

    <div
      bind:this={outputElement}
      use:observeOutput
      data-testid="music-playback-output"
      class="w-full min-w-0 overflow-visible rounded-xl bg-(--archive-surface-sunken) {activeMode ===
      'mv'
        ? 'h-44 sm:h-52 lg:h-[640px]'
        : ''}"
    >
      {#if activeMode === "audio"}
        <MusicPreviewCard
          embedded
          showPreviewControls={false}
          {previewMode}
          {pauseToken}
          {onPlayback}
          {selectedVocal}
          {region}
          {availableRegions}
          {musicId}
          {title}
          {shortPreviewLabel}
          {longPreviewLabel}
          {noPreviewAvailableLabel}
          {downloadProgressMessages}
          {playLabel}
          {pauseLabel}
          {downloadLabel}
          {downloadCloseLabel}
          {volumeLabel}
          {seekLabel}
          {unavailableLabel}
          {jacketUrl}
          {artist}
          fillerSec={music.fillerSec}
        />
      {:else}
        <MusicMvPlayer
          embedded
          showVariantControl={false}
          {pauseToken}
          {onPlayback}
          {descriptors}
          {selectedDescriptor}
          {selectedDescriptorIndex}
          onDescriptorChange={selectDescriptor}
          {selectedVocal}
          {audioServer}
          poster={jacketUrl}
          {title}
          videoLabel={musicVideoLabel}
          {variantLabel}
          {originalLabel}
          {mv2dLabel}
          {duplicateLabel}
          {loadingLabel}
          {retryLabel}
          {noVideoLabel}
          {unsupportedLabel}
          {audioUnavailableLabel}
        />
      {/if}
    </div>
  </div>
</article>
