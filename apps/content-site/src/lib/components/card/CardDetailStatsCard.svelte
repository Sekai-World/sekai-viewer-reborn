<script lang="ts">
  import type {
    CardDetail,
    CardDetailEpisode,
    CardDetailParams,
    CardParameterSet
  } from "$lib/domain/card-detail";
  import Icon from "@iconify/svelte";

  let {
    card,
    params,
    episodes,
    title,
    levelLabel,
    performanceLabel,
    techniqueLabel,
    staminaLabel,
    totalLabel,
    bonusSumLabel,
    specialTrainingBonusLabel,
    episodeBonusLabel,
    masterRankBonusLabel,
    noStatsLabel
  }: {
    card: CardDetail;
    params: CardDetailParams;
    episodes: CardDetailEpisode[];
    title: string;
    levelLabel: string;
    performanceLabel: string;
    techniqueLabel: string;
    staminaLabel: string;
    totalLabel: string;
    bonusSumLabel: string;
    specialTrainingBonusLabel: string;
    episodeBonusLabel: string;
    masterRankBonusLabel: string;
    noStatsLabel: string;
  } = $props();

  let selectedLevel = $state(1);
  let lastStatsIdentity = $state("");
  let specialTrainingEnabled = $state(true);
  let firstEpisodeBonusEnabled = $state(true);
  let secondEpisodeBonusEnabled = $state(true);
  let masterRank = $state(5);
  const masterRankRewardsByRarity = [0, 50, 100, 150, 200];
  const levels = $derived(params.parameters.map((item) => item.level));
  const minLevel = $derived(levels[0] ?? 1);
  const maxLevel = $derived(
    levels[levels.length - 1] ?? card.trainingMaxLevel ?? card.maxLevel ?? 1
  );
  const normalMaxLevel = $derived(card.maxLevel ?? maxLevel);
  const maxMasterRank = 5;
  const selectedStats = $derived.by<CardParameterSet | null>(() => {
    if (params.parameters.length === 0) {
      return null;
    }

    return (
      params.parameters.find((item) => item.level === selectedLevel) ??
      params.parameters.reduce((nearest, item) =>
        Math.abs(item.level - selectedLevel) < Math.abs(nearest.level - selectedLevel)
          ? item
          : nearest
      )
    );
  });
  const getRarityPowerBonus = (): number => {
    if (card.rarityType === "rarity_birthday") {
      return masterRankRewardsByRarity[4] ?? 0;
    }

    const rarity = Number(card.rarityType?.replace("rarity_", ""));
    return Number.isFinite(rarity) ? (masterRankRewardsByRarity[rarity] ?? 0) : 0;
  };
  const getSpecialTrainingBonus = (type: "performance" | "technique" | "stamina"): number =>
    specialTrainingEnabled && selectedLevel > normalMaxLevel
      ? params.specialTrainingBonus[type]
      : 0;
  const getEpisodeTypeBonus = (
    episode: CardDetailEpisode,
    type: "performance" | "technique" | "stamina"
  ): number => {
    if (type === "performance") {
      return episode.performanceBonus;
    }
    if (type === "technique") {
      return episode.techniqueBonus;
    }
    return episode.staminaBonus;
  };
  const getEpisodeBonus = (type: "performance" | "technique" | "stamina"): number => {
    const firstEpisode = episodes[0];
    const secondEpisode = episodes[1];
    return (
      (firstEpisodeBonusEnabled && firstEpisode ? getEpisodeTypeBonus(firstEpisode, type) : 0) +
      (secondEpisodeBonusEnabled && secondEpisode ? getEpisodeTypeBonus(secondEpisode, type) : 0)
    );
  };
  const getMasterRankBonus = (): number => masterRank * getRarityPowerBonus();
  const withBonuses = (
    baseValue: number | null,
    type: "performance" | "technique" | "stamina"
  ): number | null =>
    baseValue === null
      ? null
      : baseValue + getSpecialTrainingBonus(type) + getEpisodeBonus(type) + getMasterRankBonus();
  const displayedStats = $derived(
    selectedStats
      ? {
          level: selectedStats.level,
          performance: withBonuses(selectedStats.performance, "performance"),
          technique: withBonuses(selectedStats.technique, "technique"),
          stamina: withBonuses(selectedStats.stamina, "stamina"),
          total: (() => {
            const values = [
              withBonuses(selectedStats.performance, "performance"),
              withBonuses(selectedStats.technique, "technique"),
              withBonuses(selectedStats.stamina, "stamina")
            ];
            return values.every((value): value is number => value !== null)
              ? values.reduce((sum, value) => sum + value, 0)
              : null;
          })()
        }
      : null
  );
  const specialTrainingBonusTotal = $derived(
    selectedLevel > normalMaxLevel && specialTrainingEnabled ? params.specialTrainingBonus.total : 0
  );
  const episodeBonusTotal = $derived(
    getEpisodeBonus("performance") + getEpisodeBonus("technique") + getEpisodeBonus("stamina")
  );
  const masterRankBonusTotal = $derived(getMasterRankBonus() * 3);
  const bonusSumTotal = $derived(
    specialTrainingBonusTotal + episodeBonusTotal + masterRankBonusTotal
  );
  const statSegments = $derived.by(() => {
    if (!selectedStats) {
      return { performance: 0, technique: 0, stamina: 0, bonus: 0 };
    }

    const performance = selectedStats.performance ?? 0;
    const technique = selectedStats.technique ?? 0;
    const stamina = selectedStats.stamina ?? 0;
    const bonus = bonusSumTotal;
    const sum = performance + technique + stamina + bonus;
    if (sum <= 0) {
      return { performance: 0, technique: 0, stamina: 0, bonus: 0 };
    }

    return {
      performance: (performance / sum) * 100,
      technique: (technique / sum) * 100,
      stamina: (stamina / sum) * 100,
      bonus: (bonus / sum) * 100
    };
  });
  const formatNumber = (value: number | null): string =>
    value === null ? "--" : value.toLocaleString();
  const clampNumber = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));
  const setSelectedLevel = (value: string): void => {
    const nextValue = Number(value);
    if (Number.isFinite(nextValue)) {
      selectedLevel = clampNumber(Math.trunc(nextValue), minLevel, maxLevel);
    }
  };
  const setMasterRank = (value: string): void => {
    const nextValue = Number(value);
    if (Number.isFinite(nextValue)) {
      masterRank = clampNumber(Math.trunc(nextValue), 0, maxMasterRank);
    }
  };
  const getStatAccentClass = (type: "performance" | "technique" | "stamina" | "total"): string => {
    if (type === "performance") {
      return "border-pink-400/35 bg-pink-500/10 text-pink-500 dark:text-pink-300";
    }
    if (type === "technique") {
      return "border-sky-400/35 bg-sky-500/10 text-sky-500 dark:text-sky-300";
    }
    if (type === "stamina") {
      return "border-emerald-400/35 bg-emerald-500/10 text-emerald-500 dark:text-emerald-300";
    }
    return "border-primary/25 bg-primary/10 text-primary";
  };
  const formatPercent = (value: number): string => `${Math.max(0, Math.min(100, value))}%`;

  $effect(() => {
    const nextStatsIdentity = `${card.id}:${minLevel}:${maxLevel}:${params.parameters.length}`;
    if (nextStatsIdentity !== lastStatsIdentity) {
      lastStatsIdentity = nextStatsIdentity;
      selectedLevel = maxLevel;
      masterRank = maxMasterRank;
      specialTrainingEnabled = true;
      firstEpisodeBonusEnabled = true;
      secondEpisodeBonusEnabled = true;
      return;
    }

    if (selectedLevel < minLevel || selectedLevel > maxLevel) {
      selectedLevel = maxLevel;
    }
    if (masterRank < 0 || masterRank > maxMasterRank) {
      masterRank = maxMasterRank;
    }
  });
</script>

{#snippet statPanel(
  label: string,
  value: number | null,
  type: "performance" | "technique" | "stamina" | "total"
)}
  <div
    class={`content-card-inset rounded-xl border px-3 sm:px-4 py-2.5 ${getStatAccentClass(type)}`}
  >
    <div class="flex items-center justify-between gap-4">
      <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p class="text-right text-lg font-semibold tabular-nums text-base-content">
        {formatNumber(value)}
      </p>
    </div>
  </div>
{/snippet}

{#snippet totalPanel(value: number | null)}
  <div
    class={`content-card-inset rounded-xl border px-3 sm:px-4 py-2.5 ${getStatAccentClass("total")}`}
  >
    <div class="flex items-center justify-between gap-4">
      <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{totalLabel}</p>
      <p class="text-right text-lg font-semibold tabular-nums text-base-content">
        {formatNumber(value)}
      </p>
    </div>
    <div class="mt-2 flex h-2 overflow-hidden rounded-full bg-base-content/10">
      <div
        class="h-full bg-pink-500 transition-[width] duration-300 ease-out"
        style={`width: ${formatPercent(statSegments.performance)}`}
      ></div>
      <div
        class="h-full bg-sky-500 transition-[width] duration-300 ease-out"
        style={`width: ${formatPercent(statSegments.technique)}`}
      ></div>
      <div
        class="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
        style={`width: ${formatPercent(statSegments.stamina)}`}
      ></div>
      <div
        class="h-full bg-base-content/35 transition-[width] duration-300 ease-out"
        style={`width: ${formatPercent(statSegments.bonus)}`}
      ></div>
    </div>
  </div>
{/snippet}

{#snippet bonusRow(label: string, value: number)}
  <p class="flex items-center justify-between gap-4">
    <span class="opacity-70">{label}</span>
    <span class="font-semibold tabular-nums text-base-content">{formatNumber(value)}</span>
  </p>
{/snippet}

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon icon="mdi:chart-box-outline" class="size-4" aria-hidden="true" />
      <span>{title}</span>
    </p>

    {#if displayedStats}
      <div class="grid gap-3 lg:grid-cols-2 lg:items-start">
        <div class="space-y-3">
          <label class="content-card-inset block rounded-xl p-3 sm:px-4">
            <span class="flex items-center justify-between gap-4 text-sm font-semibold">
              <span>{levelLabel}</span>
              <input
                type="number"
                min={minLevel}
                max={maxLevel}
                value={selectedLevel}
                class="input input-bordered input-xs h-8 w-20 text-right tabular-nums"
                aria-label={levelLabel}
                onchange={(event) => setSelectedLevel(event.currentTarget.value)}
              />
            </span>
            <input
              type="range"
              min={minLevel}
              max={maxLevel}
              bind:value={selectedLevel}
              class="range range-primary range-sm mt-3"
            />
          </label>

          <div class="content-card-inset space-y-3 rounded-xl p-3 sm:px-4 text-sm">
            <label class="flex items-center justify-between gap-3">
              <span class="font-semibold">{specialTrainingBonusLabel}</span>
              <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                bind:checked={specialTrainingEnabled}
              />
            </label>

            <div class="space-y-2">
              <p class="font-semibold">{episodeBonusLabel}</p>
              <div class="flex flex-wrap gap-2">
                {#if episodes[0]}
                  <button
                    type="button"
                    class={`btn btn-sm min-h-10! ${firstEpisodeBonusEnabled ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
                    onclick={() => (firstEpisodeBonusEnabled = !firstEpisodeBonusEnabled)}
                  >
                    #{episodes[0].episodeNo ?? 1}
                  </button>
                {/if}
                {#if episodes[1]}
                  <button
                    type="button"
                    class={`btn btn-sm min-h-10! ${secondEpisodeBonusEnabled ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
                    onclick={() => (secondEpisodeBonusEnabled = !secondEpisodeBonusEnabled)}
                  >
                    #{episodes[1].episodeNo ?? 2}
                  </button>
                {/if}
              </div>
            </div>

            <label class="block">
              <span class="flex items-center justify-between gap-4 font-semibold">
                <span>{masterRankBonusLabel}</span>
                <span class="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max={maxMasterRank}
                    value={masterRank}
                    class="input input-bordered input-xs h-8 w-16 text-right tabular-nums"
                    aria-label={masterRankBonusLabel}
                    onchange={(event) => setMasterRank(event.currentTarget.value)}
                  />
                  <span class="opacity-60">/{maxMasterRank}</span>
                </span>
              </span>
              <input
                type="range"
                min="0"
                max={maxMasterRank}
                bind:value={masterRank}
                class="range range-primary range-sm mt-3"
              />
            </label>
          </div>
        </div>

        <div class="space-y-3">
          <div class="space-y-2">
            {@render statPanel(performanceLabel, displayedStats.performance, "performance")}
            {@render statPanel(techniqueLabel, displayedStats.technique, "technique")}
            {@render statPanel(staminaLabel, displayedStats.stamina, "stamina")}
          </div>

          <div class="content-card-inset rounded-xl p-3 sm:px-4 text-sm">
            <p class="flex items-center justify-between gap-4 font-semibold">
              <span>{bonusSumLabel}</span>
              <span class="tabular-nums text-base-content">{formatNumber(bonusSumTotal)}</span>
            </p>
            <div class="mt-2 space-y-1">
              {@render bonusRow(specialTrainingBonusLabel, specialTrainingBonusTotal)}
              {@render bonusRow(episodeBonusLabel, episodeBonusTotal)}
              {@render bonusRow(masterRankBonusLabel, masterRankBonusTotal)}
            </div>
          </div>

          <div class="pt-2">
            {@render totalPanel(displayedStats.total)}
          </div>
        </div>
      </div>
    {:else}
      <div class="alert">{noStatsLabel}</div>
    {/if}
  </div>
</article>
