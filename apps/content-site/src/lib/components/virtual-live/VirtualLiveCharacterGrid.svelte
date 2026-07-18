<script lang="ts">
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { VirtualLiveCharacter } from "$lib/domain/virtual-live";

  type EnrichedVirtualLiveCharacter = VirtualLiveCharacter & {
    gameCharacterId?: number | null;
    colorCode?: string | null;
  };

  let {
    characters,
    region,
    characterLabel,
    unavailableLabel
  }: {
    characters: EnrichedVirtualLiveCharacter[];
    region: SupportedRegion;
    characterLabel: string;
    unavailableLabel: string;
  } = $props();

  const hasCharacterId = (character: EnrichedVirtualLiveCharacter): boolean =>
    typeof character.gameCharacterId === "number" &&
    Number.isInteger(character.gameCharacterId) &&
    character.gameCharacterId > 0;
  const getCharacterLabel = (character: EnrichedVirtualLiveCharacter): string =>
    hasCharacterId(character)
      ? `${characterLabel} #${character.gameCharacterId}`
      : unavailableLabel;
</script>

<div class="flex flex-wrap gap-2.5">
  {#each characters as character, index (character.id ?? index)}
    {@const enriched = hasCharacterId(character)}
    {@const label = getCharacterLabel(character)}
    {#if enriched && character.gameCharacterId}
      <a
        href={`/character/${region}/${character.gameCharacterId}`}
        class="rounded-full transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={label}
        title={label}
      >
        <CharacterAvatar
          src={getLocalCharacterThumbnailAssetURL(character.gameCharacterId)}
          {label}
          accentColor={character.colorCode}
          characterId={character.gameCharacterId}
          variant="sm"
          decorative
          imageClass="size-full object-contain"
        />
      </a>
    {:else}
      <span title={label}>
        <CharacterAvatar src={null} {label} variant="sm" />
      </span>
    {/if}
  {/each}
</div>
