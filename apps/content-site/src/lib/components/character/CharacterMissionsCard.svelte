<script lang="ts">
  import Icon from "@iconify/svelte";
  import CharacterMissionGrid from "$lib/components/mission/CharacterMissionGrid.svelte";
  import { countCharacterMissionGoals } from "$lib/domain/character-growth";
  import type { Mission } from "$lib/domain/mission";
  import type { SupportedRegion } from "$lib/domain/regions";

  let {
    missions,
    region,
    locale,
    viewAllHref,
    t
  }: {
    missions: Promise<{ items: Mission[]; loadFailed: boolean }>;
    region: SupportedRegion;
    locale: string;
    viewAllHref: string;
    t: (key: string, fallback: string) => string;
  } = $props();

  // The profile previews a few missions; the Missions page lists the rest.
  const PREVIEW_COUNT = 6;
  const formatNumber = (value: number): string => new Intl.NumberFormat(locale).format(value);
  const summaryLabel = (items: Mission[]): string =>
    t("characterMissionsSummary", "{count} missions · {goals} level goals")
      .replace("{count}", formatNumber(items.length))
      .replace("{goals}", formatNumber(countCharacterMissionGoals(items)));
  const resourceLabel = (resourceType: string | null): string =>
    resourceType === "material"
      ? t("characterMissionMaterial", "Material")
      : t("characterMissionReward", "Reward");
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
        <CharacterMissionGrid
          missions={result.items.slice(0, PREVIEW_COUNT)}
          {region}
          {locale}
          labels={{
            extra: t("characterMissionExtra", "EX"),
            unnamed: t("characterMissionUnnamed", "Mission"),
            close: t("characterMissionClose", "Close"),
            goalCount: t("characterMissionGoalCount", "{count} goals"),
            goalCountOne: t("characterMissionGoalCountOne", "1 goal"),
            loading: t("characterMissionLevelsLoading", "Loading level goals..."),
            error: t("characterMissionLevelsError", "Level goals could not be loaded."),
            unavailable: t(
              "characterMissionUnavailable",
              "Level goals are unavailable in this region."
            ),
            retry: t("characterMissionRetry", "Try again"),
            level: t("characterMissionLevel", "Level {level} · {count}"),
            exp: t("characterMissionExp", "EXP +{count}"),
            resourceLabel
          }}
        />
        <a
          class="link inline-flex min-h-11 items-center gap-1 self-start text-sm link-primary"
          href={viewAllHref}
        >
          {t("characterMissionsViewAll", "See all character missions")}
          <Icon icon="mdi:arrow-right" class="size-4" aria-hidden="true" />
        </a>
      {/if}
    {/await}
  </div>
</article>
