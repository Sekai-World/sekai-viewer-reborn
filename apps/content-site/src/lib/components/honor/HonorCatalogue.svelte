<script lang="ts">
  import type { ComponentProps } from "svelte";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import HonorSummary from "./HonorSummary.svelte";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";

  export type HonorCatalogueGroup = {
    key: string;
    name: string;
    imageSrc: string | null;
    countLabel: string;
    members: {
      key: string;
      name: string;
      variantLabel?: string;
      imageSrc: string | null;
      levels: { label: string; description: string | null }[];
    }[];
  };
  let {
    items,
    catalogueKey,
    imageUnavailableLabel,
    levelsLabel,
    ...frame
  }: Omit<ComponentProps<typeof CatalogueFrame>, "children" | "empty" | "loadingPlaceholder"> & {
    items: HonorCatalogueGroup[];
    catalogueKey: string;
    imageUnavailableLabel: string;
    levelsLabel: string;
  } = $props();
</script>

{#snippet identity(group: HonorCatalogueGroup)}
  <HonorSummary name={group.name} imageSrc={group.imageSrc} {imageUnavailableLabel} compact />
  {#if group.members.length > 1}
    <p class="mt-2 text-sm font-normal text-(--archive-text-muted)">{group.countLabel}</p>
  {/if}
{/snippet}

{#snippet members(group: HonorCatalogueGroup)}
  <ul class="min-w-0 divide-y divide-(--archive-border-subtle)">
    {#each group.members as member (member.key)}
      {@const label = member.variantLabel ?? member.name}
      <li class="min-w-0 space-y-3 py-4 first:pt-0 last:pb-0">
        {#if group.members.length > 1 || label !== group.name}
          <h3 class="font-semibold wrap-anywhere text-(--archive-text-strong)">{label}</h3>
        {/if}
        {#if member.imageSrc && member.imageSrc !== group.imageSrc}
          <div class="h-12 w-full max-w-57">
            <AssetImage
              src={member.imageSrc}
              alt={member.name}
              imageClass="h-full w-full object-contain"
              fallbackLabel={imageUnavailableLabel}
              loadMode="visible"
            />
          </div>
        {/if}
        {#if member.levels.length}
          <dl aria-label={levelsLabel} class="space-y-3 text-sm">
            {#each member.levels as level, index (index)}
              <div class="grid min-w-0 gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-3">
                <dt class="font-semibold wrap-anywhere text-(--archive-text-default)">
                  {level.label}
                </dt>
                {#if level.description}
                  <dd class="whitespace-pre-line wrap-anywhere text-(--archive-text-muted)">
                    {level.description}
                  </dd>
                {/if}
              </div>
            {/each}
          </dl>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<CatalogueFrame {...frame} empty={items.length === 0}>
  {#snippet loadingPlaceholder()}
    <div class="grid items-start gap-4 lg:grid-cols-2">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="content-card-shell min-h-32 rounded-2xl p-4">
          <div class="h-12 w-full max-w-57 rounded-lg bg-(--archive-surface-sunken)"></div>
          <div class="mt-3 h-4 w-3/4 rounded bg-(--archive-surface-sunken)"></div>
        </div>
      {/each}
    </div>
  {/snippet}
  {#key catalogueKey}
    <div class="grid min-w-0 items-start gap-4 lg:grid-cols-2">
      {#each items as group (group.key)}
        {#if group.members.length > 1}
          <details class="collapse collapse-arrow content-card-shell min-w-0 rounded-2xl">
            <summary
              class="collapse-title min-h-11 p-4 pe-12 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
            >
              {@render identity(group)}
            </summary>
            <div class="collapse-content min-w-0 px-4">
              <div class="border-t border-(--archive-border-subtle) pt-4">
                {@render members(group)}
              </div>
            </div>
          </details>
        {:else}
          <article class="card content-card-shell min-w-0 gap-4 p-4">
            <header>{@render identity(group)}</header>
            <div class="min-w-0 border-t border-(--archive-border-subtle) pt-4">
              {@render members(group)}
            </div>
          </article>
        {/if}
      {/each}
    </div>
  {/key}
</CatalogueFrame>
