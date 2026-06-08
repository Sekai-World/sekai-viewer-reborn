<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { asset, resolve } from "$app/paths";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { getContentDisplaySettings } from "$lib/content-display-settings";
  import { toTimestampMs } from "$lib/date-time";
  import MusicListCard from "$lib/components/MusicListCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/RegionBadgeSwitch.svelte";
  import { createCommonTranslator, setI18nLocale, tCommon } from "$lib/i18n";
  import { regionLabels, supportedRegions } from "$lib/regions";
  import {
    formatUnitFallbackLabel,
    musicTagByUnitCode,
    unitCodeByMusicTag
  } from "$lib/unit-profile";
  import Icon from "@iconify/svelte";
  import type { PageData } from "./$types";

  type MusicListPagePayload = PageData["initialPage"];
  type MusicListItem = MusicListPagePayload["items"][number];
  type MusicListSortBy = "publishedAt" | "id";
  type MusicListSortOrder = "asc" | "desc";
  type MusicListViewMode = "grid" | "agenda";
  type MusicTextFilter = {
    value: string;
    label: string;
    listId: string;
    options: string[];
    placeholder: string;
    set: (value: string) => void;
  };

  let { data }: { data: PageData } = $props();
  const getInitialCommonText = (key: string): string =>
    createCommonTranslator(data.uiLocale, data.commonMessages)(key);

  let items = $state<MusicListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isLoading = $state(false);
  let isReloading = $state(false);
  let errorMessage = $state<string | null>(null);
  let sentinel: HTMLDivElement | null = $state(null);
  let isLoadMoreHintVisible = $state(false);
  let isTouchPointer = $state(false);
  let lastTouchY = $state<number | null>(null);
  let sortBy = $state<MusicListSortBy>("publishedAt");
  let sortOrder = $state<MusicListSortOrder>("desc");
  let nameFilter = $state("");
  let categoryFilter = $state<string[]>([]);
  let composerFilter = $state("");
  let arrangerFilter = $state("");
  let lyricistFilter = $state("");
  let vocalCharacterFilter = $state<string[]>([]);
  let tagFilter = $state<string[]>([]);
  let hasAppendFilter = $state(false);
  let levelFilter = $state("");
  let spoilerFilter = $state(false);
  let nameDraft = $state("");
  let categoryDraft = $state<string[]>([]);
  let composerDraft = $state("");
  let arrangerDraft = $state("");
  let lyricistDraft = $state("");
  let vocalCharacterDraft = $state<string[]>([]);
  let tagDraft = $state<string[]>([]);
  let hasAppendDraft = $state(false);
  let levelDraft = $state("");
  let viewMode = $state<MusicListViewMode>("grid");
  let filterDialog: HTMLDialogElement | null = $state(null);
  let initialStateKey = $state("");
  let restoredPreferences = $state(false);
  let spoilerContentAppliedState = $state<boolean | null>(null);
  const contentDisplaySettings = getContentDisplaySettings();

  let homeLabel = $state(getInitialCommonText("home"));
  let idLabel = $state(getInitialCommonText("idLabel"));
  let closeLabel = $state(getInitialCommonText("closeLabel"));
  let clearLabel = $state(getInitialCommonText("clearLabel"));
  let musicListTitle = $state(getInitialCommonText("musicListTitle"));
  let musicListEmpty = $state(getInitialCommonText("musicListEmpty"));
  let musicListEnd = $state(getInitialCommonText("musicListEnd"));
  let musicListLoading = $state(getInitialCommonText("musicListListLoading"));
  let musicListLoadingMore = $state(getInitialCommonText("musicListLoadingMore"));
  let musicListLoadMoreHintDesktop = $state(getInitialCommonText("musicListLoadMoreHintDesktop"));
  let musicListLoadMoreHintMobile = $state(getInitialCommonText("musicListLoadMoreHintMobile"));
  let musicListLoadFailed = $state(getInitialCommonText("musicListLoadFailed"));
  let musicListOpenFilters = $state(getInitialCommonText("musicListOpenFilters"));
  let musicListFiltersTitle = $state(getInitialCommonText("musicListFiltersTitle"));
  let musicListFilterNameLabel = $state(getInitialCommonText("musicListFilterNameLabel"));
  let musicListFilterNamePlaceholder = $state(
    getInitialCommonText("musicListFilterNamePlaceholder")
  );
  let musicListFilterCategoryLabel = $state(getInitialCommonText("musicListFilterCategoryLabel"));
  let musicListComposerLabel = $state(getInitialCommonText("musicListComposerLabel"));
  let musicListComposerPlaceholder = $state(getInitialCommonText("musicListComposerPlaceholder"));
  let musicListArrangerLabel = $state(getInitialCommonText("musicListArrangerLabel"));
  let musicListArrangerPlaceholder = $state(getInitialCommonText("musicListArrangerPlaceholder"));
  let musicListLyricistLabel = $state(getInitialCommonText("musicListLyricistLabel"));
  let musicListLyricistPlaceholder = $state(getInitialCommonText("musicListLyricistPlaceholder"));
  let musicListVocalCharacterLabel = $state(getInitialCommonText("musicListVocalCharacterLabel"));
  let musicListTagLabel = $state(getInitialCommonText("musicListVocalUnitTagLabel"));
  let musicListDifficultyLabel = $state(getInitialCommonText("musicListDifficultyLabel"));
  let musicListHasAppendDifficultyLabel = $state(
    getInitialCommonText("musicListHasAppendDifficultyLabel")
  );
  let musicListLevelLabel = $state(getInitialCommonText("musicListLevelLabel"));
  let musicListLevelPlaceholder = $state(getInitialCommonText("musicListLevelPlaceholder"));
  let musicListFilterReset = $state(getInitialCommonText("musicListFilterReset"));
  let musicListFilterApply = $state(getInitialCommonText("musicListFilterApply"));
  let musicListSortById = $state(getInitialCommonText("musicListSortById"));
  let musicListSortByPublishedAt = $state(getInitialCommonText("musicListSortByPublishedAt"));
  let musicListViewGrid = $state(getInitialCommonText("musicListViewGrid"));
  let musicListViewAgenda = $state(getInitialCommonText("musicListViewAgenda"));
  let musicListCreatorLabel = $state(getInitialCommonText("musicListCreatorLabel"));
  let musicJacketAltSuffix = $state(getInitialCommonText("musicJacketAltSuffix"));
  let spoilerContentLabel = $state(getInitialCommonText("spoilerContent"));
  const gameCharacterValues = Array.from({ length: 26 }, (_, index) => String(index + 1));
  const musicTagOptions = [
    "all",
    "vocaloid",
    "theme_park",
    "street",
    "idol",
    "school_refusal",
    "light_music_club",
    "other"
  ] as const;

  const textFilters = $derived.by((): MusicTextFilter[] => [
    {
      value: levelDraft,
      label: musicListLevelLabel,
      listId: "music-levels",
      options: data.filterMeta.levels,
      placeholder: musicListLevelPlaceholder,
      set: (value: string) => (levelDraft = value)
    },
    {
      value: composerDraft,
      label: musicListComposerLabel,
      listId: "music-composers",
      options: data.filterMeta.composers,
      placeholder: musicListComposerPlaceholder,
      set: (value: string) => (composerDraft = value)
    },
    {
      value: arrangerDraft,
      label: musicListArrangerLabel,
      listId: "music-arrangers",
      options: data.filterMeta.arrangers,
      placeholder: musicListArrangerPlaceholder,
      set: (value: string) => (arrangerDraft = value)
    },
    {
      value: lyricistDraft,
      label: musicListLyricistLabel,
      listId: "music-lyricists",
      options: data.filterMeta.lyricists,
      placeholder: musicListLyricistPlaceholder,
      set: (value: string) => (lyricistDraft = value)
    }
  ]);

  const getCategoryLabel = (category: string): string =>
    tCommon(data.uiLocale, `musicListCategory.${category}`, category);

  const formatOptionLabel = (value: string): string =>
    value
      .replaceAll("_", " ")
      .split(" ")
      .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
      .join(" ");

  const getMusicTagLabel = (value: string): string =>
    unitCodeByMusicTag[value]
      ? (data.unitProfiles[unitCodeByMusicTag[value]] ??
        formatUnitFallbackLabel(unitCodeByMusicTag[value]))
      : tCommon(data.uiLocale, `musicListTag.${value}`, formatOptionLabel(value));

  const getFilterButtonClass = (values: string[], value: string): string =>
    values.includes(value) ? "btn-primary" : "btn-outline border-primary text-primary";

  const toggleDraftValue = (values: string[], value: string, checked: boolean): string[] =>
    checked ? [...new Set([...values, value])] : values.filter((entry) => entry !== value);

  const getMusicTagIconUrl = (value: (typeof musicTagOptions)[number]): string | null => {
    const icon = unitCodeByMusicTag[value];
    return icon ? asset(`/icons/icon_${icon}.png`) : null;
  };

  const mapLegacyVocalUnitToTag = (value: string): string =>
    musicTagByUnitCode[value] ?? value;

  const getCharacterThumbnailUrl = (value: string): string | null => {
    const id = Number.parseInt(value, 10);
    if (!Number.isFinite(id)) {
      return null;
    }

    return asset(`/chr_ts/chr_ts_${id}_g1.png`);
  };

  const isSpoilerMusic = (item: MusicListItem): boolean => {
    const publishedAtMs = toTimestampMs(item.publishedAt);
    return publishedAtMs !== null && publishedAtMs > Date.now();
  };

  const visibleItems = $derived.by(() => {
    if (spoilerFilter) {
      return items;
    }

    return items.filter((item) => !isSpoilerMusic(item));
  });

  const hasFilters = (): boolean =>
    Boolean(
      nameFilter ||
      categoryFilter.length ||
      composerFilter ||
      arrangerFilter ||
      lyricistFilter ||
      vocalCharacterFilter.length ||
      tagFilter.length ||
      hasAppendFilter ||
      levelFilter
    );

  const syncDrafts = (): void => {
    nameDraft = nameFilter;
    categoryDraft = [...categoryFilter];
    composerDraft = composerFilter;
    arrangerDraft = arrangerFilter;
    lyricistDraft = lyricistFilter;
    vocalCharacterDraft = [...vocalCharacterFilter];
    tagDraft = [...tagFilter];
    hasAppendDraft = hasAppendFilter;
    levelDraft = levelFilter;
  };

  const getPreferenceKey = (): string => `content-site:music-list-filters:${data.region}`;
  const getViewKey = (): string => "content-site:music-list-view-mode";

  $effect(() => {
    const key = `${data.region}|${data.initialQuery.sortBy}|${data.initialQuery.sortOrder}|${data.initialQuery.name}|${data.initialQuery.categories}|${data.initialQuery.composer}|${data.initialQuery.arranger}|${data.initialQuery.lyricist}|${data.initialQuery.vocalCharacter}|${data.initialQuery.tags}|${data.initialQuery.hasAppend ? "1" : "0"}|${data.initialQuery.level}|${data.initialQuery.spoiler ? "1" : "0"}`;
    if (key === initialStateKey) {
      return;
    }

    initialStateKey = key;
    items = data.initialPage.items;
    currentPage = data.initialPage.pagination.page;
    hasNext = data.initialPage.pagination.hasNext;
    sortBy = data.initialQuery.sortBy;
    sortOrder = data.initialQuery.sortOrder;
    nameFilter = data.initialQuery.name;
    categoryFilter = [...data.initialQuery.categories];
    composerFilter = data.initialQuery.composer;
    arrangerFilter = data.initialQuery.arranger;
    lyricistFilter = data.initialQuery.lyricist;
    vocalCharacterFilter = [...data.initialQuery.vocalCharacter];
    tagFilter = [...data.initialQuery.tags];
    hasAppendFilter = data.initialQuery.hasAppend;
    levelFilter = data.initialQuery.level;
    spoilerFilter = data.initialQuery.spoiler;
    syncDrafts();
    errorMessage = data.initialLoadFailed ? musicListLoadFailed : null;
  });

  $effect(() => {
    const translate = createCommonTranslator(data.uiLocale, data.commonMessages);
    applyTranslations(translate);
    void refreshTranslations(data.uiLocale);
  });

  $effect(() => {
    if (!browser || !sentinel || !hasNext) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        isLoadMoreHintVisible = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0.96 }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    isTouchPointer = window.matchMedia("(pointer: coarse)").matches;
  });

  $effect(() => {
    if (!browser || !hasNext) {
      return;
    }

    const triggerLoadMore = (): void => {
      if (!isLoadMoreHintVisible || isLoading || !hasNext) {
        return;
      }

      void loadMore();
    };

    const handleWheel = (event: WheelEvent): void => {
      if (event.deltaY > 0) {
        triggerLoadMore();
      }
    };

    const handleTouchStart = (event: TouchEvent): void => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent): void => {
      const nextTouchY = event.touches[0]?.clientY ?? null;
      if (lastTouchY === null || nextTouchY === null) {
        lastTouchY = nextTouchY;
        return;
      }

      const deltaY = lastTouchY - nextTouchY;
      lastTouchY = nextTouchY;
      if (deltaY > 12) {
        triggerLoadMore();
      }
    };

    const handleTouchEnd = (): void => {
      lastTouchY = null;
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  });

  $effect(() => {
    if (!browser || restoredPreferences) {
      return;
    }

    restoredPreferences = true;
    const storedView = localStorage.getItem(getViewKey());
    if (storedView === "grid" || storedView === "agenda") {
      viewMode = storedView;
    }

    if (new URL(window.location.href).search.length > 0) {
      return;
    }

    const raw = localStorage.getItem(getPreferenceKey());
    if (!raw) {
      return;
    }

    try {
      const stored = JSON.parse(raw) as Record<string, unknown>;
      sortBy = stored.sortBy === "id" ? "id" : "publishedAt";
      sortOrder = stored.sortOrder === "asc" ? "asc" : "desc";
      nameFilter = typeof stored.name === "string" ? stored.name : "";
      categoryFilter = Array.isArray(stored.categories)
        ? stored.categories.filter((value): value is string => typeof value === "string")
        : [];
      composerFilter = typeof stored.composer === "string" ? stored.composer : "";
      arrangerFilter = typeof stored.arranger === "string" ? stored.arranger : "";
      lyricistFilter = typeof stored.lyricist === "string" ? stored.lyricist : "";
      vocalCharacterFilter = Array.isArray(stored.vocalCharacter)
        ? stored.vocalCharacter.filter((value): value is string => typeof value === "string")
        : typeof stored.vocalCharacter === "string" && stored.vocalCharacter
          ? [stored.vocalCharacter]
          : [];
      const storedTags = Array.isArray(stored.tags)
        ? stored.tags.filter((value): value is string => typeof value === "string")
        : typeof stored.tag === "string" && stored.tag
          ? [stored.tag]
          : [];
      const storedVocalUnitTags = Array.isArray(stored.vocalUnit)
        ? stored.vocalUnit
            .filter((value): value is string => typeof value === "string")
            .map(mapLegacyVocalUnitToTag)
        : typeof stored.vocalUnit === "string" && stored.vocalUnit
          ? [mapLegacyVocalUnitToTag(stored.vocalUnit)]
          : [];
      tagFilter = [...new Set([...storedTags, ...storedVocalUnitTags])];
      hasAppendFilter =
        stored.hasAppend === true ||
        (Array.isArray(stored.difficulty) && stored.difficulty.includes("append")) ||
        stored.difficulty === "append";
      levelFilter = typeof stored.level === "string" ? stored.level : "";
      syncDrafts();
      void reloadFirstPage();
    } catch {
      localStorage.removeItem(getPreferenceKey());
    }
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    const showSpoilerContent = contentDisplaySettings.showSpoilerContent;
    const isInitialSpoilerState = spoilerContentAppliedState === null;
    if (spoilerContentAppliedState === showSpoilerContent) {
      return;
    }

    spoilerContentAppliedState = showSpoilerContent;
    const searchParams = new URL(window.location.href).searchParams;
    const hasSpoilerQueryParam = searchParams.has("spoiler");
    const requestIncludesSpoilers = searchParams.get("spoiler") === "true";
    if (isInitialSpoilerState && hasSpoilerQueryParam) {
      return;
    }

    if (requestIncludesSpoilers !== showSpoilerContent) {
      spoilerFilter = showSpoilerContent;
      void reloadFirstPage();
    }
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    idLabel = translate("idLabel");
    closeLabel = translate("closeLabel");
    clearLabel = translate("clearLabel");
    musicListTitle = translate("musicListTitle");
    musicListEmpty = translate("musicListEmpty");
    musicListEnd = translate("musicListEnd");
    musicListLoading = translate("musicListListLoading");
    musicListLoadingMore = translate("musicListLoadingMore");
    musicListLoadMoreHintDesktop = translate("musicListLoadMoreHintDesktop");
    musicListLoadMoreHintMobile = translate("musicListLoadMoreHintMobile");
    musicListLoadFailed = translate("musicListLoadFailed");
    musicListOpenFilters = translate("musicListOpenFilters");
    musicListFiltersTitle = translate("musicListFiltersTitle");
    musicListFilterNameLabel = translate("musicListFilterNameLabel");
    musicListFilterNamePlaceholder = translate("musicListFilterNamePlaceholder");
    musicListFilterCategoryLabel = translate("musicListFilterCategoryLabel");
    musicListComposerLabel = translate("musicListComposerLabel");
    musicListComposerPlaceholder = translate("musicListComposerPlaceholder");
    musicListArrangerLabel = translate("musicListArrangerLabel");
    musicListArrangerPlaceholder = translate("musicListArrangerPlaceholder");
    musicListLyricistLabel = translate("musicListLyricistLabel");
    musicListLyricistPlaceholder = translate("musicListLyricistPlaceholder");
    musicListVocalCharacterLabel = translate("musicListVocalCharacterLabel");
    musicListTagLabel = translate("musicListVocalUnitTagLabel");
    musicListDifficultyLabel = translate("musicListDifficultyLabel");
    musicListHasAppendDifficultyLabel = translate("musicListHasAppendDifficultyLabel");
    musicListLevelLabel = translate("musicListLevelLabel");
    musicListLevelPlaceholder = translate("musicListLevelPlaceholder");
    musicListFilterReset = translate("musicListFilterReset");
    musicListFilterApply = translate("musicListFilterApply");
    musicListSortById = translate("musicListSortById");
    musicListSortByPublishedAt = translate("musicListSortByPublishedAt");
    musicListViewGrid = translate("musicListViewGrid");
    musicListViewAgenda = translate("musicListViewAgenda");
    musicListCreatorLabel = translate("musicListCreatorLabel");
    musicJacketAltSuffix = translate("musicJacketAltSuffix");
    spoilerContentLabel = translate("spoilerContent");
  };

  const refreshTranslations = async (locale: string): Promise<void> => {
    const resolvedLocale = await setI18nLocale(locale, data.commonMessages);
    applyTranslations((key) => tCommon(resolvedLocale, key));
  };

  const createSearchParams = (page: number): SvelteURLSearchParams => {
    const params = new SvelteURLSearchParams();
    params.set("page", String(page));
    params.set("sort_by", sortBy);
    params.set("sort_order", sortOrder);
    params.set("spoiler", String(spoilerFilter));
    if (nameFilter) params.set("name", nameFilter);
    categoryFilter.forEach((value) => params.append("category", value));
    if (composerFilter) params.set("composer", composerFilter);
    if (arrangerFilter) params.set("arranger", arrangerFilter);
    if (lyricistFilter) params.set("lyricist", lyricistFilter);
    vocalCharacterFilter.forEach((value) => params.append("vocal_character", value));
    tagFilter.forEach((value) => params.append("music_tag", value));
    if (hasAppendFilter) params.set("hasAppend", "true");
    if (levelFilter) params.set("playLevel", levelFilter);
    return params;
  };

  const persistFilters = (): void => {
    if (!browser) return;
    localStorage.setItem(
      getPreferenceKey(),
      JSON.stringify({
        sortBy,
        sortOrder,
        name: nameFilter,
        categories: categoryFilter,
        composer: composerFilter,
        arranger: arrangerFilter,
        lyricist: lyricistFilter,
        vocalCharacter: vocalCharacterFilter,
        tags: tagFilter,
        hasAppend: hasAppendFilter,
        level: levelFilter
      })
    );
  };

  const syncUrl = (): void => {
    if (!browser) return;
    const params = createSearchParams(1);
    params.delete("page");
    replaceState(`${resolve("/musics/[region]", { region: data.region })}?${params}`, {});
  };

  const fetchPage = async (page: number): Promise<MusicListPagePayload> => {
    const params = createSearchParams(page);
    const response = await fetch(
      `${resolve("/musics/[region]/data", { region: data.region })}?${params}`
    );
    if (!response.ok) {
      throw new Error("Failed to load music list.");
    }
    return (await response.json()) as MusicListPagePayload;
  };

  const reloadFirstPage = async (): Promise<void> => {
    if (isLoading) return;
    isLoading = true;
    isReloading = true;
    errorMessage = null;
    isLoadMoreHintVisible = false;
    try {
      const nextPage = await fetchPage(1);
      items = nextPage.items;
      currentPage = 1;
      hasNext = nextPage.pagination.hasNext;
      persistFilters();
      syncUrl();
    } catch {
      errorMessage = musicListLoadFailed;
    } finally {
      isLoading = false;
      isReloading = false;
    }
  };

  const mergeItems = (
    currentItems: MusicListItem[],
    nextItems: MusicListItem[]
  ): MusicListItem[] => {
    const existingIds = new Set(currentItems.map((item) => item.id));
    return [...currentItems, ...nextItems.filter((item) => !existingIds.has(item.id))];
  };

  const loadMore = async (): Promise<void> => {
    if (isLoading || !hasNext) return;
    isLoading = true;
    isLoadMoreHintVisible = false;
    errorMessage = null;
    try {
      const nextPage = await fetchPage(currentPage + 1);
      items = mergeItems(items, nextPage.items);
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
    } catch {
      errorMessage = musicListLoadFailed;
    } finally {
      isLoading = false;
    }
  };

  const toggleSort = (next: MusicListSortBy): void => {
    if (sortBy === next) {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
    } else {
      sortBy = next;
      sortOrder = "desc";
    }
    void reloadFirstPage();
  };

  const setViewMode = (next: MusicListViewMode): void => {
    viewMode = next;
    if (browser) localStorage.setItem(getViewKey(), next);
  };

  const openFilters = (): void => {
    syncDrafts();
    filterDialog?.showModal();
  };

  const resetDrafts = (): void => {
    nameDraft = "";
    categoryDraft = [];
    composerDraft = "";
    arrangerDraft = "";
    lyricistDraft = "";
    vocalCharacterDraft = [];
    tagDraft = [];
    hasAppendDraft = false;
    levelDraft = "";
  };

  const applyFilters = (): void => {
    nameFilter = nameDraft.trim();
    categoryFilter = [...categoryDraft];
    composerFilter = composerDraft.trim();
    arrangerFilter = arrangerDraft.trim();
    lyricistFilter = lyricistDraft.trim();
    vocalCharacterFilter = [...vocalCharacterDraft];
    tagFilter = [...tagDraft];
    hasAppendFilter = hasAppendDraft;
    levelFilter = levelDraft.trim();
    filterDialog?.close();
    void reloadFirstPage();
  };

  const getMusicListHref = (region: string): string => {
    const params = createSearchParams(1);
    params.delete("page");
    const query = params.toString();
    const pathname = resolve("/musics/[region]", { region });
    return query ? `${pathname}?${query}` : pathname;
  };

  const getRegionOptions = (): RegionBadgeOption[] =>
    supportedRegions.map((region) =>
      region === data.region
        ? {
            key: region,
            label: regionLabels[region],
            active: true
          }
        : {
            key: region,
            label: regionLabels[region],
            href: getMusicListHref(region),
            active: false
          }
    );

  const toggleCategory = (value: string, checked: boolean): void => {
    categoryDraft = checked
      ? [...categoryDraft, value]
      : categoryDraft.filter((category) => category !== value);
  };

  const toggleMusicTag = (value: string, checked: boolean): void => {
    if (value === "all") {
      if (checked) {
        tagDraft = [];
      }
      return;
    }

    tagDraft = checked
      ? [...new Set([...tagDraft, value])]
      : tagDraft.filter((entry) => entry !== value);
  };
</script>

<svelte:head>
  <title>{musicListTitle} {regionLabels[data.region]} - Sekai Viewer</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-360 flex-col gap-5 px-4">
  <PageHeader breadcrumbs={[{ label: homeLabel, href: resolve("/") }, { label: musicListTitle }]}>
    {#snippet actions()}<RegionBadgeSwitch options={getRegionOptions()} />{/snippet}
  </PageHeader>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="join">
      {#each [{ value: "publishedAt", icon: "mdi:clock-outline", label: musicListSortByPublishedAt }, { value: "id", icon: "mdi:numeric", label: musicListSortById }] as option (option.value)}
        <button
          type="button"
          class={`btn join-item btn-sm relative !h-12 !min-h-12 !w-12 overflow-visible p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${sortBy === option.value ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          title={option.label}
          aria-label={option.label}
          onclick={() => toggleSort(option.value as MusicListSortBy)}
        >
          <Icon icon={option.icon} class="h-4 w-4" />
          {#if sortBy === option.value}
            <span
              class="absolute bottom-1 right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary-content/90 text-primary sm:bottom-0.5 sm:right-0.5 sm:h-3 sm:w-3"
              aria-hidden="true"
            >
              <Icon
                icon={sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down"}
                class="h-2.5 w-2.5"
              />
            </span>
          {/if}
        </button>
      {/each}
    </div>
    <div class="flex gap-2">
      <div class="join">
        <button
          type="button"
          class={`btn join-item btn-sm !h-12 !min-h-12 !w-12 p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${viewMode === "grid" ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          title={musicListViewGrid}
          onclick={() => setViewMode("grid")}
        >
          <Icon icon="mdi:view-grid-outline" class="h-4 w-4" />
        </button>
        <button
          type="button"
          class={`btn join-item btn-sm !h-12 !min-h-12 !w-12 p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${viewMode === "agenda" ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          title={musicListViewAgenda}
          onclick={() => setViewMode("agenda")}
        >
          <Icon icon="mdi:view-agenda-outline" class="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        class={`btn btn-sm !h-12 !min-h-12 !w-12 p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${hasFilters() ? "btn-primary" : "btn-outline border-primary text-primary"}`}
        title={musicListOpenFilters}
        onclick={openFilters}
      >
        <Icon icon="mdi:funnel" class="h-4 w-4" />
      </button>
    </div>
  </div>

  {#if isReloading}
    <div class="content-card-shell flex min-h-48 items-center justify-center rounded-2xl">
      <span class="loading loading-spinner loading-md"></span>
      <span class="ml-3 text-sm opacity-70">{musicListLoading}</span>
    </div>
  {:else if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div
      class={viewMode === "agenda"
        ? "grid grid-cols-1 gap-4 lg:grid-cols-2"
        : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"}
    >
      {#each visibleItems as item (item.id)}
        <MusicListCard
          region={data.region}
          {item}
          {viewMode}
          {idLabel}
          jacketAltSuffix={musicJacketAltSuffix}
          creatorLabel={musicListCreatorLabel}
          {spoilerContentLabel}
          {getCategoryLabel}
          getTagLabel={getMusicTagLabel}
        />
      {/each}
    </div>
    {#if visibleItems.length === 0 && !errorMessage}
      <p class="py-12 text-center text-sm opacity-70">{musicListEmpty}</p>
    {/if}
    {#if errorMessage}
      <div class="alert alert-error">{errorMessage}</div>
    {/if}
    {#if hasNext}
      <div bind:this={sentinel} class="flex min-h-24 items-center justify-center py-5">
        {#if isLoading}
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-3 text-sm opacity-70">{musicListLoadingMore}</span>
        {:else}
          <span class="text-sm opacity-60">
            {isTouchPointer ? musicListLoadMoreHintMobile : musicListLoadMoreHintDesktop}
          </span>
        {/if}
      </div>
    {:else if visibleItems.length > 0}
      <p class="py-2 text-center text-sm opacity-60">{musicListEnd}</p>
    {/if}
  {/if}
</section>

<dialog bind:this={filterDialog} class="modal">
  <div class="modal-box max-w-xl">
    <h3 class="text-lg font-semibold">{musicListFiltersTitle}</h3>
    <div class="mt-4 grid gap-3">
      <label class="form-control">
        <span class="label-text mb-1 text-sm font-medium">{musicListFilterNameLabel}</span>
        <div class="relative">
          <input
            class="input input-bordered w-full pr-10"
            bind:value={nameDraft}
            placeholder={musicListFilterNamePlaceholder}
          />
          {#if nameDraft}
            <button
              type="button"
              class="btn btn-circle btn-ghost btn-xs absolute top-1/2 right-1 !h-12 !min-h-12 !w-12 -translate-y-1/2"
              title={`${clearLabel}: ${musicListFilterNameLabel}`}
              aria-label={`${clearLabel}: ${musicListFilterNameLabel}`}
              onclick={() => (nameDraft = "")}
            >
              <Icon icon="mdi:close-circle-outline" class="h-4 w-4" />
            </button>
          {/if}
        </div>
      </label>
      <fieldset class="form-control gap-2">
        <legend class="label-text text-sm font-medium">{musicListFilterCategoryLabel}</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each data.filterMeta.categories as category (category)}
            <label
              class={`btn btn-sm !min-h-12 ${categoryDraft.includes(category) ? "btn-primary" : "btn-outline border-primary text-primary"}`}
            >
              <input
                class="sr-only"
                type="checkbox"
                checked={categoryDraft.includes(category)}
                onchange={(event) => toggleCategory(category, event.currentTarget.checked)}
              />
              {getCategoryLabel(category)}
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset class="form-control gap-2">
        <legend class="label-text text-sm font-medium">{musicListTagLabel}</legend>
        <div class="join flex w-full flex-wrap">
          {#each musicTagOptions as tag (`music-tag:${tag}`)}
            {@const tagIconUrl = getMusicTagIconUrl(tag)}
            <label
              class={`btn btn-sm join-item !h-12 !min-h-12 !w-12 p-0 ${tag === "all" ? (tagDraft.length === 0 ? "btn-primary" : "btn-outline border-primary text-primary") : getFilterButtonClass(tagDraft, tag)}`}
              title={getMusicTagLabel(tag)}
            >
              <input
                class="sr-only"
                type="checkbox"
                checked={tag === "all" ? tagDraft.length === 0 : tagDraft.includes(tag)}
                onchange={(event) => toggleMusicTag(tag, event.currentTarget.checked)}
                aria-label={getMusicTagLabel(tag)}
              />
              {#if tagIconUrl}
                <img
                  src={tagIconUrl}
                  alt=""
                  aria-hidden="true"
                  class="h-7 w-7 object-contain"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <Icon
                  icon={tag === "all" ? "mdi:apps" : "mdi:dots-horizontal-circle-outline"}
                  class="h-6 w-6"
                  aria-hidden="true"
                />
              {/if}
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset class="form-control gap-2">
        <legend class="label-text text-sm font-medium">{musicListVocalCharacterLabel}</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each gameCharacterValues as character (character)}
            <label
              class={`btn btn-sm !h-12 !min-h-12 !w-12 p-0 ${getFilterButtonClass(vocalCharacterDraft, character)}`}
              title={character}
            >
              <input
                class="sr-only"
                type="checkbox"
                checked={vocalCharacterDraft.includes(character)}
                onchange={(event) => {
                  vocalCharacterDraft = toggleDraftValue(
                    vocalCharacterDraft,
                    character,
                    event.currentTarget.checked
                  );
                }}
                aria-label={character}
              />
              <img
                src={getCharacterThumbnailUrl(character) ?? ""}
                alt=""
                aria-hidden="true"
                class="h-7 w-7 rounded-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset class="form-control gap-2">
        <legend class="label-text text-sm font-medium">{musicListDifficultyLabel}</legend>
        <label
          class="flex min-h-10 items-center justify-between gap-3 rounded-box border border-base-content/20 px-3 py-2"
        >
          <span class="text-sm">{musicListHasAppendDifficultyLabel}</span>
          <input
            type="checkbox"
            class="toggle toggle-primary"
            checked={hasAppendDraft}
            onchange={(event) => (hasAppendDraft = event.currentTarget.checked)}
          />
        </label>
      </fieldset>
      {#each textFilters as filter (filter.label)}
        <label class="form-control">
          <span class="label-text mb-1 text-sm font-medium">{filter.label}</span>
          <div class="relative">
            <input
              type="text"
              class="input input-bordered w-full pr-10"
              list={filter.listId}
              autocomplete="off"
              value={filter.value}
              placeholder={filter.placeholder}
              oninput={(event) => filter.set(event.currentTarget.value)}
            />
            <datalist id={filter.listId}>
              {#each filter.options as option (option)}
                <option value={option}>{option}</option>
              {/each}
            </datalist>
            {#if filter.value}
              <button
                type="button"
                class="btn btn-circle btn-ghost btn-xs absolute top-1/2 right-1 !h-12 !min-h-12 !w-12 -translate-y-1/2"
                title={`${clearLabel}: ${filter.label}`}
                aria-label={`${clearLabel}: ${filter.label}`}
                onclick={() => filter.set("")}
              >
                <Icon icon="mdi:close-circle-outline" class="h-4 w-4" />
              </button>
            {/if}
          </div>
        </label>
      {/each}
    </div>
    <div class="modal-action">
      <button type="button" class="btn btn-outline !min-h-12" onclick={resetDrafts}
        >{musicListFilterReset}</button
      >
      <button type="button" class="btn btn-primary !min-h-12" onclick={applyFilters}
        >{musicListFilterApply}</button
      >
      <form method="dialog"><button type="submit" class="btn !min-h-12">{closeLabel}</button></form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="submit">{closeLabel}</button></form>
</dialog>
