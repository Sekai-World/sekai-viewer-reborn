<script lang="ts" generics="T">
  import type { MissionResourceBoxDetail } from "$lib/domain/mission";
  import type { RewardLadderSummary } from "$lib/domain/reward-ladder";

  let {
    steps,
    summary,
    idPrefix,
    locale,
    getKey,
    getLabel,
    getDetails,
    resourceLabel,
    labels
  }: {
    steps: T[];
    summary: RewardLadderSummary<T>;
    idPrefix: string;
    locale: string;
    getKey: (step: T) => string | number;
    getLabel: (step: T) => string;
    getDetails: (step: T) => MissionResourceBoxDetail[];
    resourceLabel: (resourceType: string | null) => string;
    labels: {
      totals: string;
      milestones: string;
      all: string;
      showAll: string;
      showMilestones: string;
      noRewards: string;
    };
  } = $props();

  let showAll = $state(false);

  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const rewardsLabel = (step: T): string => {
    const details = getDetails(step);
    if (details.length === 0) return labels.noRewards;
    return details
      .map((detail) =>
        detail.resourceQuantity === null
          ? resourceLabel(detail.resourceType)
          : `${resourceLabel(detail.resourceType)} ×${formatNumber(detail.resourceQuantity)}`
      )
      .join(" · ");
  };
</script>

{#snippet stepRow(step: T)}
  <li
    class="flex items-baseline justify-between gap-3 border-b border-(--archive-border-subtle) py-2 text-sm"
  >
    <span class="shrink-0 font-medium text-(--archive-text-strong) tabular-nums">
      {getLabel(step)}
    </span>
    <span class="min-w-0 text-right wrap-anywhere text-(--archive-text-muted) tabular-nums">
      {rewardsLabel(step)}
    </span>
  </li>
{/snippet}

{#if summary.totals.length > 0}
  <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" aria-label={labels.totals}>
    {#each summary.totals as total (total.resourceType)}
      <div
        class="content-card-inset grid gap-1 rounded-xl border border-(--archive-border-subtle) p-3"
      >
        <dt class="text-xs text-(--archive-text-muted)">{resourceLabel(total.resourceType)}</dt>
        <dd class="text-lg font-semibold text-(--archive-text-strong) tabular-nums">
          {formatNumber(total.quantity)}
        </dd>
      </div>
    {/each}
  </dl>
{/if}

<section class="grid gap-2" aria-labelledby={`${idPrefix}-list-title`}>
  <h3 id={`${idPrefix}-list-title`} class="text-sm font-semibold text-(--archive-text-strong)">
    {showAll ? labels.all : labels.milestones}
  </h3>
  {#if showAll}
    <ul class="max-h-96 overflow-y-auto pr-1">
      {#each steps as step (getKey(step))}
        {@render stepRow(step)}
      {/each}
    </ul>
  {:else if summary.milestones.length > 0}
    <ul class="grid gap-x-8 sm:grid-cols-2">
      {#each summary.milestones as step (getKey(step))}
        {@render stepRow(step)}
      {/each}
    </ul>
  {/if}
  <button
    type="button"
    class="btn btn-ghost btn-sm min-h-10 self-start"
    aria-expanded={showAll}
    onclick={() => (showAll = !showAll)}
  >
    {showAll ? labels.showMilestones : labels.showAll}
  </button>
</section>
