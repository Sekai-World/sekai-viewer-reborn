<script lang="ts">
  import type { GachaCardRarityRate } from "$lib/domain/gacha-detail";
  import Icon from "@iconify/svelte";
  import GachaProbabilityDetailsDialog from "./GachaProbabilityDetailsDialog.svelte";
  import type { SupportedRegion } from "$lib/domain/regions";

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
  const RATE_CHOICE_LOTTERY_PREFIX = "rate_choice_";

  let {
    rates,
    title,
    noRatesLabel,
    lotteryTypeMap,
    region,
    gachaId,
    probabilityOpenLabel,
    probabilityTitle,
    probabilityCloseLabel,
    probabilityDisclaimer,
    probabilityNormalLabel,
    probabilityWishLabel,
    probabilityUnavailableLabel,
    probabilityLoadingLabel,
    probabilityLoadFailedLabel,
    probabilityRetryLabel,
    probabilityConditionalLabel,
    diagnosticLabels,
    cardIdLabel,
    cardAltSuffix,
    rarityLabels,
    rarityUnknownLabel,
    rateChoiceExplanation
  }: {
    rates: GachaCardRarityRate[];
    title: string;
    noRatesLabel: string;
    lotteryTypeMap: Record<string, string>;
    region: SupportedRegion;
    gachaId: string;
    probabilityOpenLabel: string;
    probabilityTitle: string;
    probabilityCloseLabel: string;
    probabilityDisclaimer: string;
    probabilityNormalLabel: string;
    probabilityWishLabel: string;
    probabilityUnavailableLabel: string;
    probabilityLoadingLabel: string;
    probabilityLoadFailedLabel: string;
    probabilityRetryLabel: string;
    probabilityConditionalLabel: string;
    diagnosticLabels: Record<string, string>;
    cardIdLabel: string;
    cardAltSuffix: string;
    rarityLabels: Record<string, string>;
    rarityUnknownLabel: string;
    rateChoiceExplanation: string;
  } = $props();

  type GroupedRate = {
    cardRarityType: string;
    segments: { lotteryType: string; rate: number }[];
    totalRate: number;
  };

  const getRarityDisplay = (type: string): string => {
    const key = type.trim().toLowerCase();
    return rarityLabels[key] ?? rarityUnknownLabel;
  };

  const getLotteryTypeDisplay = (type: string): string => {
    const key = type.trim().toLowerCase();
    return (
      lotteryTypeMap[key] ??
      (key.startsWith(RATE_CHOICE_LOTTERY_PREFIX)
        ? lotteryTypeMap.rate_choice
        : lotteryTypeMap.unknown)
    );
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
    const map: Record<string, GroupedRate> = {};

    for (const r of flatRates) {
      if (!r.cardRarityType || r.rate === null) continue;
      const key = r.cardRarityType.trim().toLowerCase();
      const lt = (r.lotteryType ?? "normal").trim().toLowerCase();

      if (!map[key]) {
        order.push(key);
        map[key] = { cardRarityType: key, segments: [], totalRate: 0 };
      }

      const group = map[key];
      group.segments.push({ lotteryType: lt, rate: r.rate });
      group.totalRate += r.rate;
    }

    return order.map((key) => map[key]);
  };

  let grouped = $derived(groupByRarity(rates));
  let hasRateChoiceRarity4 = $derived(
    rates.some(
      (rate) =>
        rate.cardRarityType?.trim().toLowerCase() === "rarity_4" &&
        rate.lotteryType?.trim().toLowerCase().startsWith(RATE_CHOICE_LOTTERY_PREFIX)
    )
  );

  const formatRate = (rate: number): string => `${rate.toFixed(2)}%`;

  /** Build tooltip text for a rarity group (shows lottery-type breakdown if multiple). */
  const getGroupTooltip = (group: GroupedRate): string => {
    if (group.segments.length === 1) {
      return `${getRarityDisplay(group.cardRarityType)}: ${formatRate(group.totalRate)}`;
    }
    const lines = group.segments.map(
      (seg) => `  ${getLotteryTypeDisplay(seg.lotteryType)}: ${formatRate(seg.rate)}`
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
      <div class="content-card-inset rounded-xl p-3 sm:px-4">
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
              <span
                class={`inline-block size-2 shrink-0 rounded-full ${getDotColor(group.cardRarityType)}`}
              ></span>
              <span class="font-medium">{getRarityDisplay(group.cardRarityType)}</span>
              <span class="ml-auto font-mono tabular-nums">{formatRate(group.totalRate)}</span>
            </div>

            {#if group.segments.length > 1}
              <div class="ml-4 flex flex-wrap gap-x-3 gap-y-0.5">
                {#each group.segments as seg (seg.lotteryType)}
                  <span class="flex items-center gap-1 text-xs opacity-50">
                    <span class="inline-block size-1.5 rounded-full bg-base-content/30"></span>
                    {getLotteryTypeDisplay(seg.lotteryType)}: {formatRate(seg.rate)}
                  </span>
                {/each}
              </div>
            {/if}
          {/each}
        </div>

        {#if hasRateChoiceRarity4}
          <p class="mt-3 flex items-start gap-2 text-xs/5 opacity-70">
            <Icon
              icon="mdi:information-outline"
              class="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>{rateChoiceExplanation}</span>
          </p>
        {/if}
      </div>
    {/if}
    <GachaProbabilityDetailsDialog
      {region}
      {gachaId}
      openLabel={probabilityOpenLabel}
      title={probabilityTitle}
      closeLabel={probabilityCloseLabel}
      disclaimer={probabilityDisclaimer}
      normalLabel={probabilityNormalLabel}
      wishLabel={probabilityWishLabel}
      unavailableLabel={probabilityUnavailableLabel}
      loadingLabel={probabilityLoadingLabel}
      loadFailedLabel={probabilityLoadFailedLabel}
      retryLabel={probabilityRetryLabel}
      conditionalLabel={probabilityConditionalLabel}
      {cardIdLabel}
      {cardAltSuffix}
      {diagnosticLabels}
      {rarityLabels}
      {rarityUnknownLabel}
    />
  </div>
</article>
