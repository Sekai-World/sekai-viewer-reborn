<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { goto, invalidateAll } from "$app/navigation";
  import { SvelteSet, SvelteURLSearchParams } from "svelte/reactivity";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import MissionCatalogue from "$lib/components/mission/MissionCatalogue.svelte";
  import MissionCharacterPicker from "$lib/components/mission/MissionCharacterPicker.svelte";
  import StoryMissionsCard from "$lib/components/mission/StoryMissionsCard.svelte";
  import { groupMissionsByFamily } from "$lib/components/mission/catalogue-groups";
  import {
    missionFamilies,
    type Mission,
    type MissionCharacterOption,
    type MissionFamily,
    type MissionParameterGroupLevel
  } from "$lib/domain/mission";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { createPageTitle } from "$lib/page-title";
  import sourceMessages from "@platform/i18n-source/content-site/mission.json";
  import type { PageProps } from "./$types";

  type MissionPageResponse = {
    items: Mission[];
    pagination: {
      page: number;
      hasNext: boolean;
    };
  };
  type LevelPageResponse = {
    items: MissionParameterGroupLevel[];
    pagination: { page: number; hasNext: boolean };
  };
  type LevelState = {
    expanded: boolean;
    items: MissionParameterGroupLevel[];
    page: number;
    hasNext: boolean;
    loading: boolean;
    error: boolean;
  };

  let { data }: PageProps = $props();
  let resolvedMessages = $state<Record<string, string> | null>(null);
  type FamilySummaryState = {
    status: "loading" | "ready" | "error";
    items: Mission[];
    total: number | null;
  };

  type CharacterOptionsState = {
    status: "loading" | "ready" | "error";
    items: MissionCharacterOption[];
  };

  let items = $state<Mission[]>([]);
  let characterOptions = $state<CharacterOptionsState>({ status: "loading", items: [] });
  // Character lists by region, fetched once each; picking another character reuses them.
  // Deliberately not reactive: the load effect reads it, and a reactive map would rerun
  // that effect on every cache write.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const characterLists = new Map<string, Promise<MissionCharacterOption[]>>();
  // Not reactive: the effect below must not rerun when this changes.
  let characterListRegion: string | null = null;
  let familySummaries = $state<Partial<Record<MissionFamily, FamilySummaryState>>>({});
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isInitialLoading = $state(true);
  let isLoadingMore = $state(false);
  let initialError = $state(false);
  let loadMoreError = $state(false);
  let listRequestId = 0;
  let levelsByGroup = $state<Record<number, LevelState>>({});

  const messages = $derived({
    ...sourceMessages,
    ...resolveStreamingMessages(data.i18nMessages, ["common"]),
    ...resolvedMessages
  });
  const t = $derived(createI18nTranslator(data.uiLocale, messages));
  const labels = $derived({
    title: t("navigation.missions"),
    home: t("home"),
    search: "",
    searchAction: "",
    loading: t("mission.loading"),
    empty: t("mission.empty"),
    error: t("mission.error"),
    retry: t("mission.retry"),
    previous: "",
    next: ""
  });
  const formatNumber = (value: number): string =>
    new Intl.NumberFormat(data.uiLocale).format(value);
  const getTargetLevels = (item: Mission): { level: number; requirement: number }[] =>
    item.family === "characterMissionV2s"
      ? (item.parameterGroup?.levels.flatMap((level, index) =>
          level.requirement === null
            ? []
            : [{ level: level.seq ?? index + 1, requirement: level.requirement }]
        ) ?? [])
      : [];
  const formatTargetLevel = (target: { level: number; requirement: number }): string =>
    t("mission.targetLevel")
      .replace("{level}", formatNumber(target.level))
      .replace("{count}", formatNumber(target.requirement));
  const levelLabel = (level: MissionParameterGroupLevel, index: number): string =>
    level.requirement === null
      ? t("mission.levelUnavailable")
      : formatTargetLevel({ level: level.seq ?? index + 1, requirement: level.requirement });
  const levelRewardLabel = (level: MissionParameterGroupLevel): string | null => {
    const reward = level.reward;
    if (!reward?.resourceType || reward.resourceQuantity === null) return null;
    const typeLabel =
      reward.resourceType === "material" ? t("mission.resource.material") : t("mission.reward");
    return `${typeLabel} ×${formatNumber(reward.resourceQuantity)}`;
  };
  const setLevelState = (id: number, state: LevelState): void => {
    levelsByGroup = { ...levelsByGroup, [id]: state };
  };
  const loadLevels = async (id: number): Promise<void> => {
    const state = levelsByGroup[id] ?? {
      expanded: true,
      items: [],
      page: 0,
      hasNext: true,
      loading: false,
      error: false
    };
    if (state.loading || !state.hasNext) return;
    setLevelState(id, { ...state, expanded: true, loading: true, error: false });
    try {
      const response = await fetch(
        `${resolve("/missions/[region]/parameter-groups/[id]/levels", { region: data.region, id: String(id) })}?page=${state.page + 1}`
      );
      if (!response.ok) throw new Error("Level goals request failed.");
      const next = (await response.json()) as LevelPageResponse;
      const seen = new Set(state.items.map((item) => item.seq));
      const appended = next.items.filter((item) => !seen.has(item.seq));
      setLevelState(id, {
        expanded: true,
        items: [...state.items, ...appended],
        page: next.pagination.page,
        hasNext: next.pagination.hasNext,
        loading: false,
        error: false
      });
    } catch {
      setLevelState(id, { ...state, expanded: true, loading: false, error: true });
    }
  };
  const toggleLevels = (item: Mission): void => {
    const id = item.parameterGroup?.id ?? item.parameterGroupId;
    if (id === null) return;
    const state = levelsByGroup[id];
    if (state?.expanded) {
      setLevelState(id, { ...state, expanded: false });
      return;
    }
    if (state?.items.length) {
      setLevelState(id, { ...state, expanded: true });
      return;
    }
    void loadLevels(id);
  };
  const formatMissionTemplate = (value: string, requirement: number | null): string => {
    const replacement = requirement === null ? "…" : formatNumber(requirement);
    return value.replaceAll("{requirement}", replacement).replaceAll("{progress}", replacement);
  };
  const knownRewardTypes = new Set([
    "coin",
    "jewel",
    "gacha_ticket",
    "material",
    "honor",
    "bonds_honor",
    "virtual_coin"
  ]);
  const resourceLabel = (type: string | null): string =>
    type && knownRewardTypes.has(type) ? t(`mission.resource.${type}`) : t("mission.reward");
  const rewardLabelsOf = (item: Mission): string[] =>
    item.rewards
      .flatMap((reward) =>
        reward.resourceBox?.details.length
          ? reward.resourceBox.details
          : reward.resourceType
            ? [reward]
            : []
      )
      .map((reward) =>
        reward.resourceQuantity === null
          ? resourceLabel(reward.resourceType)
          : `${resourceLabel(reward.resourceType)} ×${formatNumber(reward.resourceQuantity)}`
      );
  // Story missions carry no text, so their target and rewards stand in for a sentence.
  const storyMissionText = (item: Mission, rewardLabels: string[]): string =>
    item.requirement === null
      ? t("mission.storyUnnamed").replace("{id}", formatNumber(item.id))
      : [
          t("mission.storyEpisodeGoal").replace("{count}", formatNumber(item.requirement)),
          ...rewardLabels
        ].join(" · ");
  const toItem = (item: Mission) => {
    const targetLevels = getTargetLevels(item);
    const rewardLabels = rewardLabelsOf(item);
    const fallbackSentence =
      item.family === "storyMissions" ? storyMissionText(item, rewardLabels) : t("mission.unnamed");
    const sentenceRequirement =
      item.family === "characterMissionV2s"
        ? targetLevels.length === 1
          ? (targetLevels[0]?.requirement ?? null)
          : null
        : item.requirement;
    const hasTargetTemplate =
      item.sentence?.includes("{requirement}") || item.sentence?.includes("{progress}");

    const group = item.parameterGroup;
    const groupId = group?.id ?? item.parameterGroupId;
    const state = groupId === null ? null : levelsByGroup[groupId];
    const summaryLevels = group
      ? [
          ...group.levels.slice(0, 3),
          ...(group.lastLevel &&
          !group.levels.slice(0, 3).some((level) => level.seq === group.lastLevel?.seq)
            ? [group.lastLevel]
            : group.levels.length > 3
              ? [group.levels.at(-1)!]
              : [])
        ]
      : [];
    return {
      key: `${item.family}-${item.id}`,
      sentence: formatMissionTemplate(item.sentence ?? fallbackSentence, sentenceRequirement),
      // Normal mission text already states its target; story text is built from it.
      requirementLabel:
        item.family === "normalMissions" && !item.sentence && item.requirement !== null
          ? t("mission.requirement").replace("{count}", formatNumber(item.requirement))
          : null,
      targetLevelsLabel:
        !group && targetLevels.length > 0
          ? targetLevels.length <= 3
            ? t("mission.targetLevelSequence").replace(
                "{levels}",
                targetLevels.map(formatTargetLevel).join(" · ")
              )
            : t("mission.targetLevelContinuation")
                .replace("{levels}", targetLevels.slice(0, 3).map(formatTargetLevel).join(" · "))
                .replace("{lastLevel}", formatTargetLevel(targetLevels.at(-1)!))
                .replace("{count}", formatNumber(targetLevels.length))
          : null,
      targetUnavailableLabel:
        item.family === "characterMissionV2s"
          ? targetLevels.length === 0
            ? t("mission.targetUnavailable")
            : null
          : item.requirement === null && hasTargetTemplate
            ? t("mission.targetUnavailable")
            : null,
      milestones:
        group && groupId !== null && summaryLevels.length > 0
          ? {
              summary: summaryLevels.map((level, index) => ({
                label: levelLabel(level, index),
                rewardLabel: levelRewardLabel(level)
              })),
              totalLabel: t("mission.levelCount").replace(
                "{count}",
                formatNumber(group.totalLevels ?? group.levels.length)
              ),
              expanded: state?.expanded ?? false,
              details: (state?.items ?? []).map((level, index) => ({
                label: levelLabel(level, index),
                rewardLabel: levelRewardLabel(level)
              })),
              loading: state?.loading ?? false,
              error: state?.error ? t("mission.levelsError") : null,
              hasNext: state?.hasNext ?? true,
              toggleLabel: state?.expanded
                ? t("mission.hideLevelDetails")
                : t("mission.levelDetails"),
              loadMoreLabel: state?.loading
                ? t("mission.levelsLoading")
                : t("mission.loadMoreLevels"),
              endLabel: t("mission.levelsEnd"),
              onToggle: () => toggleLevels(item),
              onLoadMore: () => void loadLevels(groupId)
            }
          : null,
      rewardLabels
    };
  };
  const familyCountLabel = (summary: FamilySummaryState): string => {
    if (summary.status === "loading") return "";
    if (summary.total === null) return t("mission.totalUnavailable");
    return summary.total === 1
      ? t("mission.totalCountOne")
      : t("mission.totalCount").replace("{count}", formatNumber(summary.total));
  };
  const overviewGroups = $derived(
    missionFamilies.map((family) => {
      const summary = familySummaries[family] ?? { status: "loading", items: [], total: null };
      return {
        family,
        label: t(`mission.family.${family}`),
        status: summary.status,
        statusLabel: summary.status === "error" ? t("mission.error") : t("mission.loading"),
        countLabel: familyCountLabel(summary),
        browseLabel: t("mission.browseFamily").replace("{family}", t(`mission.family.${family}`)),
        items: summary.items.slice(0, 3).map(toItem)
      };
    })
  );
  const overviewFailed = $derived(
    missionFamilies.every((family) => familySummaries[family]?.status === "error")
  );
  const missionKey = (mission: Mission): string => `${mission.family}-${mission.id}`;
  const queryParams = (
    family: MissionFamily | null,
    page?: number,
    character: number | null = null
  ): SvelteURLSearchParams => {
    const params = new SvelteURLSearchParams();
    if (page !== undefined) params.set("page", String(page));
    if (family) params.set("family", family);
    if (family === "characterMissionV2s" && character !== null) {
      params.set("character", String(character));
    }
    return params;
  };
  const listHref = (region: string): string => {
    const query = queryParams(data.query.family, undefined, data.query.character).toString();
    return `${resolve("/missions/[region]", { region })}${query ? `?${query}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listHref(region)
    }))
  );
  const navigateFamily = (family: MissionFamily | null, character: number | null = null): void => {
    const query = queryParams(family, undefined, character).toString();
    void goto(
      `${resolve("/missions/[region]", { region: data.region })}${query ? `?${query}` : ""}`,
      {
        keepFocus: true,
        noScroll: true
      }
    );
  };
  const selectCharacter = (character: number): void =>
    navigateFamily("characterMissionV2s", character);
  const isCharacterFamily = $derived(data.query.family === "characterMissionV2s");
  const dataHref = (page: number): string => {
    const query = queryParams(data.query.family, page, data.query.character).toString();
    return `${resolve("/missions/[region]/data", { region: data.region })}?${query}`;
  };
  const loadNextPage = async (): Promise<void> => {
    if (!browser || isLoadingMore || !hasNext) return;
    const requestId = listRequestId;
    isLoadingMore = true;
    loadMoreError = false;
    try {
      const response = await fetch(dataHref(currentPage + 1));
      if (!response.ok) throw new Error("Mission list request failed.");
      const next = (await response.json()) as MissionPageResponse;
      if (requestId !== listRequestId) return;
      const seenKeys = new SvelteSet(items.map(missionKey));
      const appendedItems = next.items.filter((item) => {
        const key = missionKey(item);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });
      items = [...items, ...appendedItems];
      currentPage = next.pagination.page;
      hasNext = next.pagination.hasNext;
    } catch {
      if (requestId === listRequestId) loadMoreError = true;
    } finally {
      if (requestId === listRequestId) isLoadingMore = false;
    }
  };

  const fetchCharacterList = (region: string): Promise<MissionCharacterOption[]> => {
    const cached = characterLists.get(region);
    if (cached) return cached;
    const request = fetch(resolve("/missions/[region]/characters", { region }))
      .then(async (response) => {
        if (!response.ok) throw new Error("Mission character list request failed.");
        return ((await response.json()) as { items: MissionCharacterOption[] }).items;
      })
      .catch((error: unknown) => {
        // Forget failures so a retry fetches again.
        characterLists.delete(region);
        throw error;
      });
    characterLists.set(region, request);
    return request;
  };
  const showCharacterList = (region: string): void => {
    characterListRegion = region;
    characterOptions = { status: "loading", items: [] };
    fetchCharacterList(region)
      .then((items) => {
        if (characterListRegion === region) characterOptions = { status: "ready", items };
      })
      .catch(() => {
        if (characterListRegion === region) characterOptions = { status: "error", items: [] };
      });
  };

  $effect(() => {
    // Tracks only the family and region, so choosing another character does not refetch.
    if (!browser || data.query.family !== "characterMissionV2s") return;
    const region = data.region;
    if (characterListRegion !== region) showCharacterList(region);
  });

  $effect(() => {
    const bundle = data.i18nMessages;
    let active = true;
    resolvedMessages = null;
    void Promise.resolve(bundle)
      .then((value) => {
        if (active) resolvedMessages = value;
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  });

  $effect(() => {
    const requestId = ++listRequestId;
    items = [];
    familySummaries = Object.fromEntries(
      data.familyOverviews.map(({ family }) => [
        family,
        { status: "loading", items: [], total: null }
      ])
    );
    currentPage = 1;
    hasNext = false;
    isInitialLoading = data.catalogue !== null;
    isLoadingMore = false;
    initialError = false;
    loadMoreError = false;

    for (const overview of data.familyOverviews) {
      // Runs only in promise callbacks, so reading familySummaries here is not tracked.
      const setSummary = (summary: FamilySummaryState): void => {
        if (requestId !== listRequestId) return;
        familySummaries = { ...familySummaries, [overview.family]: summary };
      };
      void Promise.resolve(overview.summary)
        .then((summary) =>
          setSummary({
            status: summary.loadFailed ? "error" : "ready",
            items: summary.items,
            total: summary.total
          })
        )
        .catch(() => setSummary({ status: "error", items: [], total: null }));
    }

    if (data.catalogue === null) return;
    void Promise.resolve(data.catalogue)
      .then((catalogue) => {
        if (requestId !== listRequestId) return;
        items = catalogue.items;
        currentPage = catalogue.pagination.page;
        hasNext = catalogue.pagination.hasNext;
        initialError = catalogue.loadFailed;
        isInitialLoading = false;
      })
      .catch(() => {
        if (requestId !== listRequestId) return;
        initialError = true;
        isInitialLoading = false;
      });
  });
</script>

<svelte:head
  ><title>{createPageTitle(`${t("navigation.missions")} ${regionLabels[data.region]}`)}</title
  ></svelte:head
>

{#snippet storyMissionsContent()}
  {#if data.storyMissions}
    <StoryMissionsCard
      missions={data.storyMissions}
      locale={data.uiLocale}
      {t}
      {resourceLabel}
      onRetry={() => void invalidateAll()}
    />
  {/if}
{/snippet}

{#snippet characterPrompt()}
  <p class="text-sm text-(--archive-text-muted)">
    {t("mission.characterPrompt")}
  </p>
{/snippet}

{#snippet characterPicker()}
  <MissionCharacterPicker
    characters={characterOptions.items}
    status={characterOptions.status}
    selectedId={data.query.character}
    getImageSrc={getLocalCharacterThumbnailAssetURL}
    labels={{
      title: t("mission.characterPickerTitle"),
      loading: t("mission.characterPickerLoading"),
      error: t("mission.characterPickerError"),
      retry: t("mission.retry"),
      otherGroup: t("mission.characterPickerOtherGroup"),
      selected: t("mission.characterSelected"),
      profile: t("mission.characterProfile"),
      change: t("mission.characterChange"),
      collapse: t("mission.characterCollapse")
    }}
    profileHref={data.query.character === null
      ? null
      : resolve("/character/[region]/[id]", {
          region: data.region,
          id: String(data.query.character)
        })}
    onSelect={selectCharacter}
    onRetry={() => showCharacterList(data.region)}
  />
{/snippet}

<MissionCatalogue
  {labels}
  content={data.storyMissions
    ? storyMissionsContent
    : isCharacterFamily && data.query.character === null
      ? characterPrompt
      : undefined}
  filters={isCharacterFamily ? characterPicker : undefined}
  homeHref={resolve("/")}
  {regions}
  groups={!data.query.family
    ? overviewFailed
      ? []
      : overviewGroups
    : isInitialLoading || initialError
      ? []
      : groupMissionsByFamily(items).map((group) => ({
          family: group.family,
          label: t(`mission.family.${group.family}`),
          countLabel: t("mission.shownCount").replace("{count}", formatNumber(group.items.length)),
          items: group.items.map(toItem)
        }))}
  overview={!data.query.family}
  loadingGroupCount={1}
  status={!data.query.family
    ? overviewFailed
      ? "error"
      : "ready"
    : isInitialLoading
      ? "loading"
      : initialError
        ? "error"
        : "ready"}
  rewardsLabel={t("mission.rewards")}
  catalogueKey={`${data.region}:${data.query.family ?? "all"}:${data.query.character ?? ""}`}
  familyLabel={t("mission.familyLabel")}
  selectedFamily={data.query.family}
  getFamilyLabel={(family) =>
    family === null ? t("mission.family.all") : t(`mission.family.${family}`)}
  onFamilyChange={navigateFamily}
  hasNext={Boolean(data.query.family) && !initialError && hasNext}
  {isLoadingMore}
  loadMoreLabel={t("mission.loadMore")}
  loadingMoreLabel={t("mission.loadingMore")}
  loadMoreError={loadMoreError ? t("mission.loadMoreError") : null}
  onLoadMore={() => void loadNextPage()}
  onRetryLoadMore={() => void loadNextPage()}
  onRetry={() => void invalidateAll()}
/>
