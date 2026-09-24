<script lang="ts">
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import type { MissionCharacterOption } from "$lib/domain/mission";

  let {
    characters,
    status,
    selectedId,
    getImageSrc,
    labels,
    profileHref = null,
    onSelect,
    onRetry
  }: {
    characters: MissionCharacterOption[];
    status: "loading" | "ready" | "error";
    selectedId: number | null;
    getImageSrc: (id: number) => string | null;
    labels: {
      title: string;
      loading: string;
      error: string;
      retry: string;
      otherGroup: string;
      /** Names the selected character; `{name}` is replaced. */
      selected: string;
      profile: string;
      /** Small screens only: reopens the collapsed grid after a character is chosen. */
      change: string;
      collapse: string;
    };
    profileHref?: string | null;
    onSelect: (id: number) => void;
    onRetry: () => void;
  } = $props();

  const titleId = $props.id();
  const gridId = `${titleId}-grid`;
  // Small screens collapse the grid once a character is chosen; wider screens always show it.
  let expanded = $state(false);
  const collapsed = $derived(selectedId !== null && !expanded);
  // Characters arrive in seq order, which already keeps each unit together.
  const groups = $derived(
    characters.reduce<{ key: string; label: string; characters: MissionCharacterOption[] }[]>(
      (result, character) => {
        const key = character.unit ?? "";
        const last = result.at(-1);
        if (last?.key === key) {
          last.characters.push(character);
        } else {
          result.push({
            key,
            label: character.unitName ?? character.unit ?? labels.otherGroup,
            characters: [character]
          });
        }
        return result;
      },
      []
    )
  );
  const selected = $derived(characters.find((character) => character.id === selectedId) ?? null);
</script>

<section class="grid min-w-0 gap-3" aria-labelledby={titleId}>
  <h2 id={titleId} class="text-sm font-semibold text-(--archive-text-strong)">{labels.title}</h2>
  {#if status === "loading"}
    <p role="status" class="sr-only">{labels.loading}</p>
    <div class="flex flex-wrap gap-2" aria-hidden="true">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="size-12 rounded-full bg-(--archive-surface-sunken)"></div>
      {/each}
    </div>
  {:else if status === "error"}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p role="alert" class="text-sm text-error">{labels.error}</p>
      <button type="button" class="btn btn-link min-h-11 px-0" onclick={onRetry}>
        {labels.retry}
      </button>
    </div>
  {:else}
    <!-- Small screens drop the unit column and flow every unit into one compact grid. -->
    <div
      id={gridId}
      class="flex-wrap gap-1 sm:grid sm:gap-3"
      class:hidden={collapsed}
      class:flex={!collapsed}
    >
      {#each groups as group (group.key)}
        <div class="contents sm:grid sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-2">
          <p class="sr-only text-xs wrap-anywhere text-(--archive-text-muted) sm:not-sr-only">
            {group.label}
          </p>
          <ul class="contents sm:flex sm:flex-wrap sm:gap-2" aria-label={group.label}>
            {#each group.characters as character (character.id)}
              <li class="last:mr-2 sm:last:mr-0">
                <button
                  type="button"
                  class="btn btn-circle btn-ghost size-11 p-0 sm:size-12"
                  class:ring-2={character.id === selectedId}
                  class:ring-primary={character.id === selectedId}
                  aria-pressed={character.id === selectedId}
                  aria-label={character.name}
                  title={character.name}
                  onclick={() => {
                    expanded = false;
                    onSelect(character.id);
                  }}
                >
                  <CharacterAvatar
                    src={getImageSrc(character.id)}
                    characterId={character.id}
                    label={character.name}
                    variant="sm"
                    class="size-full!"
                    decorative
                  />
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
    {#if selected}
      <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span class="font-medium wrap-anywhere text-(--archive-text-strong)">
          {labels.selected.replace("{name}", selected.name)}
        </span>
        <button
          type="button"
          class="btn btn-link min-h-11 px-0 sm:hidden"
          aria-controls={gridId}
          aria-expanded={!collapsed}
          onclick={() => (expanded = !expanded)}
        >
          {collapsed ? labels.change : labels.collapse}
        </button>
        {#if profileHref}
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a class="link min-h-11 content-center link-primary" href={profileHref}
            >{labels.profile}</a
          >
        {/if}
      </p>
    {/if}
  {/if}
</section>
