<script lang="ts">
  import { untrack } from "svelte";
  import type { MusicOriginal } from "$lib/domain/music-detail";
  import { getMusicYoutubeReferences } from "$lib/domain/music-youtube";

  let {
    originals,
    songKey,
    songTitle,
    heading,
    openLabel,
    loadLabel,
    privacyLabel,
    selectionLabel,
    referenceLabel,
    closeLabel,
    unloadToken = 0,
    onEmbedOpen
  }: {
    originals: MusicOriginal[];
    songKey: string;
    songTitle: string;
    heading: string;
    openLabel: string;
    loadLabel: string;
    privacyLabel: string;
    selectionLabel: string;
    referenceLabel: string;
    closeLabel: string;
    unloadToken?: number;
    onEmbedOpen?: () => void;
  } = $props();

  const references = $derived(getMusicYoutubeReferences(originals));
  let selectedId = $state("");
  let loadedId = $state<string | null>(null);
  const selected = $derived(
    references.find((item) => item.videoId === selectedId) ?? references[0]
  );

  $effect.pre(() => {
    void songKey;
    void originals;
    untrack(() => {
      selectedId = "";
      loadedId = null;
    });
  });

  $effect.pre(() => {
    void unloadToken;
    untrack(() => {
      loadedId = null;
    });
  });

  function loadEmbed(): void {
    if (!selected) return;
    onEmbedOpen?.();
    loadedId = selected.videoId;
  }
</script>

{#if selected}
  <article class="card content-card-shell min-w-0">
    <div class="card-body gap-4 p-3 sm:p-5">
      <h2 class="text-xs font-semibold uppercase tracking-[0.18em] text-(--archive-text-muted)">
        {heading}
      </h2>
      {#if references.length > 1}
        <label class="flex flex-col gap-1 text-sm font-semibold">
          <span>{selectionLabel}</span>
          <select
            class="select min-h-11 w-full"
            value={selected.videoId}
            onchange={(event) => {
              loadedId = null;
              selectedId = event.currentTarget.value;
            }}
          >
            {#each references as reference, index (reference.videoId)}
              <option value={reference.videoId}>{referenceLabel} {index + 1}</option>
            {/each}
          </select>
        </label>
      {/if}
      <div class="flex flex-wrap items-center gap-2">
        <a
          class="btn btn-outline min-h-11 h-auto py-2"
          href={selected.watchUrl}
          target="_blank"
          rel="noopener noreferrer">{openLabel}</a
        >
        {#if loadedId === selected.videoId}
          <button
            type="button"
            class="btn btn-ghost min-h-11 h-auto py-2"
            onclick={() => {
              loadedId = null;
            }}>{closeLabel}</button
          >
        {:else}
          <button type="button" class="btn btn-ghost min-h-11 h-auto py-2" onclick={loadEmbed}
            >{loadLabel}</button
          >
        {/if}
      </div>
      {#if loadedId === selected.videoId}
        <iframe
          class="content-card-inset aspect-video w-full rounded-xl border-0"
          src={selected.embedUrl}
          title={`${songTitle} — ${heading}`}
          allow="encrypted-media; fullscreen; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      {:else}
        <p class="text-sm text-(--archive-text-muted)">{privacyLabel}</p>
      {/if}
    </div>
  </article>
{/if}
