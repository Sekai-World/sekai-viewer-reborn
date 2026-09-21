<script lang="ts">
  import type { ComponentProps } from "svelte";
  import type { MissionFamily } from "$lib/domain/mission";
  import CatalogueFrame from "./CatalogueFrame.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import Icon from "@iconify/svelte";

  export type MissionCatalogueItem = {
    key: string;
    sentence: string;
    requirementLabel?: string | null;
    character?: { id: number; name: string; imageSrc: string | null } | null;
    rewardLabels?: string[];
  };
  export type MissionCatalogueGroup = {
    family: MissionFamily;
    label: string;
    countLabel: string;
    items: MissionCatalogueItem[];
  };
  let {
    groups,
    catalogueKey,
    loadingGroupCount = 3,
    rewardsLabel,
    ...frame
  }: Omit<ComponentProps<typeof CatalogueFrame>, "children" | "empty" | "loadingPlaceholder"> & {
    groups: MissionCatalogueGroup[];
    catalogueKey: string;
    loadingGroupCount?: number;
    rewardsLabel: string;
  } = $props();
</script>

{#snippet heading(group: MissionCatalogueGroup, expandable: boolean)}
  <h2 class="flex min-w-0 items-center gap-3 text-base font-semibold text-(--archive-text-strong)">
    <Icon
      icon={expandable ? "mdi:chevron-right" : "mdi:playlist-check"}
      class={expandable
        ? "size-5 shrink-0 text-primary group-open:rotate-90"
        : "size-5 shrink-0 text-primary"}
      aria-hidden="true"
    />
    <span class="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span class="wrap-anywhere">{group.label}</span>
      <span class="text-sm font-normal wrap-anywhere text-(--archive-text-muted) tabular-nums">
        {group.countLabel}
      </span>
    </span>
  </h2>
{/snippet}

{#snippet members(group: MissionCatalogueGroup)}
  <ul class="divide-y divide-(--archive-border-subtle) border-t border-(--archive-border-subtle)">
    {#each group.items as item (item.key)}
      <li class="grid min-w-0 gap-3 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-4">
        <div class="min-w-0 space-y-2">
          <h3 class="text-base font-medium wrap-anywhere text-(--archive-text-strong)">
            {item.sentence}
          </h3>
          {#if item.character}
            <div class="flex min-w-0 items-center gap-2 text-sm">
              <CharacterAvatar
                src={item.character.imageSrc}
                characterId={item.character.id}
                label={item.character.name}
                variant="xs"
                decorative
              />
              <span class="min-w-0 wrap-anywhere">{item.character.name}</span>
            </div>
          {/if}
          {#if item.requirementLabel}<p
              class="text-sm wrap-anywhere text-(--archive-text-muted) tabular-nums"
            >
              {item.requirementLabel}
            </p>{/if}
        </div>
        {#if item.rewardLabels?.length}
          <ul
            aria-label={rewardsLabel}
            class="min-w-0 space-y-1 text-sm wrap-anywhere text-(--archive-text-muted) tabular-nums"
          >
            {#each item.rewardLabels as reward, index (index)}<li>{reward}</li>{/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<CatalogueFrame {...frame} empty={groups.every((group) => group.items.length === 0)}>
  {#snippet loadingPlaceholder()}
    <div class="flex flex-col gap-4">
      {#each Array.from({ length: loadingGroupCount }) as _, index (index)}
        <div
          class="content-card-shell flex min-h-16 items-center justify-between gap-4 rounded-2xl p-4"
        >
          <div class="h-5 w-40 max-w-1/2 rounded bg-(--archive-surface-sunken)"></div>
          <div class="h-4 w-28 max-w-1/3 rounded bg-(--archive-surface-sunken)"></div>
        </div>
      {/each}
    </div>
  {/snippet}
  {#key catalogueKey}
    <div class="flex flex-col gap-4">
      {#each groups as group (group.family)}
        {#if group.items.length > 1}
          <details class="group collapse content-card-shell min-w-0 rounded-2xl transition-none">
            <summary
              class="collapse-title min-h-16 cursor-pointer p-4 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
            >
              {@render heading(group, true)}
            </summary>
            <div class="collapse-content px-4 transition-none">
              {@render members(group)}
            </div>
          </details>
        {:else if group.items.length === 1}
          <section class="content-card-shell min-w-0 rounded-2xl p-4">
            <div class="pb-4">{@render heading(group, false)}</div>
            {@render members(group)}
          </section>
        {/if}
      {/each}
    </div>
  {/key}
</CatalogueFrame>
