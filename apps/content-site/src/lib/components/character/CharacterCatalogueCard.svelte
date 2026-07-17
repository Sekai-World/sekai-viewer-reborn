<script lang="ts">
  import { resolve } from "$app/paths";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
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
  class="character-card group relative isolate min-h-40 overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 shadow-sm outline-none transition-[transform,box-shadow,border-color] duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  style:--character-accent={character.unitRecord?.colorCode ?? "var(--color-primary)"}
>
  <span class="absolute inset-y-0 left-0 w-1 bg-(--character-accent)" aria-hidden="true"
  ></span>
  <span
    class="absolute -right-8 -top-12 size-36 rounded-full bg-(--character-accent) opacity-10"
    aria-hidden="true"
  ></span>
  <div class="relative flex h-full items-center gap-4 p-4 pl-5 sm:flex-col sm:items-start sm:p-5">
    <CharacterAvatar
      src={getLocalCharacterThumbnailAssetURL(character.id)}
      label={character.name}
      characterId={character.id}
      accentColor={character.unitRecord?.colorCode}
      variant="default"
      decorative
      class="size-22! bg-white shadow-sm sm:size-24!"
      imageClass="size-full object-contain"
    />
    <div class="min-w-0 flex-1 sm:w-full">
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="text-[0.65rem] font-semibold tracking-[0.18em] opacity-45"
          >#{character.id}</span
        >
        {#if character.unit}<UnitIconBadge unit={character.unit} variant="sm" />{/if}
      </div>
      <h2 class="wrap-break-word text-lg/tight font-bold sm:text-xl">{character.name}</h2>
      <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-60">
        {#if character.unit}<span><span class="sr-only">{unitLabel}: </span>{character.unit}</span
          >{/if}
        {#if character.height !== null}<span>{heightLabel}: {character.height} cm</span>{/if}
      </div>
    </div>
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
