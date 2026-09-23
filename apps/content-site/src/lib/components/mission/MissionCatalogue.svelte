<script lang="ts">
  import { type ComponentProps } from "svelte";
  import type { MissionFamily } from "$lib/domain/mission";
  import { missionFamilies } from "$lib/domain/mission";
  import CatalogueFrame from "./CatalogueFrame.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import Icon from "@iconify/svelte";

  export type MissionCatalogueItem = {
    key: string;
    sentence: string;
    requirementLabel?: string | null;
    targetLevelsLabel?: string | null;
    targetUnavailableLabel?: string | null;
    character?: { id: number; name: string; imageSrc: string | null } | null;
    rewardLabels?: string[];
    milestones?: {
      summary: { label: string; rewardLabel: string | null }[];
      totalLabel: string;
      expanded: boolean;
      details: { label: string; rewardLabel: string | null }[];
      loading: boolean;
      error: string | null;
      hasNext: boolean;
      toggleLabel: string;
      loadMoreLabel: string;
      endLabel: string;
      onToggle: () => void;
      onLoadMore: () => void;
    } | null;
    rankReference?: {
      title: string;
      items: { label: string; rewardLabels: string[] }[];
      loading: boolean;
      error: string | null;
      emptyLabel: string;
    } | null;
  };
  export type MissionCatalogueGroup = {
    family: MissionFamily;
    label: string;
    countLabel: string;
    browseLabel?: string;
    items: MissionCatalogueItem[];
  };
  let {
    groups,
    catalogueKey,
    loadingGroupCount = 3,
    overview = false,
    rewardsLabel,
    familyLabel,
    selectedFamily = null,
    getFamilyLabel,
    onFamilyChange,
    hasNext = false,
    isLoadingMore = false,
    loadMoreLabel,
    loadingMoreLabel,
    endLabel,
    loadMoreError = null,
    onLoadMore,
    onRetryLoadMore,
    ...frame
  }: Omit<
    ComponentProps<typeof CatalogueFrame>,
    "children" | "empty" | "loadingPlaceholder" | "controls"
  > & {
    groups: MissionCatalogueGroup[];
    catalogueKey: string;
    loadingGroupCount?: number;
    overview?: boolean;
    rewardsLabel: string;
    familyLabel: string;
    selectedFamily?: MissionFamily | null;
    getFamilyLabel: (family: MissionFamily | null) => string;
    onFamilyChange: (family: MissionFamily | null) => void;
    hasNext?: boolean;
    isLoadingMore?: boolean;
    loadMoreLabel: string;
    loadingMoreLabel: string;
    endLabel: string;
    loadMoreError?: string | null;
    onLoadMore?: () => void;
    onRetryLoadMore?: () => void;
  } = $props();

  let sentinel: HTMLDivElement | null = $state(null);
  const familyOptions: (MissionFamily | null)[] = [null, ...missionFamilies];
  const resultsId = $derived(`mission-results-${catalogueKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`);

  $effect(() => {
    if (
      !sentinel ||
      !hasNext ||
      isLoadingMore ||
      loadMoreError ||
      !onLoadMore ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore?.();
      },
      { rootMargin: "240px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

{#snippet heading(group: MissionCatalogueGroup)}
  <h2 class="flex min-w-0 items-center gap-3 text-base font-semibold text-(--archive-text-strong)">
    <Icon icon="mdi:playlist-check" class="size-5 shrink-0 text-primary" aria-hidden="true" />
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
          {#if item.targetLevelsLabel}<p
              class="text-sm wrap-anywhere text-(--archive-text-muted) tabular-nums"
            >
              {item.targetLevelsLabel}
            </p>{/if}
          {#if item.targetUnavailableLabel}<p class="text-sm wrap-anywhere text-warning">
              {item.targetUnavailableLabel}
            </p>{/if}
          {#if item.milestones}
            <section class="space-y-3 pt-1" aria-label={item.milestones.totalLabel}>
              <p class="text-sm font-medium text-(--archive-text-strong)">
                {item.milestones.totalLabel}
              </p>
              <ul class="space-y-2 text-sm">
                {#each item.milestones.summary as level (level.label)}
                  <li
                    class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 tabular-nums"
                  >
                    <span class="text-(--archive-text-muted)">{level.label}</span>
                    {#if level.rewardLabel}<span class="text-(--archive-text-muted)"
                        >{level.rewardLabel}</span
                      >{/if}
                  </li>
                {/each}
              </ul>
              <button
                type="button"
                class="btn btn-ghost min-h-10 px-3"
                onclick={item.milestones.onToggle}
                aria-expanded={item.milestones.expanded}
              >
                {item.milestones.toggleLabel}
              </button>
              {#if item.milestones.expanded}
                <div
                  class="space-y-3 border-t border-(--archive-border-subtle) pt-3"
                  aria-live="polite"
                >
                  {#if item.milestones.loading}
                    <p class="text-sm text-(--archive-text-muted)">
                      {item.milestones.loadMoreLabel}
                    </p>
                  {:else if item.milestones.error}
                    <p class="text-sm text-error">{item.milestones.error}</p>
                  {:else}
                    <ul class="space-y-2 text-sm">
                      {#each item.milestones.details as level (level.label)}
                        <li
                          class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 tabular-nums"
                        >
                          <span class="text-(--archive-text-muted)">{level.label}</span>
                          {#if level.rewardLabel}<span class="text-(--archive-text-muted)"
                              >{level.rewardLabel}</span
                            >{/if}
                        </li>
                      {/each}
                    </ul>
                    {#if item.milestones.hasNext}
                      <button
                        type="button"
                        class="btn btn-ghost min-h-10 px-3"
                        onclick={item.milestones.onLoadMore}>{item.milestones.loadMoreLabel}</button
                      >
                    {:else}
                      <p class="text-sm text-(--archive-text-muted)">{item.milestones.endLabel}</p>
                    {/if}
                  {/if}
                </div>
              {/if}
            </section>
          {/if}
          {#if item.rankReference}
            <section
              class="space-y-2 border-t border-(--archive-border-subtle) pt-3"
              aria-label={item.rankReference.title}
            >
              <h4 class="text-sm font-medium text-(--archive-text-strong)">
                {item.rankReference.title}
              </h4>
              {#if item.rankReference.loading}
                <p class="text-sm text-(--archive-text-muted)">{item.rankReference.emptyLabel}</p>
              {:else if item.rankReference.error}
                <p class="text-sm text-error">{item.rankReference.error}</p>
              {:else if item.rankReference.items.length}
                <ul class="space-y-2 text-sm">
                  {#each item.rankReference.items as rank (rank.label)}
                    <li class="flex flex-wrap gap-x-3 gap-y-1">
                      <span class="font-medium">{rank.label}</span><span
                        class="text-(--archive-text-muted)">{rank.rewardLabels.join(" · ")}</span
                      >
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="text-sm text-(--archive-text-muted)">{item.rankReference.emptyLabel}</p>
              {/if}
            </section>
          {/if}
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

{#snippet controls()}
  <div data-swipe-region-skip>
    <div class="flex min-w-0 flex-wrap gap-2" role="tablist" aria-label={familyLabel}>
      {#each familyOptions as family (family ?? "all")}
        <button
          type="button"
          class:btn-primary={selectedFamily === family}
          class:btn-ghost={selectedFamily !== family}
          class="btn min-h-11 max-w-full rounded-xl whitespace-normal wrap-break-word"
          role="tab"
          aria-selected={selectedFamily === family}
          aria-controls={resultsId}
          onclick={() => onFamilyChange(family)}
        >
          {getFamilyLabel(family)}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<div id={resultsId}>
  <CatalogueFrame {...frame} empty={groups.length === 0} {controls}>
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
      <div class="flex min-w-0 flex-col gap-4">
        {#each groups as group (group.family)}
          <section
            class={overview
              ? "min-w-0 border-b border-(--archive-border-subtle) py-4 first:pt-0 last:border-0 last:pb-0"
              : "content-card-shell min-w-0 rounded-2xl p-4"}
          >
            <div class="pb-4">{@render heading(group)}</div>
            {#if overview}
              {#if group.items.length}
                <ul class="space-y-2 border-t border-(--archive-border-subtle) py-3 text-sm">
                  {#each group.items as item (item.key)}
                    <li class="wrap-anywhere text-(--archive-text-muted)">{item.sentence}</li>
                  {/each}
                </ul>
              {/if}
              <button
                type="button"
                class="btn btn-link min-h-11 px-0"
                onclick={() => onFamilyChange(group.family)}
              >
                {group.browseLabel}
              </button>
            {:else}
              {@render members(group)}
            {/if}
          </section>
        {/each}

        {#if !overview}
          {#if loadMoreError}
            <div
              class="flex flex-col items-center justify-center gap-3 p-4 text-center"
              role="status"
            >
              <p class="text-sm text-error">{loadMoreError}</p>
              {#if onRetryLoadMore}
                <button type="button" class="btn min-h-11" onclick={onRetryLoadMore}>
                  {frame.labels.retry}
                </button>
              {/if}
            </div>
          {:else if hasNext}
            <div
              bind:this={sentinel}
              class="flex min-h-20 items-center justify-center gap-3 p-4 text-sm text-(--archive-text-muted)"
              role="status"
              aria-live="polite"
            >
              {#if isLoadingMore}
                <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
                <span>{loadingMoreLabel}</span>
              {:else if onLoadMore}
                <button type="button" class="btn min-h-11" onclick={onLoadMore}>
                  {loadMoreLabel}
                </button>
              {:else}
                <span>{loadMoreLabel}</span>
              {/if}
            </div>
          {:else}
            <p class="p-4 text-center text-sm text-(--archive-text-muted)" role="status">
              {endLabel}
            </p>
          {/if}
        {/if}
      </div>
    {/key}
  </CatalogueFrame>
</div>
