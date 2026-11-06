<script lang="ts">
  import AssetImage from "#lib/components/shared/AssetImage.svelte";
  import type { ComicItem } from "#lib/domain/comic.js";

  let {
    comic,
    imageSrc,
    imageUnavailableLabel,
    onOpen
  }: {
    comic: ComicItem;
    imageSrc: string | null;
    imageUnavailableLabel: string;
    onOpen: (trigger: HTMLButtonElement) => void;
  } = $props();
</script>

<button
  type="button"
  class="content-card-shell group flex size-full min-w-0 cursor-zoom-in flex-col gap-2 rounded-2xl p-2 text-left outline-none transition-[transform,border-color,background-color] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none sm:p-3"
  aria-haspopup="dialog"
  data-comic-preview-id={comic.id}
  onclick={(event) => onOpen(event.currentTarget)}
>
  <div class="relative aspect-644/478 w-full overflow-hidden rounded-xl">
    {#if imageSrc}
      <AssetImage
        buttonClass="block size-full overflow-hidden"
        src={imageSrc}
        alt=""
        fallbackLabel={imageUnavailableLabel}
        loadMode="visible"
        imageClass="size-full object-contain"
      />
    {:else}
      <span
        class="flex size-full items-center justify-center p-2 text-center text-xs text-(--archive-text-muted)"
        >{imageUnavailableLabel}</span
      >
    {/if}
  </div>
  <span class="min-w-0 text-sm font-semibold wrap-anywhere text-(--archive-text-strong)"
    >{comic.title}</span
  >
</button>
