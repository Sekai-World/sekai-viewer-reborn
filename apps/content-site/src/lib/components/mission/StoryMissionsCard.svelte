<script lang="ts">
  import type { SupportedRegion } from "$lib/domain/regions";
  import Icon from "@iconify/svelte";
  import RewardLadder from "$lib/components/shared/RewardLadder.svelte";
  import type { Mission, MissionResourceBoxDetail } from "$lib/domain/mission";
  import { summarizeRewardLadder } from "$lib/domain/reward-ladder";

  let {
    missions,
    region,
    locale,
    t,
    resourceLabel,
    onRetry
  }: {
    missions: Promise<{ items: Mission[]; loadFailed: boolean }>;
    region: SupportedRegion;
    locale: string;
    t: (key: string) => string;
    resourceLabel: (resourceType: string | null) => string;
    onRetry?: () => void;
  } = $props();

  const formatNumber = (value: number): string => new Intl.NumberFormat(locale).format(value);
  const rewardDetails = (mission: Mission): MissionResourceBoxDetail[] =>
    mission.rewards.flatMap((reward) => reward.resourceBox?.details ?? []);
  const targetLabel = (mission: Mission): string =>
    mission.requirement === null
      ? t("mission.storyUnnamed").replace("{id}", formatNumber(mission.id))
      : t("mission.storyEpisodeGoal").replace("{count}", formatNumber(mission.requirement));
  const summaryLabel = (items: Mission[]): string => {
    const targets = items.flatMap((mission) =>
      mission.requirement === null ? [] : [mission.requirement]
    );
    const count = t("mission.storyGoalCount").replace("{count}", formatNumber(items.length));
    if (targets.length === 0) return count;
    const range = t("mission.storyEpisodeRange")
      .replace("{from}", formatNumber(Math.min(...targets)))
      .replace("{to}", formatNumber(Math.max(...targets)));
    return `${count} · ${range}`;
  };
</script>

<section class="content-card-shell min-w-0 rounded-2xl p-4" aria-labelledby="story-missions-title">
  <div class="grid gap-4">
    <h2
      id="story-missions-title"
      class="flex min-w-0 items-center gap-3 text-base font-semibold text-(--archive-text-strong)"
    >
      <Icon icon="mdi:playlist-check" class="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span class="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span class="wrap-anywhere">{t("mission.family.storyMissions")}</span>
        {#await missions}
          <span class="h-4 w-28 rounded bg-(--archive-surface-sunken)" aria-hidden="true"></span>
        {:then result}
          {#if !result.loadFailed && result.items.length > 0}
            <span class="text-sm font-normal text-(--archive-text-muted) tabular-nums">
              {summaryLabel(result.items)}
            </span>
          {/if}
        {/await}
      </span>
    </h2>
    <!-- The data has no mission text; this rule comes from the in-game 完読ミッション announcement. -->
    <p class="text-sm text-(--archive-text-muted)">{t("mission.storyDescription")}</p>

    {#await missions}
      <p role="status" class="sr-only">{t("mission.loading")}</p>
      <div class="grid gap-4" aria-hidden="true">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {#each [0, 1] as index (index)}
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
      {#if result.loadFailed}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="alert" class="text-sm text-error">{t("mission.error")}</p>
          {#if onRetry}
            <button type="button" class="btn btn-link touch-target px-0" onclick={onRetry}>
              {t("mission.retry")}
            </button>
          {/if}
        </div>
      {:else if result.items.length === 0}
        <p class="text-sm text-(--archive-text-muted)">{t("mission.empty")}</p>
      {:else}
        {@const summary = summarizeRewardLadder(result.items, rewardDetails)}
        <RewardLadder
          steps={result.items}
          {summary}
          idPrefix="story-missions"
          {region}
          {locale}
          getKey={(mission) => mission.id}
          getLabel={targetLabel}
          getDetails={rewardDetails}
          {resourceLabel}
          labels={{
            totals: t("mission.storyRewardTotals"),
            milestones: t("mission.storyMilestonesTitle"),
            all: t("mission.storyAllTitle"),
            showAll: t("mission.storyShowAll").replace(
              "{count}",
              formatNumber(result.items.length)
            ),
            showMilestones: t("mission.storyShowMilestones"),
            noRewards: t("mission.noRewards")
          }}
        />
      {/if}
    {/await}
  </div>
</section>
