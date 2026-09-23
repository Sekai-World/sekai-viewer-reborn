<script lang="ts">
  import Icon from "@iconify/svelte";
  import { SvelteSet } from "svelte/reactivity";
  import {
    AudioPlayer,
    ImagePreviewDialog,
    ImagePreviewTrigger,
    VoicePlayButton
  } from "@platform/ui-shell";
  import { localCharacterAvatarUrl } from "$lib/story/character-avatar";

  /**
   * Script-style (台本) rendering of flattened scenario rows. All labels are
   * resolved by the hosting route; rows carry fully resolved media URLs.
   */
  export interface StoryTextRowView {
    kind: "background" | "bgm" | "se" | "talk" | "fullscreen-text" | "telop" | "movie";
    name?: string;
    body?: string;
    imageUrl?: string;
    url?: string;
    urls?: string[];
    voiceUrls?: string[];
    fallbackUrl?: string;
    loop?: boolean;
    stop?: boolean;
    monologue?: boolean;
    text?: string;
    /** Speaker's game character id (1-26) for the local bust; mob/sub rows omit it. */
    characterId?: number;
  }

  interface Props {
    rows: StoryTextRowView[];
    labels: {
      voicePlay: string;
      voiceStop: string;
      voiceUnavailable: string;
      backgroundLabel: string;
      showBackground: string;
      bgmLabel: string;
      seLabel: string;
      seStopLabel: string;
      fullscreenLabel: string;
      movieLabel: string;
      previewClose: string;
      previewDownload: string;
      previewOpenInNewWindow: string;
      audioPlay: string;
      audioPause: string;
      audioDownload: string;
      audioDownloadClose: string;
      audioVolume: string;
      audioSeek: string;
      audioUnavailable: string;
      audioDownloadPreparing: string;
      audioDownloadFetchingAudio: string;
      audioDownloadFetchingCover: string;
      audioDownloadWritingMetadata: string;
      audioDownloadFinalizing: string;
      audioDownloadReady: string;
      audioDownloadFailed: string;
      audioDownloadCancelled: string;
    };
  }

  let { rows, labels }: Props = $props();

  let previewOpen = $state(false);
  let previewSrc = $state("");
  let previewAlt = $state("");

  // Background images stay unloaded until revealed row by row; the set holds
  // the indexes the user has explicitly expanded.
  const revealedBackgrounds = new SvelteSet<number>();

  const openBackgroundPreview = (row: StoryTextRowView): void => {
    if (!row.imageUrl) return;
    previewSrc = row.imageUrl;
    previewAlt = row.name ?? labels.backgroundLabel;
    previewOpen = true;
  };
</script>

<ol class="flex flex-col gap-3">
  {#each rows as row, index (index)}
    <li>
      {#if row.kind === "talk"}
        <article class="card bg-base-100 shadow-sm ring-1 ring-base-content/10">
          <div class="card-body gap-2 p-4">
            <!-- Name + body form their own column so the tall voice button
                 centers against the whole block instead of stretching the
                 name row. -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 flex-col items-start gap-2">
                <div class="flex items-center gap-1.5">
                  {#if row.characterId}
                    {@const avatarUrl = localCharacterAvatarUrl(row.characterId)}
                    {#if avatarUrl}
                      <img
                        src={avatarUrl}
                        alt=""
                        loading="lazy"
                        class="size-6 shrink-0 rounded-full object-cover object-top"
                      />
                    {/if}
                  {/if}
                  <span class="badge badge-outline badge-primary">{row.name}</span>
                </div>
                <p class="text-base/7 whitespace-pre-wrap" class:italic={row.monologue}>
                  {row.body}
                </p>
              </div>
              {#if row.voiceUrls && row.voiceUrls.length > 0}
                <VoicePlayButton
                  sources={row.voiceUrls}
                  playLabel={labels.voicePlay}
                  stopLabel={labels.voiceStop}
                  errorLabel={labels.voiceUnavailable}
                />
              {/if}
            </div>
          </div>
        </article>
      {:else if row.kind === "background"}
        <figure class="overflow-hidden rounded-xl border border-base-content/10">
          <figcaption
            class="flex items-center gap-1 bg-base-200/60 px-3 py-2 text-xs text-base-content/60"
          >
            <Icon icon="mdi:image-outline" class="size-4" aria-hidden="true" />
            {labels.backgroundLabel}
          </figcaption>
          {#if row.imageUrl && revealedBackgrounds.has(index)}
            <ImagePreviewTrigger
              src={row.imageUrl}
              alt={row.name ?? labels.backgroundLabel}
              ariaLabel={labels.backgroundLabel}
              imageClass="max-h-72 w-full bg-base-200/40 object-contain"
              onclick={() => openBackgroundPreview(row)}
            />
          {:else if row.imageUrl}
            <button
              type="button"
              class="flex w-full items-center justify-center gap-1.5 bg-base-200/40 p-3 text-xs font-semibold text-base-content/60 outline-none transition-colors hover:bg-base-200/70 hover:text-base-content focus-visible:ring-2 focus-visible:ring-primary/60"
              onclick={() => revealedBackgrounds.add(index)}
            >
              <Icon icon="mdi:image-outline" class="size-4" aria-hidden="true" />
              {labels.showBackground}
            </button>
          {/if}
        </figure>
      {:else if row.kind === "bgm"}
        <div class="rounded-xl border border-base-content/10 bg-base-100 px-3 py-2">
          <div class="flex items-center gap-1.5">
            <Icon
              icon="mdi:music-note-outline"
              class="size-4 text-base-content/60"
              aria-hidden="true"
            />
            <span class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
              {labels.bgmLabel}
            </span>
          </div>
          {#if row.url}
            <div class="mt-1">
              <AudioPlayer
                src={row.url}
                title={row.name ?? labels.bgmLabel}
                downloadProgressMessages={{
                  preparing: labels.audioDownloadPreparing,
                  fetchingAudio: labels.audioDownloadFetchingAudio,
                  fetchingCover: labels.audioDownloadFetchingCover,
                  writingMetadata: labels.audioDownloadWritingMetadata,
                  finalizing: labels.audioDownloadFinalizing,
                  ready: labels.audioDownloadReady,
                  failed: labels.audioDownloadFailed,
                  cancelled: labels.audioDownloadCancelled
                }}
                playLabel={labels.audioPlay}
                pauseLabel={labels.audioPause}
                downloadLabel={labels.audioDownload}
                downloadCloseLabel={labels.audioDownloadClose}
                volumeLabel={labels.audioVolume}
                seekLabel={labels.audioSeek}
                unavailableLabel={labels.audioUnavailable}
              />
            </div>
          {/if}
        </div>
      {:else if row.kind === "se"}
        <div
          class="flex items-center gap-2 rounded-xl border border-base-content/10 bg-base-100 px-3 py-2"
        >
          <Icon
            icon="mdi:music-note-outline"
            class="size-4 text-base-content/60"
            aria-hidden="true"
          />
          <span class="text-sm text-base-content/70">
            {row.stop === true ? labels.seStopLabel : labels.seLabel}
          </span>
          {#if row.urls && !row.stop && row.urls.length > 0}
            <VoicePlayButton
              sources={row.urls}
              loop={row.loop === true}
              playLabel={labels.voicePlay}
              stopLabel={labels.voiceStop}
              errorLabel={labels.voiceUnavailable}
            />
          {/if}
        </div>
      {:else if row.kind === "fullscreen-text"}
        <blockquote class="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-col gap-1">
              <span
                class="text-[0.65rem] font-semibold tracking-wide text-base-content/50 uppercase"
              >
                {labels.fullscreenLabel}
              </span>
              <p class="text-base/7 font-semibold whitespace-pre-wrap">{row.text}</p>
            </div>
            {#if row.voiceUrls && row.voiceUrls.length > 0}
              <VoicePlayButton
                sources={row.voiceUrls}
                playLabel={labels.voicePlay}
                stopLabel={labels.voiceStop}
                errorLabel={labels.voiceUnavailable}
              />
            {/if}
          </div>
        </blockquote>
      {:else if row.kind === "telop"}
        <p class="text-center text-sm/6 font-semibold text-base-content/70">{row.text}</p>
      {:else if row.kind === "movie"}
        <div
          class="flex items-center gap-2 rounded-xl border border-base-content/10 bg-base-100 px-3 py-2"
        >
          <Icon
            icon="mdi:movie-open-outline"
            class="size-4 text-base-content/60"
            aria-hidden="true"
          />
          {#if row.fallbackUrl}
            <a
              class="link link-hover text-sm text-primary"
              href={row.fallbackUrl}
              target="_blank"
              rel="noreferrer"
            >
              {labels.movieLabel}
            </a>
          {:else}
            <span class="text-sm text-base-content/70">{labels.movieLabel}</span>
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ol>

<ImagePreviewDialog
  bind:open={previewOpen}
  src={previewSrc}
  alt={previewAlt}
  closeLabel={labels.previewClose}
  downloadLabel={labels.previewDownload}
  openInNewWindowLabel={labels.previewOpenInNewWindow}
/>
