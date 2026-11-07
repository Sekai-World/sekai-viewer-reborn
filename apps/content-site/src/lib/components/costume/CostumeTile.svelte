<script lang="ts">
  import AssetImage from "#lib/components/shared/AssetImage.svelte";

  let {
    href,
    name,
    imageSrc,
    imageUnavailableLabel
  }: {
    href: string;
    name: string;
    imageSrc: string | null;
    imageUnavailableLabel: string;
  } = $props();
</script>

<a
  {href}
  class="content-card-shell group flex size-full min-w-0 flex-col gap-2 rounded-2xl p-2 outline-none transition-[transform,border-color,background-color] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none sm:p-3"
>
  <div class="relative aspect-square w-full overflow-hidden rounded-xl">
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
  <span class="line-clamp-2 text-sm font-semibold wrap-anywhere text-(--archive-text-strong)">
    {name}
  </span>
</a>
