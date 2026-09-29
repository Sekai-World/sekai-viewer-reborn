<script lang="ts">
  import AssetImage from "$lib/components/shared/AssetImage.svelte";

  let {
    href,
    name,
    imageSrc,
    imageUnavailableLabel,
    meta = null,
    badge = null
  }: {
    href: string;
    name: string;
    imageSrc: string | null;
    imageUnavailableLabel: string;
    /** A short secondary line, such as the genre. */
    meta?: string | null;
    /** Shown over the image's corner, such as a material quantity. */
    badge?: string | null;
  } = $props();
</script>

<a
  {href}
  class="content-card-shell group flex h-full min-w-0 flex-col gap-2 rounded-2xl p-2 outline-none transition-[transform,border-color,background-color] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none sm:p-3"
>
  <div
    class="relative aspect-square w-full overflow-hidden rounded-xl bg-(--archive-surface-sunken)"
  >
    {#if imageSrc}
      <AssetImage
        src={imageSrc}
        alt=""
        fallbackLabel={imageUnavailableLabel}
        loadMode="visible"
        imageClass="size-full object-contain p-1"
      />
    {:else}
      <span
        class="flex size-full items-center justify-center p-2 text-center text-xs text-(--archive-text-muted)"
        >{imageUnavailableLabel}</span
      >
    {/if}
    {#if badge}
      <span
        class="badge badge-sm absolute right-1.5 bottom-1.5 border-(--archive-border-default) bg-(--archive-surface-raised) font-semibold tabular-nums text-primary"
        >{badge}</span
      >
    {/if}
  </div>
  <div class="min-w-0 px-0.5">
    <p class="line-clamp-2 text-sm font-semibold wrap-anywhere text-(--archive-text-strong)">
      {name}
    </p>
    {#if meta}
      <p class="mt-0.5 truncate text-xs text-(--archive-text-muted)">{meta}</p>
    {/if}
  </div>
</a>
