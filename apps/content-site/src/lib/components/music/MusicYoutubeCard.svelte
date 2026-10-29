<script lang="ts">
  import { untrack } from "svelte";
  import Icon from "@iconify/svelte";
  import type { MusicOriginal } from "#lib/domain/music-detail.js";
  import { getMusicVideoReferences } from "#lib/domain/music-youtube.js";

  let {
    originals,
    songKey,
    songTitle,
    openLabel,
    previewLabel,
    selectionLabel,
    closeLabel,
    unloadToken = 0,
    onEmbedOpen
  }: {
    originals: MusicOriginal[];
    songKey: string;
    songTitle: string;
    openLabel: string;
    previewLabel: string;
    selectionLabel: string;
    closeLabel: string;
    unloadToken?: number;
    onEmbedOpen?: () => void;
  } = $props();

  const references = $derived(getMusicVideoReferences(originals));
  let selectedId = $state("");
  let previewId = $state<string | null>(null);
  let dialogOpen = $state(false);
  let dialog: HTMLDialogElement | null = $state(null);
  const selected = $derived(references.find((item) => item.id === selectedId) ?? references[0]);
  const dialogTitleId = $derived(`music-video-dialog-${songKey}`);

  $effect.pre(() => {
    void songKey;
    void originals;
    untrack(() => {
      selectedId = "";
      closePreview();
    });
  });

  $effect.pre(() => {
    void unloadToken;
    untrack(() => {
      closePreview();
    });
  });

  function closePreview(): void {
    previewId = null;
    dialogOpen = false;
    if (dialog?.open && typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog?.removeAttribute("open");
    }
  }

  function openPreview(): void {
    if (!selected?.embedUrl) return;
    onEmbedOpen?.();
    previewId = selected.id;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }
    dialogOpen = true;
  }

  function selectReference(referenceId: string): void {
    closePreview();
    selectedId = referenceId;
  }

  function handleDialogClose(): void {
    previewId = null;
    dialogOpen = false;
  }
</script>

{#if selected}
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    <div class="min-w-0 flex-1">
      {#if references.length > 1}
        <label class="block min-w-0 max-w-full">
          <span class="sr-only">{selectionLabel}</span>
          <select
            class="select min-h-11 max-w-full min-w-0 font-semibold"
            aria-label={selectionLabel}
            value={selected.id}
            onchange={(event) => selectReference(event.currentTarget.value)}
          >
            {#each references as reference (reference.id)}
              <option value={reference.id}>{reference.sourceLabel}</option>
            {/each}
          </select>
        </label>
      {:else}
        <span class="block max-w-48 truncate text-sm font-semibold" title={selected.sourceLabel}
          >{selected.sourceLabel}</span
        >
      {/if}
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <a
        class="btn btn-square btn-ghost min-h-11 min-w-11"
        href={selected.watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${openLabel}: ${selected.sourceLabel}`}
        title={`${openLabel}: ${selected.sourceLabel}`}
      >
        <Icon icon="mdi:open-in-new" class="size-5" aria-hidden="true" />
      </a>
      {#if selected.embedUrl}
        <button
          type="button"
          class="btn btn-square btn-ghost min-h-11 min-w-11"
          aria-label={`${previewLabel}: ${selected.sourceLabel}`}
          title={`${previewLabel}: ${selected.sourceLabel}`}
          onclick={openPreview}
        >
          <Icon icon="mdi:play-circle-outline" class="size-5" aria-hidden="true" />
        </button>
      {/if}
    </div>
  </div>
  {#if selected.embedUrl}
    <dialog
      bind:this={dialog}
      class="modal"
      aria-labelledby={dialogTitleId}
      onclose={handleDialogClose}
      oncancel={(event) => {
        event.preventDefault();
        closePreview();
      }}
      onclick={(event) => {
        if (event.target === event.currentTarget) closePreview();
      }}
    >
      <div class="modal-box max-w-5xl p-2 sm:p-4">
        <header class="flex items-start justify-between gap-4">
          <h2 id={dialogTitleId} class="min-w-0 text-lg font-semibold wrap-anywhere">
            {songTitle} — {selected.sourceLabel}
          </h2>
          <button
            type="button"
            class="btn btn-circle btn-ghost btn-sm min-h-11 min-w-11 shrink-0"
            aria-label={closeLabel}
            title={closeLabel}
            onclick={closePreview}
          >
            <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
          </button>
        </header>
        {#if dialogOpen && previewId === selected.id && selected.embedUrl}
          <iframe
            class="mt-4 aspect-video w-full rounded-xl border-0"
            src={selected.embedUrl}
            title={`${songTitle} — ${selected.sourceLabel}`}
            allow="encrypted-media; fullscreen; picture-in-picture"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          ></iframe>
        {/if}
      </div>
    </dialog>
  {/if}
{/if}
