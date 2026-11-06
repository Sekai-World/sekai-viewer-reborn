<script lang="ts">
  import Icon from "@iconify/svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import { getComicImageURL } from "#lib/assets/index.js";
  import {
    loopDialogTabFocus,
    rescueDialogFocus
  } from "#lib/components/shared/preview-dialog-focus.js";
  import type { ComicItem } from "#lib/domain/comic.js";
  import type { SupportedRegion } from "#lib/domain/regions.js";
  import type { ContentSiteTranslator } from "#lib/i18n/runtime.js";
  import { STAMP_PREVIEW_BOX_CLASS } from "#lib/styles/stamp-preview.js";

  let {
    region,
    comics,
    t
  }: {
    region: SupportedRegion;
    comics: readonly ComicItem[];
    t: ContentSiteTranslator;
  } = $props();

  // History-only, like the stamp preview: opening adds a same-URL entry that Back closes,
  // and SSR, direct entry, and reload show just the list.
  const selected = $derived(
    page.shallow?.url.href === page.url.href && page.state.comicPreview?.catalogueKey === region
      ? page.state.comicPreview
      : null
  );
  let displayedComic = $state<ComicItem | null>(null);
  let displayedRegion: SupportedRegion | null = null;
  let host: HTMLDivElement | undefined = $state();
  let navigating = false;
  let closing = false;

  const tileFor = (comic: ComicItem): HTMLButtonElement | null =>
    document.querySelector<HTMLButtonElement>(`[data-comic-preview-id="${comic.id}"]`);

  $effect.pre(() => {
    if (selected) {
      // Focus the originating tile before showModal, including on Forward, so
      // native dismissal restores the right tile without scrolling.
      tileFor(selected.comic)?.focus({ preventScroll: true });
      displayedComic = selected.comic;
      displayedRegion = region;
    } else {
      closing = false;
      // Do not load a previously selected comic's artwork in a new region.
      if (displayedRegion !== region) displayedComic = null;
    }
  });

  $effect(() => {
    const preview = selected;
    const container = host;
    if (!preview || !container) return;

    const frame = requestAnimationFrame(() => {
      const dialog = container.querySelector("dialog");
      if (selected === preview && dialog) rescueDialogFocus(dialog);
    });
    return () => cancelAnimationFrame(frame);
  });

  const navigate = async (comic: ComicItem, replace: boolean): Promise<void> => {
    navigating = true;
    try {
      await goto(page.url.href, {
        shallow: true,
        replace,
        persistState: false,
        state: { ...page.state, comicPreview: { catalogueKey: region, comic } }
      });
    } finally {
      navigating = false;
    }
  };

  export async function show(comic: ComicItem, trigger: HTMLButtonElement): Promise<void> {
    // Do not stack duplicate history entries on double taps or while closing.
    if (navigating || selected) return;
    trigger.focus({ preventScroll: true });
    await navigate(comic, false);
  }

  // Stepping replaces the entry, so Back always closes the preview.
  const step = (offset: -1 | 1): void => {
    if (navigating || !selected) return;
    const id = selected.comic.id;
    const index = comics.findIndex((comic) => comic.id === id);
    if (index < 0 || comics.length < 2) return;
    void navigate(comics[(index + offset + comics.length) % comics.length], true);
  };

  const stepWithArrowKeys = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (!selected || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    step(event.key === "ArrowLeft" ? -1 : 1);
  };

  const close = (open: boolean): void => {
    // The shared native dialog also emits close when Back closes it. In that case
    // selected is already null, so never traverse history a second time. A queued
    // native close from Back can arrive after Forward reopened the same element;
    // its open flag distinguishes that stale event from a dismissal.
    if (open || !selected || closing || host?.querySelector("dialog")?.open) return;
    closing = true;
    history.back();
  };

  $effect(() => {
    if (!displayedComic) return;
    const dialog = host?.querySelector("dialog");
    if (!dialog) return;
    return loopDialogTabFocus(dialog, () => selected !== null);
  });

  // The dialog gives focus back to the tile it opened from. After stepping, the
  // comic last shown is the one to return to.
  let lastShown: ComicItem | null = null;
  $effect(() => {
    if (selected) {
      lastShown = selected.comic;
    } else if (lastShown) {
      const tile = tileFor(lastShown);
      lastShown = null;
      if (tile && tile !== document.activeElement) tile.focus();
    }
  });

  const buttonClass =
    "btn btn-circle btn-sm touch-target shrink-0 border-base-content/10 bg-base-100/90 shadow-sm";
</script>

<svelte:window onkeydown={stepWithArrowKeys} />

<div
  bind:this={host}
  data-comic-preview-host
  class="[&_.btn]:min-h-11 [&_.btn]:min-w-11 [&_.menu_a]:min-h-11 [&_.menu_a]:min-w-11"
>
  {#if displayedComic}
    {@const comic = displayedComic}
    <ImagePreviewDialog
      bind:open={() => selected !== null, close}
      src={getComicImageURL(comic.assetbundleName, region) ?? ""}
      alt={comic.title}
      fallbackLabel={t("imageUnavailable")}
      closeLabel={t("closeLabel")}
      downloadLabel={t("comic.previewDownload")}
      openInNewWindowLabel={t("comic.previewOpenInNewWindow")}
      formatOptions={["webp", "png"]}
      dialogBoxClass={STAMP_PREVIEW_BOX_CLASS}
      dialogImageClass="aspect-644/478 h-auto w-[min(90vw,56rem,calc(70dvh*644/478))] max-w-full object-contain"
    >
      <!-- Left is always previous, like the arrow keys, whatever the reading direction. -->
      <div dir="ltr" class="flex items-center gap-2 border-t border-(--archive-border-subtle) pt-3">
        {#if comics.length > 1}
          <button
            type="button"
            class={buttonClass}
            aria-label={t("comic.previewPrevious")}
            title={t("comic.previewPrevious")}
            onclick={() => step(-1)}
          >
            <Icon icon="mdi:chevron-left" class="size-5" aria-hidden="true" />
          </button>
        {/if}
        <p
          dir="auto"
          class="min-w-0 flex-1 text-center font-semibold wrap-anywhere"
          aria-live="polite"
        >
          {comic.title}
        </p>
        {#if comics.length > 1}
          <button
            type="button"
            class={buttonClass}
            aria-label={t("comic.previewNext")}
            title={t("comic.previewNext")}
            onclick={() => step(1)}
          >
            <Icon icon="mdi:chevron-right" class="size-5" aria-hidden="true" />
          </button>
        {/if}
      </div>
    </ImagePreviewDialog>
  {/if}
</div>

<style>
  /* daisyUI adds a stable gutter on modal open. Reserve it before opening too, while
     this list is mounted, so opening never shrinks the grid or moves the page. */
  :global(:root:has([data-comic-preview-host])) {
    scrollbar-gutter: stable;
  }
</style>
