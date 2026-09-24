<script lang="ts">
  import Icon from "@iconify/svelte";
  import {
    getCharacterRankRewardDetails,
    summarizeCharacterRanks,
    type CharacterRankSummary
  } from "$lib/domain/character-growth";
  import type { CharacterRankReference } from "$lib/domain/mission";

  let {
    ranks,
    locale,
    t
  }: {
    ranks: Promise<{ items: CharacterRankReference[]; loadFailed: boolean }>;
    locale: string;
    t: (key: string, fallback: string) => string;
  } = $props();

  let showAll = $state(false);

  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const resourceLabel = (resourceType: string | null): string => {
    switch (resourceType) {
      case "coin":
        return t("characterRankResource.coin", "Coins");
      case "jewel":
        return t("characterRankResource.jewel", "Crystals");
      case "material":
        return t("characterRankResource.material", "Material");
      case "honor":
        return t("characterRankResource.honor", "Honor");
      case "bonds_honor":
        return t("characterRankResource.bonds_honor", "Bonds honor");
      case "virtual_coin":
        return t("characterRankResource.virtual_coin", "Virtual coins");
      case "stamp":
        return t("characterRankResource.stamp", "Stamps");
      case "avatar_costume":
        return t("characterRankResource.avatar_costume", "Avatar costumes");
      default:
        return t("characterRankReward", "Reward");
    }
  };
  const rankLabel = (rank: number | null): string =>
    t("characterRankLabel", "Rank {rank}").replace("{rank}", formatNumber(rank ?? 0));
  const rewardsLabel = (rank: CharacterRankReference): string => {
    const details = getCharacterRankRewardDetails(rank);
    if (details.length === 0) return t("characterRankNoRewards", "No rewards are listed.");
    return details
      .map((detail) =>
        detail.resourceQuantity === null
          ? resourceLabel(detail.resourceType)
          : `${resourceLabel(detail.resourceType)} ×${formatNumber(detail.resourceQuantity)}`
      )
      .join(" · ");
  };
  const headerLabel = (summary: CharacterRankSummary): string =>
    [
      t("characterRankSummary", "{count} ranks").replace(
        "{count}",
        formatNumber(summary.rankCount)
      ),
      summary.maxPowerBonusRate === null
        ? null
        : t("characterRankMaxBonus", "Max power bonus +{bonus}%").replace(
            "{bonus}",
            formatNumber(summary.maxPowerBonusRate)
          )
    ]
      .filter(Boolean)
      .join(" · ");
</script>

{#snippet rankRow(rank: CharacterRankReference)}
  <li
    class="flex items-baseline justify-between gap-3 border-b border-(--archive-border-subtle) py-2 text-sm"
  >
    <span class="shrink-0 font-medium text-(--archive-text-strong) tabular-nums">
      {rankLabel(rank.characterRank)}
    </span>
    <span class="min-w-0 text-right wrap-anywhere text-(--archive-text-muted) tabular-nums">
      {rewardsLabel(rank)}
    </span>
  </li>
{/snippet}

<article class="card content-card-shell shadow-sm" aria-labelledby="character-rank-title">
  <div class="card-body gap-4 p-3 sm:p-5">
    {#await ranks}
      <h2
        id="character-rank-title"
        class="flex min-h-7 min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon icon="mdi:medal-outline" class="size-4 shrink-0" aria-hidden="true" />
        <span>{t("characterRankTitle", "Character Rank")}</span>
      </h2>
      <p role="status" class="sr-only">
        {t("characterRankLoading", "Character Rank rewards are loading...")}
      </p>
      <div class="grid gap-4" aria-hidden="true">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {#each [0, 1, 2, 3, 4] as index (index)}
            <div
              class="content-card-inset grid gap-2 rounded-xl border border-(--archive-border-subtle) p-3"
            >
              <div class="h-3 w-3/5 rounded bg-(--archive-surface-default)"></div>
              <div class="h-5 w-2/5 rounded bg-(--archive-surface-default)"></div>
            </div>
          {/each}
        </div>
        <div class="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {#each [0, 1, 2, 3, 4, 5] as index (index)}
            <div class="h-4 rounded bg-(--archive-surface-sunken)"></div>
          {/each}
        </div>
      </div>
    {:then result}
      {@const summary = summarizeCharacterRanks(result.items)}
      <div class="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2
          id="character-rank-title"
          class="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
        >
          <Icon icon="mdi:medal-outline" class="size-4 shrink-0" aria-hidden="true" />
          <span>{t("characterRankTitle", "Character Rank")}</span>
        </h2>
        {#if !result.loadFailed && summary.rankCount > 0}
          <p class="text-xs text-(--archive-text-muted) tabular-nums">{headerLabel(summary)}</p>
        {/if}
      </div>

      {#if result.loadFailed}
        <p class="text-sm text-error" role="alert">
          {t("characterRankLoadFailed", "Character Rank rewards could not be loaded.")}
        </p>
      {:else if summary.rankCount === 0}
        <p class="text-sm text-(--archive-text-muted)">
          {t("characterRankEmpty", "No Character Rank rewards were found.")}
        </p>
      {:else}
        {#if summary.totals.length > 0}
          <dl
            class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
            aria-label={t("characterRankTotalsLabel", "Rewards across all ranks")}
          >
            {#each summary.totals as total (total.resourceType)}
              <div
                class="content-card-inset grid gap-1 rounded-xl border border-(--archive-border-subtle) p-3"
              >
                <dt class="text-xs text-(--archive-text-muted)">
                  {resourceLabel(total.resourceType)}
                </dt>
                <dd class="text-lg font-semibold text-(--archive-text-strong) tabular-nums">
                  {formatNumber(total.quantity)}
                </dd>
              </div>
            {/each}
          </dl>
        {/if}

        <section class="grid gap-2" aria-labelledby="character-rank-list-title">
          <h3
            id="character-rank-list-title"
            class="text-sm font-semibold text-(--archive-text-strong)"
          >
            {showAll
              ? t("characterRankAllTitle", "All ranks")
              : t("characterRankMilestonesTitle", "Milestone ranks")}
          </h3>
          {#if showAll}
            <ul class="max-h-96 overflow-y-auto pr-1">
              {#each result.items as rank (rank.characterRank)}
                {@render rankRow(rank)}
              {/each}
            </ul>
          {:else if summary.milestones.length > 0}
            <ul class="grid gap-x-8 sm:grid-cols-2">
              {#each summary.milestones as rank (rank.characterRank)}
                {@render rankRow(rank)}
              {/each}
            </ul>
          {/if}
          <button
            type="button"
            class="btn btn-ghost btn-sm min-h-10 self-start"
            aria-expanded={showAll}
            onclick={() => (showAll = !showAll)}
          >
            {showAll
              ? t("characterRankShowMilestones", "Show milestone ranks only")
              : t("characterRankShowAll", "Show all {count} ranks").replace(
                  "{count}",
                  formatNumber(summary.rankCount)
                )}
          </button>
        </section>
      {/if}
    {/await}
  </div>
</article>
