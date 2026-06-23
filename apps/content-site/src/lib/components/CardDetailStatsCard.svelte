<script lang="ts">
  import type { CardDetail, CardDetailParams, CardParameterSet } from "$lib/card-detail";
  import Icon from "@iconify/svelte";

  let {
    card,
    params,
    title,
    levelLabel,
    performanceLabel,
    techniqueLabel,
    staminaLabel,
    totalLabel,
    specialTrainingBonusLabel,
    episodeBonusLabel,
    masterRankBonusLabel,
    noStatsLabel
  }: {
    card: CardDetail;
    params: CardDetailParams;
    title: string;
    levelLabel: string;
    performanceLabel: string;
    techniqueLabel: string;
    staminaLabel: string;
    totalLabel: string;
    specialTrainingBonusLabel: string;
    episodeBonusLabel: string;
    masterRankBonusLabel: string;
    noStatsLabel: string;
  } = $props();

  let selectedLevel = $state(1);
  const levels = $derived(params.parameters.map((item) => item.level));
  const minLevel = $derived(levels[0] ?? 1);
  const maxLevel = $derived(levels[levels.length - 1] ?? card.trainingMaxLevel ?? card.maxLevel ?? 1);
  const selectedStats = $derived.by<CardParameterSet | null>(() => {
    if (params.parameters.length === 0) {
      return null;
    }

    return (
      params.parameters.find((item) => item.level === selectedLevel) ??
      params.parameters.reduce((nearest, item) =>
        Math.abs(item.level - selectedLevel) < Math.abs(nearest.level - selectedLevel) ? item : nearest
      )
    );
  });
  const formatNumber = (value: number | null): string => (value === null ? "--" : value.toLocaleString());

  $effect(() => {
    if (selectedLevel < minLevel || selectedLevel > maxLevel) {
      selectedLevel = maxLevel;
    }
  });
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-5">
    <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
      <Icon icon="mdi:chart-box-outline" class="size-4" aria-hidden="true" />
      <span>{title}</span>
    </p>

    {#if selectedStats}
      <label class="content-card-inset rounded-xl px-4 py-3">
        <span class="flex items-center justify-between gap-4 text-sm font-semibold">
          <span>{levelLabel}</span>
          <span>{selectedStats.level}</span>
        </span>
        <input
          type="range"
          min={minLevel}
          max={maxLevel}
          bind:value={selectedLevel}
          class="range range-primary range-sm mt-3"
        />
      </label>

      <div class="grid gap-2 sm:grid-cols-2">
        <div class="content-card-inset rounded-xl px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {performanceLabel}
          </p>
          <p class="mt-1 text-xl font-semibold">{formatNumber(selectedStats.performance)}</p>
        </div>
        <div class="content-card-inset rounded-xl px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {techniqueLabel}
          </p>
          <p class="mt-1 text-xl font-semibold">{formatNumber(selectedStats.technique)}</p>
        </div>
        <div class="content-card-inset rounded-xl px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {staminaLabel}
          </p>
          <p class="mt-1 text-xl font-semibold">{formatNumber(selectedStats.stamina)}</p>
        </div>
        <div class="content-card-inset rounded-xl px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{totalLabel}</p>
          <p class="mt-1 text-xl font-semibold">{formatNumber(selectedStats.total)}</p>
        </div>
      </div>

      <div class="content-card-inset rounded-xl px-4 py-3 text-sm">
        <p class="font-semibold">{specialTrainingBonusLabel}: {formatNumber(params.specialTrainingBonus.total)}</p>
        <p class="mt-1 opacity-70">{episodeBonusLabel}: 0</p>
        <p class="opacity-70">{masterRankBonusLabel}: 0</p>
      </div>
    {:else}
      <div class="alert">{noStatsLabel}</div>
    {/if}
  </div>
</article>
