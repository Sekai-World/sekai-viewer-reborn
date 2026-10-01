<script lang="ts">
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import { getStampDisplayName, type StampItem } from "$lib/domain/stamp";

  let {
    stamp,
    imageSrc,
    imageUnavailableLabel,
    onOpen
  }: {
    stamp: StampItem;
    imageSrc: string | null;
    imageUnavailableLabel: string;
    /** Opens the stamp's image preview. */
    onOpen: () => void;
  } = $props();

  const displayName = $derived(getStampDisplayName(stamp.name));
</script>

<!-- The whole tile opens the preview: it is a button, named by the stamp's own text. Narrow
     tiles keep the text to two lines and drop the avatars and the acquisition line, which the
     image and the filters already cover. -->
<button
  type="button"
  class="content-card-shell group flex size-full min-w-0 cursor-zoom-in flex-col gap-2 rounded-2xl p-2 text-left sm:p-3 outline-none transition-[transform,border-color,background-color] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
  aria-haspopup="dialog"
  aria-label={displayName}
  title={displayName}
  onclick={onOpen}
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
  <div class="flex min-w-0 items-center gap-2">
    {#if stamp.characterIds.length > 0}
      <span class="hidden shrink-0 -space-x-2 sm:flex" aria-hidden="true">
        {#each stamp.characterIds as characterId (characterId)}
          <CharacterAvatar
            src={getLocalCharacterThumbnailAssetURL(characterId)}
            label=""
            {characterId}
            variant="xs"
            decorative
          />
        {/each}
      </span>
    {/if}
    <span
      class="line-clamp-2 min-w-0 text-xs font-semibold wrap-anywhere text-(--archive-text-strong) sm:text-sm"
      >{displayName}</span
    >
  </div>
  {#if stamp.description}
    <p class="line-clamp-2 hidden text-xs wrap-anywhere text-(--archive-text-muted) sm:block">
      {stamp.description}
    </p>
  {/if}
</button>
