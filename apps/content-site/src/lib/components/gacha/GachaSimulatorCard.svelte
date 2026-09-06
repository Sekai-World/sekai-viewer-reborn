<script lang="ts">
  import { getCardThumbnailPresentation } from "$lib/components/card/card-presentation";
  import type { GachaBehavior } from "$lib/domain/gacha-detail";
  import type { SupportedRegion } from "$lib/domain/regions";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import Icon from "@iconify/svelte";
  import { resolve, base } from "$app/paths";
  import { SvelteMap } from "svelte/reactivity";

  type PulledGachaCard = {
    cardId: string;
    title: string | null;
    assetBundleName: string | null;
    attr: string | null;
    rarityType: string | null;
    initialSpecialTrainingStatus?: string | null;
  };

  type HistoryCard = PulledGachaCard & { isNew: boolean };

  let {
    gachaId,
    region,
    behaviors,
    behaviorTypeMap,
    spinnableTypeMap,
    title,
    pull1Label,
    pull10Label,
    resetLabel,
    totalPullsLabel,
    resultsLabel,
    noPoolLabel,
    emptyLabel,
    newLabel,
    statsTitle,
    rarityStatsLabel,
    countStatsLabel,
    rateStatsLabel,
    disclaimerLabel,
    cardAltSuffix
  }: {
    gachaId: string;
    region: SupportedRegion;
    behaviors: GachaBehavior[];
    behaviorTypeMap: Record<string, string>;
    spinnableTypeMap: Record<string, string>;
    title: string;
    pull1Label: string;
    pull10Label: string;
    resetLabel: string;
    totalPullsLabel: string;
    resultsLabel: string;
    noPoolLabel: string;
    emptyLabel: string;
    newLabel: string;
    statsTitle: string;
    rarityStatsLabel: string;
    countStatsLabel: string;
    rateStatsLabel: string;
    disclaimerLabel: string;
    cardAltSuffix: string;
  } = $props();

  const rarityValueByType: Record<string, number> = {
    rarity_1: 1,
    rarity_2: 2,
    rarity_3: 3,
    rarity_4: 4,
    rarity_birthday: 1
  };

  const rarityLabelByType: Record<string, string> = {
    rarity_1: "★1",
    rarity_2: "★2",
    rarity_3: "★3",
    rarity_4: "★4",
    rarity_birthday: "★BD"
  };

  const rarityOrder: Record<string, number> = {
    rarity_4: 0,
    rarity_3: 1,
    rarity_birthday: 2,
    rarity_2: 3,
    rarity_1: 4
  };

  let pullHistory: HistoryCard[] = $state([]);
  let latestResult: HistoryCard[] = $state([]);
  let seenCardIds: Set<string> = $state(new Set<string>());
  let pulling = $state(false);
  let pullError = $state(false);
  let pendingCount = $state(0);
  let selectedBehaviorKey = $state<string | null>(null);

  type BehaviorGroup = {
    key: string;
    behaviorType: string;
    spinnableType: string;
    display: string;
    spinnableDisplay: string | null;
    variants: GachaBehavior[];
    pullCounts: number[];
  };

  const getBehaviorGroupKey = (behavior: GachaBehavior): string =>
    [behavior.gachaBehaviorType ?? "", behavior.gachaSpinnableType ?? ""].join(":");

  const getBehaviorDisplay = (type: string | null): string =>
    type ? (behaviorTypeMap[type] ?? type) : "—";

  const getSpinnableDisplay = (type: string | null): string | null =>
    type && type !== "any" ? (spinnableTypeMap[type] ?? type) : null;

  const getAllowedPullCounts = (group: {
    behaviorType: string;
    variants: GachaBehavior[];
  }): number[] => {
    const counts = [
      ...new Set(
        group.variants
          .map((behavior) => behavior.spinCount)
          .filter(
            (count): count is number =>
              count !== null && Number.isInteger(count) && count >= 1 && count <= 10
          )
      )
    ].sort((a, b) => a - b);

    if (counts.length > 0) return counts;
    return group.behaviorType === "once_a_day" || group.behaviorType === "once_a_week"
      ? [1]
      : [1, 10];
  };

  const behaviorGroups = $derived.by(() => {
    const groups = new SvelteMap<string, GachaBehavior[]>();
    const sorted = [...behaviors].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    for (const behavior of sorted) {
      const key = getBehaviorGroupKey(behavior);
      const variants = groups.get(key);
      if (variants) {
        variants.push(behavior);
      } else {
        groups.set(key, [behavior]);
      }
    }

    return [...groups.entries()].map(([key, variants]): BehaviorGroup => {
      const first = variants[0];
      const behaviorType = first?.gachaBehaviorType ?? "";
      const spinnableType = first?.gachaSpinnableType ?? "";
      return {
        key,
        behaviorType,
        spinnableType,
        display: getBehaviorDisplay(first?.gachaBehaviorType ?? null),
        spinnableDisplay: getSpinnableDisplay(first?.gachaSpinnableType ?? null),
        variants,
        pullCounts: getAllowedPullCounts({ behaviorType, variants })
      };
    });
  });

  const selectedBehaviorGroup = $derived.by(() => {
    if (behaviorGroups.length === 0) return null;
    return (
      behaviorGroups.find((group) => group.key === selectedBehaviorKey) ??
      behaviorGroups.find(
        (group) => group.behaviorType === "normal" && group.spinnableType === "any"
      ) ??
      behaviorGroups[0]
    );
  });

  const activePullCounts = $derived(selectedBehaviorGroup?.pullCounts ?? [1, 10]);

  const simulatorId = $derived(
    `gacha-simulator-${gachaId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`
  );
  const behaviorTabId = (index: number): string => `${simulatorId}-behavior-tab-${index}`;
  const behaviorPanelId = (index: number): string => `${simulatorId}-behavior-panel-${index}`;
  const activeBehaviorIndex = $derived(
    selectedBehaviorGroup ? behaviorGroups.indexOf(selectedBehaviorGroup) : -1
  );

  const selectBehaviorTab = (index: number, focus = false): void => {
    const group = behaviorGroups[index];
    if (!group) return;
    selectedBehaviorKey = group.key;
    if (focus) {
      requestAnimationFrame(() => document.getElementById(behaviorTabId(index))?.focus());
    }
  };

  const handleBehaviorTabKeydown = (event: KeyboardEvent, index: number): void => {
    if (behaviorGroups.length === 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % behaviorGroups.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + behaviorGroups.length) % behaviorGroups.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = behaviorGroups.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    selectBehaviorTab(nextIndex, true);
  };

  const getPullLabel = (count: number): string => {
    if (count === 1) return pull1Label;
    if (count === 10) return pull10Label;
    return `×${count}`;
  };

  const totalPulls = $derived(pullHistory.length);

  const rarityCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const card of pullHistory) {
      const rt = card.rarityType ?? "unknown";
      counts[rt] = (counts[rt] ?? 0) + 1;
    }
    return counts;
  });

  const sortedRarityStats = $derived.by(() => {
    const entries = Object.entries(rarityCounts);
    return entries.sort((a, b) => (rarityOrder[a[0]] ?? 99) - (rarityOrder[b[0]] ?? 99));
  });

  const doPull = async (count: number): Promise<void> => {
    pulling = true;
    pullError = false;
    pendingCount = count;

    try {
      const url = `${base}/api/gacha/${region}/${gachaId}/pull`;
      const requestBody: {
        count: number;
        behaviorType?: string;
        spinnableType?: string;
      } = { count };
      if (selectedBehaviorGroup) {
        if (selectedBehaviorGroup.behaviorType) {
          requestBody.behaviorType = selectedBehaviorGroup.behaviorType;
        }
        if (selectedBehaviorGroup.spinnableType) {
          requestBody.spinnableType = selectedBehaviorGroup.spinnableType;
        }
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        pullError = true;
        return;
      }

      const data: { results: PulledGachaCard[] } = await response.json();
      const result: HistoryCard[] = [];

      for (const card of data.results) {
        const isNew = !seenCardIds.has(card.cardId);
        seenCardIds = new Set([...seenCardIds, card.cardId]);

        const entry: HistoryCard = { ...card, isNew };
        result.push(entry);
        pullHistory = [...pullHistory, entry];
      }

      latestResult = result;
    } catch {
      pullError = true;
    } finally {
      pulling = false;
      pendingCount = 0;
    }
  };

  const reset = (): void => {
    pullHistory = [];
    latestResult = [];
    seenCardIds = new Set<string>();
    pullError = false;
  };

  const getCardDetailHref = (cardId: string): string =>
    resolve("/card/[region]/[id]", { region, id: cardId });

  const getRarityValue = (rarityType: string | null): number =>
    rarityType ? (rarityValueByType[rarityType] ?? 0) : 0;

  const sortedLatestResult = $derived(
    [...latestResult].sort(
      (a, b) => (rarityOrder[b.rarityType ?? ""] ?? 99) - (rarityOrder[a.rarityType ?? ""] ?? 99)
    )
  );
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon
        icon="mdi:dice-multiple-outline"
        class="size-4 shrink-0 translate-y-[0.5px]"
        aria-hidden="true"
      />
      <span>{title}</span>
    </p>

    {#if !gachaId}
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-6 text-center text-sm opacity-70">
        {noPoolLabel}
      </div>
    {:else}
      {#snippet pullControls()}
        <div class="flex items-center gap-2">
          {#each activePullCounts as count (`sim-pull-${count}`)}
            <button
              type="button"
              class="btn btn-primary btn-sm gap-1"
              onclick={() => doPull(count)}
              disabled={pulling}
            >
              <Icon
                icon={count === 1 ? "mdi:dice-1" : "mdi:dice-multiple"}
                class="size-4"
                aria-hidden="true"
              />
              {getPullLabel(count)}
            </button>
          {/each}
          <button
            type="button"
            class="btn btn-ghost btn-sm ml-auto gap-1"
            onclick={reset}
            disabled={pulling}
          >
            <Icon icon="mdi:refresh" class="size-4" aria-hidden="true" />
            {resetLabel}
          </button>
        </div>
      {/snippet}

      {#if behaviorGroups.length > 0}
        <div
          role="tablist"
          aria-label={title}
          data-swipe-region-skip
          class="scrollbar-thin -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {#each behaviorGroups as group, index (group.key)}
            <button
              id={behaviorTabId(index)}
              type="button"
              role="tab"
              aria-selected={group.key === selectedBehaviorGroup?.key}
              aria-controls={behaviorPanelId(index)}
              tabindex={group.key === selectedBehaviorGroup?.key ? 0 : -1}
              class={`btn btn-sm h-auto min-h-10 shrink-0 rounded-xl px-3 py-2 font-sans text-xs font-medium normal-case transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm ${
                group.key === selectedBehaviorGroup?.key
                  ? "btn-primary shadow-sm"
                  : "border-base-content/10 bg-base-200/55 hover:border-primary/30 hover:bg-base-200"
              }`}
              onclick={() => selectBehaviorTab(index)}
              onkeydown={(event) => handleBehaviorTabKeydown(event, index)}
            >
              <span>{group.display}</span>
              {#if group.spinnableDisplay}
                <span
                  class={`badge badge-sm font-medium ${group.key === selectedBehaviorGroup?.key ? "badge-ghost" : "badge-outline"}`}
                >
                  {group.spinnableDisplay}
                </span>
              {/if}
            </button>
          {/each}
        </div>

        {#each behaviorGroups as group, index (group.key)}
          <div
            id={behaviorPanelId(index)}
            role="tabpanel"
            aria-labelledby={behaviorTabId(index)}
            tabindex="0"
            hidden={index !== activeBehaviorIndex}
            class="min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {#if index === activeBehaviorIndex}
              {@render pullControls()}
            {/if}
          </div>
        {/each}
      {:else}
        {@render pullControls()}
      {/if}

      {#if pullError}
        <div class="content-card-inset rounded-xl p-3 sm:px-4 text-center text-sm text-error/80">
          ⚠
        </div>
      {/if}

      {#if totalPulls > 0}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <div class="flex items-center justify-between text-sm">
            <span class="opacity-70">{totalPullsLabel}</span>
            <span class="font-semibold tabular-nums">{totalPulls}</span>
          </div>
        </div>
      {/if}

      {#if latestResult.length > 0}
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
            {resultsLabel}
          </p>
          <div class="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {#each sortedLatestResult as card, index (`sim-result-${index}-${card.cardId}`)}
              <a href={getCardDetailHref(card.cardId)} class="group relative block w-full">
                <CardThumbnail
                  {...getCardThumbnailPresentation(card, region)}
                  alt={card.title ? `${card.title} ${cardAltSuffix}` : `Card ${card.cardId}`}
                  fallbackLabel={card.cardId}
                  attr={card.attr}
                  rarityType={card.rarityType}
                  rarityCount={card.rarityType === "rarity_birthday"
                    ? 1
                    : getRarityValue(card.rarityType)}
                  showFrame={true}
                  showIcons={true}
                  loadMode="immediate"
                  maxSize={null}
                  containerClass="relative aspect-square w-full overflow-hidden rounded-lg bg-base-200/30"
                  imageClass="size-full object-contain"
                />
                {#if card.isNew}
                  <span
                    class="absolute top-0.5 left-0.5 z-10 rounded bg-primary px-1 py-0.5 text-[0.5rem] font-bold leading-none text-primary-content shadow-sm"
                  >
                    {newLabel}
                  </span>
                {/if}
              </a>
            {/each}
          </div>
        </div>
      {:else if pulling && pendingCount > 0}
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
            {resultsLabel}
          </p>
          <div class="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {#each Array(pendingCount) as _, i (`skeleton-${i}`)}
              <div class="aspect-square animate-pulse rounded-lg bg-base-200/60"></div>
            {/each}
          </div>
        </div>
      {:else if totalPulls === 0 && !pulling}
        <div class="content-card-inset rounded-xl px-3 sm:px-4 py-6 text-center text-sm opacity-70">
          {emptyLabel}
        </div>
      {/if}

      {#if totalPulls > 0 && sortedRarityStats.length > 0}
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
            {statsTitle}
          </p>
          <div data-swipe-region-skip class="content-card-inset overflow-x-auto rounded-xl">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th class="text-xs font-semibold uppercase opacity-60">{rarityStatsLabel}</th>
                  <th class="text-xs font-semibold uppercase opacity-60 text-right"
                    >{countStatsLabel}</th
                  >
                  <th class="text-xs font-semibold uppercase opacity-60 text-right"
                    >{rateStatsLabel}</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each sortedRarityStats as [rarityType, count] (`sim-stat-${rarityType}`)}
                  <tr>
                    <td class="font-medium">
                      {rarityLabelByType[rarityType] ?? rarityType}
                    </td>
                    <td class="text-right tabular-nums">{count}</td>
                    <td class="text-right tabular-nums opacity-80">
                      {((count / totalPulls) * 100).toFixed(2)}%
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <p class="text-center text-[0.65rem] opacity-40">
        {disclaimerLabel}
      </p>
    {/if}
  </div>
</article>
