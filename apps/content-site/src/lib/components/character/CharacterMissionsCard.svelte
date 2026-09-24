<script lang="ts">
  import Icon from "@iconify/svelte";
  import {
    countCharacterMissionGoals,
    formatCharacterMissionSentence,
    summarizeCharacterMission,
    type CharacterMissionSummary
  } from "$lib/domain/character-growth";
  import type { Mission } from "$lib/domain/mission";

  let {
    missions,
    locale,
    viewAllHref,
    t
  }: {
    missions: Promise<{ items: Mission[]; loadFailed: boolean }>;
    locale: string;
    viewAllHref: string;
    t: (key: string, fallback: string) => string;
  } = $props();

  const formatNumber = (value: number): string => new Intl.NumberFormat(locale).format(value);
  const summaryLabel = (items: Mission[]): string =>
    t("characterMissionsSummary", "{count} missions · {goals} level goals")
      .replace("{count}", formatNumber(items.length))
      .replace("{goals}", formatNumber(countCharacterMissionGoals(items)));
  const targetLabel = (summary: CharacterMissionSummary): string | null => {
    if (summary.lastTarget === null) return null;
    if (summary.firstTarget === null || summary.firstTarget === summary.lastTarget) {
      return formatNumber(summary.lastTarget);
    }
    return t("characterMissionTargetRange", "{first} → {last}")
      .replace("{first}", formatNumber(summary.firstTarget))
      .replace("{last}", formatNumber(summary.lastTarget));
  };
  const goalLabel = (summary: CharacterMissionSummary): string | null => {
    if (summary.goalCount === null) return null;
    return summary.goalCount === 1
      ? t("characterMissionGoalCountOne", "1 goal")
      : t("characterMissionGoalCount", "{count} goals").replace(
          "{count}",
          formatNumber(summary.goalCount)
        );
  };
  const detailLabel = (summary: CharacterMissionSummary): string =>
    [targetLabel(summary), goalLabel(summary)].filter(Boolean).join(" · ");
</script>

<article class="card content-card-shell shadow-sm" aria-labelledby="character-missions-title">
  <div class="card-body gap-4 p-3 sm:p-5">
    <div class="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2
        id="character-missions-title"
        class="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon icon="mdi:playlist-check" class="size-4 shrink-0" aria-hidden="true" />
        <span>{t("characterMissionsTitle", "Character Missions")}</span>
      </h2>
      {#await missions then result}
        {#if !result.loadFailed && result.items.length > 0}
          <p class="text-xs text-(--archive-text-muted) tabular-nums">
            {summaryLabel(result.items)}
          </p>
        {/if}
      {/await}
    </div>

    {#await missions}
      <p role="status" class="sr-only">
        {t("characterMissionsLoading", "Character missions are loading...")}
      </p>
      <ul class="grid gap-2 lg:grid-cols-2" aria-hidden="true">
        {#each [0, 1, 2, 3, 4, 5] as index (index)}
          <li
            class="content-card-inset grid gap-2 rounded-xl border border-(--archive-border-subtle) p-3"
          >
            <div class="h-4 w-4/5 rounded bg-(--archive-surface-default)"></div>
            <div class="h-3 w-2/5 rounded bg-(--archive-surface-default)"></div>
          </li>
        {/each}
      </ul>
    {:then result}
      {#if result.loadFailed}
        <p class="text-sm text-error" role="alert">
          {t("characterMissionsLoadFailed", "Character missions could not be loaded.")}
        </p>
      {:else if result.items.length === 0}
        <p class="text-sm text-(--archive-text-muted)">
          {t("characterMissionsEmpty", "No character missions were found.")}
        </p>
      {:else}
        <ul class="grid gap-2 lg:grid-cols-2">
          {#each result.items as mission (mission.id)}
            {@const summary = summarizeCharacterMission(mission)}
            <li
              class="content-card-inset grid content-start gap-1 rounded-xl border border-(--archive-border-subtle) p-3"
            >
              <p class="text-sm wrap-anywhere text-(--archive-text-strong)">
                {#if summary.isExtra}
                  <span class="badge badge-outline badge-sm mr-1.5 align-middle">
                    {t("characterMissionExtra", "EX")}
                  </span>
                {/if}
                {formatCharacterMissionSentence(
                  mission.sentence ?? t("characterMissionUnnamed", "Mission")
                )}
              </p>
              {#if detailLabel(summary)}
                <p class="text-xs text-(--archive-text-muted) tabular-nums">
                  {detailLabel(summary)}
                </p>
              {/if}
            </li>
          {/each}
        </ul>
        <a class="link link-primary self-start text-sm" href={viewAllHref}>
          {t("characterMissionsViewAll", "See all character missions")}
        </a>
      {/if}
    {/await}
  </div>
</article>
