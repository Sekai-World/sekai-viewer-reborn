<script lang="ts">
  import { resolve } from "$app/paths";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import type { CharacterCatalogueItem } from "$lib/domain/character";

  let {
    character,
    region,
    unitLabel,
    heightLabel
  }: {
    character: CharacterCatalogueItem;
    region: string;
    unitLabel: string;
    heightLabel: string;
  } = $props();

  const href = $derived(resolve("/character/[region]/[id]", { region, id: character.id }));
</script>

<a
  {href}
  class="character-card group relative isolate flex h-56 items-end justify-center overflow-hidden rounded-xl border border-base-content/10 bg-base-100 shadow-sm outline-none transition-[transform,box-shadow,border-color] duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-72 md:h-80"
  style:--character-accent={character.unitRecord?.colorCode ?? "var(--color-primary)"}
>
  <span class="absolute inset-x-0 top-0 h-1 bg-(--character-accent)" aria-hidden="true"></span>
  <div class="relative flex size-full items-end justify-center p-2 sm:p-3">
    <CharacterAvatar
      src={getLocalCharacterThumbnailAssetURL(character.id)}
      label={character.name}
      characterId={character.id}
      accentColor={character.unitRecord?.colorCode}
      variant="default"
      decorative
      class="size-full! rounded-none border-0 bg-transparent shadow-none"
      imageClass="size-full object-contain"
    />
    <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2 pb-2 pt-10 text-center text-sm font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{character.name}</span>
    <span class="sr-only">{character.name}</span>
  </div>
</a>

<style>
  @media (hover: hover) and (pointer: fine) {
    .character-card:hover {
      transform: translateY(-3px);
      border-color: color-mix(in oklab, var(--character-accent) 55%, transparent);
      box-shadow: 0 16px 34px color-mix(in oklab, var(--character-accent) 14%, transparent);
    }
  }
  @media (hover: none) and (pointer: coarse) {
    .character-card:active {
      transform: scale(0.99);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .character-card {
      transition: none;
    }
  }
</style>
