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
  class="character-card group flex size-18! flex-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:size-20!"
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
    class="size-full! bg-white shadow-sm transition-[transform,box-shadow] duration-200 group-hover:scale-105 group-focus-visible:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
    imageClass="size-full object-contain"
  />
</a>
