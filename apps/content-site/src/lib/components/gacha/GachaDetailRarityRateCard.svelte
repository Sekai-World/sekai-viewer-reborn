<script lang="ts">
  import type { GachaCardRarityRate } from "$lib/domain/gacha-detail";
  import Icon from "@iconify/svelte";

  const rarityLabelMap: Record<string, string> = {
    rarity_1: "1★",
    rarity_2: "2★",
    rarity_3: "3★",
    rarity_4: "4★",
    rarity_birthday: "4★ (Birthday)",
    rarity_4_birthday: "4★ (Birthday)"
  };

  const rarityBarColorMap: Record<string, string> = {
    rarity_1: "bg-base-content/20",
    rarity_2: "bg-success",
    rarity_3: "bg-info",
    rarity_4: "bg-warning",
    rarity_birthday: "bg-warning",
    rarity_4_birthday: "bg-warning"
  };

  const rarityDotColorMap: Record<string, string> = {
    rarity_1: "bg-base-content/40",
    rarity_2: "bg-success",
    rarity_3: "bg-info",
    rarity_4: "bg-warning",
    rarity_birthday: "bg-warning",
    rarity_4_birthday: "bg-warning"
  };

  let {
    rates,
    title,
    noRatesLabel,
    lotteryTypeMap
  }: {
    rates: GachaCardRarityRate[];
    title: string;
    noRatesLabel: string;
    lotteryTypeMap: Record<string, string>;
  } = $props();

  type GroupedRate = {
    cardRarityType: string;
    segments: { lotteryType: string; rate: number }[];
    totalRate: number;
  };

  const getRarityDisplay = (type: string): string => {
    const key = type.trim().toLowerCase();
    return rarityLabelMap[key] ?? type;
  };

  const getBarColor = (type: string): string => {
    const key = type.trim().toLowerCase();
    return rarityBarColorMap[key] ?? "bg-base-content/20";
  };

  const getDotColor = (type: string): string => {
    const key = type.trim().toLowerCase();
    return rarityDotColorMap[key] ?? "bg-base-content/40";
  };

  /** Group rates by cardRarityType, preserving first-seen order. */
  const groupByRarity = (flatRates: GachaCardRarityRate[]): GroupedRate[] => {
    const order: string[] = [];
    const map = new Map<string, GroupedRate>();

    for (const r of flatRates) {
      if (!r.cardRarityType || r.rate === null) continue;
      const key = r.cardRarityType.trim().toLowerCase();
      const lt = (r.lotteryType ?? "normal").trim().toLowerCase();

      if (!map.has(key)) {
        order.push(key);
        map.set(key, { cardRarityType: key, segments: [], totalRate: 0 });
      }

      const group = map.get(key)!;
      group.segments.push({ lotteryType: lt, rate: r.rate });
      group.totalRate += r.rate;
    }

    return order.map((k) => map.get(k)!);
  };

  let grouped = $derived(groupByRarity(rates));

  const formatRate = (rate: number): string => `${rate.toFixed(2)}%`;

  /** Build tooltip text for a rarity group (shows lottery-type breakdown if multiple). */
  const getGroupTooltip = (group: GroupedRate): string => {
    if (group.segments.length === 1) {
      return `${getRarityDisplay(group.cardRarityType)}: ${formatRate(group.totalRate)}`;
    }
    const lines = group.segments.map(
      (seg) => `  ${lotteryTypeMap[seg.lotteryType] ?? seg.lotteryType}: ${formatRate(seg.rate)}`
    );
    return `${getRarityDisplay(group.cardRarityType)}: ${formatRate(group.totalRate)}\n${lines.join("\n")}`;
  };
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon
        icon="mdi:percent-outline"
        class="size-4 shrink-0 translate-y-[0.5px]"
        aria-hidden="true"
      />
      <span>{title}</span>
    </p>

    {#if rates.length === 0}
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-6 text-center text-sm opacity-70">
        {noRatesLabel}
      </div>
    {:else}
      <!-- Single stacked bar — all rates sum to 100% -->
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
        <div class="flex h-2 overflow-hidden rounded-full bg-base-content/10">
          {#each grouped as group (group.cardRarityType)}
            <div
              class={`h-full transition-[width] duration-300 ease-out ${getBarColor(group.cardRarityType)}`}
              style="width: {Math.max(group.totalRate, 0.3)}%"
              title={getGroupTooltip(group)}
            ></div>
          {/each}
        </div>

        <!-- Legend rows -->
        <div class="mt-3 space-y-1.5">
          {#each grouped as group (group.cardRarityType)}
            <div class="flex items-center gap-2 text-sm">
              <span class={`inline-block size-2 shrink-0 rounded-full ${getDotColor(group.cardRarityType)}`}></span>
              <span class="font-medium">{getRarityDisplay(group.cardRarityType)}</span>
              <span class="ml-auto font-mono tabular-nums">{formatRate(group.totalRate)}</span>
            </div>

            {#if group.segments.length > 1}
              <div class="ml-4 flex flex-wrap gap-x-3 gap-y-0.5">
                {#each group.segments as seg (seg.lotteryType)}
                  <span class="flex items-center gap-1 text-xs opacity-50">
                    <span class="inline-block size-1.5 rounded-full bg-base-content/30"></span>
                    {lotteryTypeMap[seg.lotteryType] ?? seg.lotteryType}: {formatRate(seg.rate)}
                  </span>
                {/each}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </div>
</article>
