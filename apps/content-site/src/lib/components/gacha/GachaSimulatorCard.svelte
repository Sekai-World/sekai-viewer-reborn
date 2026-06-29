<script lang="ts">
  import { getCardThumbnailAssetURL } from "$lib/assets/index";
  import type { SupportedRegion } from "$lib/domain/regions";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import Icon from "@iconify/svelte";
  import { resolve, base } from "$app/paths";

  type PulledGachaCard = {
    cardId: string;
    title: string | null;
    assetBundleName: string | null;
    attr: string | null;
    rarityType: string | null;
  };

  type HistoryCard = PulledGachaCard & { isNew: boolean };

  let {
    gachaId,
    region,
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
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count })
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
      (a, b) =>
        (rarityOrder[b.rarityType ?? ""] ?? 99) -
        (rarityOrder[a.rarityType ?? ""] ?? 99)
    )
  );
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-5">
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
      <div class="content-card-inset rounded-xl px-4 py-6 text-center text-sm opacity-70">
        {noPoolLabel}
      </div>
    {:else}
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-primary btn-sm gap-1"
          onclick={() => doPull(1)}
          disabled={pulling}
        >
          <Icon icon="mdi:dice-1" class="size-4" aria-hidden="true" />
          {pull1Label}
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm gap-1"
          onclick={() => doPull(10)}
          disabled={pulling}
        >
          <Icon icon="mdi:dice-multiple" class="size-4" aria-hidden="true" />
          {pull10Label}
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm gap-1 ml-auto"
          onclick={reset}
          disabled={pulling}
        >
          <Icon icon="mdi:refresh" class="size-4" aria-hidden="true" />
          {resetLabel}
        </button>
      </div>

      {#if pullError}
        <div class="content-card-inset rounded-xl px-4 py-3 text-center text-sm text-error/80">
          ⚠
        </div>
      {/if}

      {#if totalPulls > 0}
        <div class="content-card-inset rounded-xl px-4 py-3">
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
              <a
                href={getCardDetailHref(card.cardId)}
                class="group block"
              >
                <div class="relative overflow-hidden rounded-lg bg-base-200/30 ring-1 ring-base-content/5 transition-all hover:shadow-md hover:ring-primary/40">
                  <CardThumbnail
                    src={card.assetBundleName ? getCardThumbnailAssetURL(card.assetBundleName, false, region) : null}
                    fallbackSrc={null}
                    alt={card.title ? `${card.title} ${cardAltSuffix}` : `Card ${card.cardId}`}
                    fallbackLabel={card.cardId}
                    trained={false}
                    attr={card.attr}
                    rarityType={card.rarityType}
                    rarityCount={card.rarityType === "rarity_birthday" ? 1 : getRarityValue(card.rarityType)}
                    showFrame={true}
                    showIcons={true}
                    loadMode="immediate"
                    maxSize={64}
                    containerClass="relative mx-auto aspect-square overflow-hidden rounded-lg"
                    imageClass="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  {#if card.isNew}
                    <span class="absolute top-0.5 left-0.5 rounded bg-primary px-1 py-0.5 text-[0.5rem] font-bold leading-none text-primary-content shadow-sm">
                      {newLabel}
                    </span>
                  {/if}
                </div>
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
        <div class="content-card-inset rounded-xl px-4 py-6 text-center text-sm opacity-70">
          {emptyLabel}
        </div>
      {/if}

      {#if totalPulls > 0 && sortedRarityStats.length > 0}
        <div class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
            {statsTitle}
          </p>
          <div class="content-card-inset overflow-x-auto rounded-xl">
            <table class="table table-xs">
              <thead>
                <tr>
                  <th class="text-xs font-semibold uppercase opacity-60">{rarityStatsLabel}</th>
                  <th class="text-xs font-semibold uppercase opacity-60 text-right">{countStatsLabel}</th>
                  <th class="text-xs font-semibold uppercase opacity-60 text-right">{rateStatsLabel}</th>
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
