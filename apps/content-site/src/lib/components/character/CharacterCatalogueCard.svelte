<script lang="ts">
  import { resolve } from "$app/paths";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import type { CharacterCatalogueItem } from "$lib/domain/character";

  let { character, region }: { character: CharacterCatalogueItem; region: string } = $props();
  const href = $derived(resolve("/character/[region]/[id]", { region, id: character.id }));
</script>

<a
  {href}
  class="character-card group flex min-w-0 flex-1 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  title={character.name}
  aria-label={character.name}
>
  <CharacterAvatar
    src={getLocalCharacterThumbnailAssetURL(character.id)}
    label={character.name}
    characterId={character.id}
    accentColor={character.unitRecord?.colorCode}
    variant="default"
    decorative
    class="size-full! max-w-18 bg-white shadow-sm transition-transform duration-200 group-hover:scale-105 sm:max-w-20"
    imageClass="size-full object-contain"
  />
</a>

<style>
  @media (prefers-reduced-motion: reduce) {
    .character-card :global(*) {
      transition: none;
    }
  }
</style>
