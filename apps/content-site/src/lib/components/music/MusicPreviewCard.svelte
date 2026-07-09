<script lang="ts">
  import type { MusicVocal } from "$lib/domain/music-detail";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import {
    getMusicAssetServer,
    getMusicLongPreviewAssetURL,
    getMusicShortPreviewAssetURL
  } from "$lib/assets/index";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import { AudioPlayer } from "@platform/ui-shell";
  import Icon from "@iconify/svelte";

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
    vocals,
    region,
    availableRegions,
    musicId,
    title,
    vocalLabel,
    vocalTypeLabel,
    vocalCharacterLabel,
    noVocalsLabel,
    shortPreviewLabel,
    longPreviewLabel,
    noPreviewAvailableLabel: _noPreviewAvailableLabel,
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
    vocals: MusicVocal[];
    region: SupportedRegion;
    availableRegions: SupportedRegion[];
    musicId: string;
    title: string;
    vocalLabel: string;
    vocalTypeLabel: string;
    vocalCharacterLabel: string;
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
    jacketUrl?: string;
    artist?: string;
    fillerSec?: number | null;
  } = $props();

  const vocalsWithAssets = $derived(
    vocals.filter((v) => v.assetBundleName && v.assetBundleName.trim().length > 0)
  );

  let selectedVocalId = $state<string>("");

  const selectedVocal = $derived(
    vocalsWithAssets.find((v) => v.id === selectedVocalId) ?? vocalsWithAssets[0] ?? null
  );

  $effect(() => {
    if (selectedVocalId === "" && vocalsWithAssets[0]) {
      selectedVocalId = vocalsWithAssets[0].id;
    }
  });

  let previewMode = $state<PreviewMode>("long");

  const buildPreviewURL = (vocal: MusicVocal, mode: PreviewMode): string => {
    const name = vocal.assetBundleName!;
    const server = getMusicAssetServer(region, availableRegions);
    return mode === "short"
      ? getMusicShortPreviewAssetURL(name, server)
      : getMusicLongPreviewAssetURL(name, server);
  };

  const currentSrc = $derived(
    selectedVocal ? buildPreviewURL(selectedVocal, previewMode) : null
  );

  const subtitle = $derived(selectedVocal?.vocalType ?? "");

  // When playing the full (long) preview, skip the filler silence at the start.
  // fillerSec is a music-level field from the API, not per-vocal.
  // Short previews don't have filler, so offset is always 0 for them.
  const currentOffset = $derived(
    previewMode === "long" && fillerSec != null && fillerSec > 0
      ? fillerSec
      : 0
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

  function selectVocal(id: string): void {
    selectedVocalId = id;
  }

  function onPreviewModeChange(mode: PreviewMode): void {
    previewMode = mode;
  }

  const getCharacters = (vocal: MusicVocal): { characterId: number; unit: string }[] =>
    vocal.overrideChara ?? vocal.characters ?? [];
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon
        icon="mdi:microphone-variant"
        class="size-4 shrink-0 translate-y-[0.5px]"
        aria-hidden="true"
      />
      <span>{vocalLabel}</span>
    </p>

    {#if vocals.length === 0}
      <p class="text-sm opacity-60">{noVocalsLabel}</p>
    {:else}
      <div class="space-y-2">
        {#each vocals as vocal (vocal.id)}
          {@const isSelected = vocal.id === selectedVocal?.id}
          {@const hasAsset = !!vocal.assetBundleName?.trim()}
          {@const chars = getCharacters(vocal)}
          <button
            class="content-card-inset flex w-full items-center gap-3 rounded-xl p-3 sm:px-4 text-left transition-colors {isSelected && hasAsset ? 'ring-1 ring-primary bg-primary/5' : 'hover:bg-base-content/5'}"
            onclick={() => selectVocal(vocal.id)}
            disabled={!hasAsset}
          >
            <div class="min-w-0 flex-1">
              {#if vocal.vocalType}
                <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                  {vocalTypeLabel}
                </p>
                <p class="mt-0.5 text-sm font-medium">{vocal.vocalType}</p>
              {/if}
              {#if chars.length > 0}
                <p class="mt-1 text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                  {vocalCharacterLabel}
                </p>
                <div class="mt-0.5 flex flex-wrap gap-1.5">
                  {#each chars as char (char.characterId)}
                    <CharacterAvatar
                      src={getLocalCharacterThumbnailAssetURL(char.characterId)}
                      label={String(char.characterId)}
                      characterId={char.characterId}
                      variant="xs"
                    />
                  {/each}
                </div>
              {/if}
            </div>
            {#if hasAsset}
              <Icon
                icon={isSelected ? "mdi:chevron-up" : "mdi:chevron-down"}
                class="size-5 shrink-0 opacity-40"
                aria-hidden="true"
              />
            {/if}
          </button>

          {#if isSelected && hasAsset}
            <div class="space-y-3 pl-1">
              <!-- Preview mode toggle -->
              <div class="flex gap-2">
                <button
                  class="btn btn-sm flex-1 {previewMode === 'short' ? 'btn-primary' : 'btn-ghost border border-base-content/15'}"
                  onclick={() => onPreviewModeChange("short")}
                >
                  <Icon icon="mdi:music-note-eighth" class="size-4" aria-hidden="true" />
                  {shortPreviewLabel}
                </button>
                <button
                  class="btn btn-sm flex-1 {previewMode === 'long' ? 'btn-primary' : 'btn-ghost border border-base-content/15'}"
                  onclick={() => onPreviewModeChange("long")}
                >
                  <Icon icon="mdi:music-note-quarter" class="size-4" aria-hidden="true" />
                  {longPreviewLabel}
                </button>
              </div>

              <!-- Audio player with download options -->
              <div class="content-card-inset rounded-xl p-3 sm:p-4">
                <AudioPlayer
                  src={currentSrc}
                  title={title}
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
                  artist={artist}
                />
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</article>
