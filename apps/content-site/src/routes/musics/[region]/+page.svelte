<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import { toTimestampMs } from "$lib/time/date-time";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import ListToolbarButton from "$lib/components/shared/ListToolbarButton.svelte";
  import MusicListCard from "$lib/components/music/MusicListCard.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import {
    createI18nTranslator,
    getLocalI18nMessages,
  } from "$lib/i18n/runtime";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import {
    formatUnitFallbackLabel,
    musicTagByUnitCode,
    unitCodeByMusicTag
  } from "$lib/domain/unit-profile";
  import type { MusicListPage, MusicListItem as MusicListItemType } from "$lib/server/music-list";
  import Icon from "@iconify/svelte";
  import type { PageData } from "./$types";


  type MusicListPagePayload = MusicListPage;
  type MusicListItem = MusicListItemType;
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
  const fallbackMessages = getLocalI18nMessages(["common", "music", "error"]);
  let currentMessages = $state<Record<string, string>>(fallbackMessages);
  let translationRequestId = 0;
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, fallbackMessages)(key);

  let items = $state<MusicListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isLoading = $state(false);
  let isInitialLoading = $state(true);
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
  let hasTriedRestoreViewMode = $state(false);
  let spoilerContentAppliedState = $state<boolean | null>(null);
  const contentDisplaySettings = getContentDisplaySettings();

  let homeLabel = $state(getInitialI18nText("home"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let clearLabel = $state(getInitialI18nText("clearLabel"));
  let musicListTitle = $state(getInitialI18nText("musicListTitle"));
  let musicListEmpty = $state(getInitialI18nText("musicListEmpty"));
  let musicListEnd = $state(getInitialI18nText("musicListEnd"));
  let musicListLoading = $state(getInitialI18nText("musicListListLoading"));
  let musicListLoadingMore = $state(getInitialI18nText("musicListLoadingMore"));
  let listLoadMoreHintDesktop = $state(getInitialI18nText("listLoadMoreHintDesktop"));
  let listLoadMoreHintMobile = $state(getInitialI18nText("listLoadMoreHintMobile"));
  let musicListLoadFailed = $state(getInitialI18nText("musicListLoadFailed"));
  let listOpenFilters = $state(getInitialI18nText("listOpenFilters"));
  let listFiltersTitle = $state(getInitialI18nText("listFiltersTitle"));
  let musicListFilterNameLabel = $state(getInitialI18nText("musicListFilterNameLabel"));
  let musicListFilterNamePlaceholder = $state(getInitialI18nText("musicListFilterNamePlaceholder"));
  let musicListFilterCategoryLabel = $state(getInitialI18nText("musicListFilterCategoryLabel"));
  let musicListComposerLabel = $state(getInitialI18nText("musicListComposerLabel"));
  let musicListComposerPlaceholder = $state(getInitialI18nText("musicListComposerPlaceholder"));
  let musicListArrangerLabel = $state(getInitialI18nText("musicListArrangerLabel"));
  let musicListArrangerPlaceholder = $state(getInitialI18nText("musicListArrangerPlaceholder"));
  let musicListLyricistLabel = $state(getInitialI18nText("musicListLyricistLabel"));
  let musicListLyricistPlaceholder = $state(getInitialI18nText("musicListLyricistPlaceholder"));
  let musicListVocalCharacterLabel = $state(getInitialI18nText("musicListVocalCharacterLabel"));
  let musicListTagLabel = $state(getInitialI18nText("musicListVocalUnitTagLabel"));
  let musicListDifficultyLabel = $state(getInitialI18nText("musicListDifficultyLabel"));
  let musicListHasAppendDifficultyLabel = $state(
    getInitialI18nText("musicListHasAppendDifficultyLabel")
  );
  let musicListLevelLabel = $state(getInitialI18nText("musicListLevelLabel"));
  let musicListLevelPlaceholder = $state(getInitialI18nText("musicListLevelPlaceholder"));
  let listFilterReset = $state(getInitialI18nText("listFilterReset"));
  let listFilterApply = $state(getInitialI18nText("listFilterApply"));
  let listSortById = $state(getInitialI18nText("listSortById"));
  let listSortByReleaseAt = $state(getInitialI18nText("listSortByReleaseAt"));
  let listViewGrid = $state(getInitialI18nText("listViewGrid"));
  let listViewAgenda = $state(getInitialI18nText("listViewAgenda"));
  let musicListCreatorLabel = $state(getInitialI18nText("musicListCreatorLabel"));
  let musicJacketAltSuffix = $state(getInitialI18nText("musicJacketAltSuffix"));
  let spoilerContentLabel = $state(getInitialI18nText("spoilerContent"));
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
    createI18nTranslator(data.uiLocale, currentMessages)(`musicListCategory.${category}`, category);

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
      : createI18nTranslator(data.uiLocale, currentMessages)(`musicListTag.${value}`, formatOptionLabel(value));

  const getFilterButtonClass = (values: string[], value: string): string =>
    values.includes(value) ? "btn-primary" : "btn-outline border-primary text-primary";

  const toggleDraftValue = (values: string[], value: string, checked: boolean): string[] =>
    checked ? [...new Set([...values, value])] : values.filter((entry) => entry !== value);

  const mapLegacyVocalUnitToTag = (value: string): string => musicTagByUnitCode[value] ?? value;

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

  const hasExplicitQueryStateInUrl = (): boolean => {
    if (!browser) {
      return false;
    }

    const searchParams = new URLSearchParams(window.location.search);
    return [
      "sort_by",
      "sort_order",
      "name",
      "category",
      "composer",
      "arranger",
      "lyricist",
      "vocal_character",
      "music_tag",
      "vocal_unit",
      "hasAppend",
      "has_append",
      "difficulty",
      "playLevel",
      "level",
      "spoiler"
    ].some((key) => searchParams.has(key));
  };

  const restorePersistedFilters = (): boolean => {
    if (!browser) {
      return false;
    }

    const raw = localStorage.getItem(getPreferenceKey());
    if (!raw) {
      return false;
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
      return true;
    } catch {
      localStorage.removeItem(getPreferenceKey());
      return false;
    }
  };

  type InitialPageResult = {
    page: MusicListPagePayload;
    loadFailed: boolean;
  };

  const applyInitialPage = (result: InitialPageResult): void => {
    items = result.page.items;
    currentPage = result.page.pagination.page;
    hasNext = result.page.pagination.hasNext;
    errorMessage = result.loadFailed ? musicListLoadFailed : null;

    // Initialize filter/sort state from server query params once per navigation.
    // Must be here (not in a $effect) to avoid effect_update_depth_exceeded:
    // writing reactive state inside $effect triggers re-run → infinite loop.
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

    isInitialLoading = false;

    let needsReload = false;

    if (browser && !hasExplicitQueryStateInUrl() && restorePersistedFilters()) {
      needsReload = true;
    }

    if (browser) {
      const userWantsSpoilers = contentDisplaySettings.showSpoilerContent;
      if (userWantsSpoilers !== spoilerFilter) {
        spoilerFilter = userWantsSpoilers;
        needsReload = true;
      }
      spoilerContentAppliedState = userWantsSpoilers;
    }

    if (needsReload) {
      void reloadFirstPage();
    }
  };

  $effect(() => {
    const initialPagePromise = data.initialPage as unknown as Promise<InitialPageResult>;
    initialPagePromise.then(applyInitialPage);
  });

  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    currentMessages = fallbackMessages;
    const translate = createI18nTranslator(data.uiLocale, fallbackMessages);
    applyTranslations(translate);
    void refreshTranslations(data.uiLocale, messagesOrPromise, requestId);
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
    if (!browser || hasTriedRestoreViewMode) {
      return;
    }

    hasTriedRestoreViewMode = true;
    const storedView = localStorage.getItem(getViewKey());
    if (storedView === "grid" || storedView === "agenda") {
      viewMode = storedView;
    }
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    const showSpoilerContent = contentDisplaySettings.showSpoilerContent;
    const isInitialSpoilerState = spoilerContentAppliedState === null;
    if (isInitialSpoilerState) {
      return;
    }

    if (spoilerContentAppliedState === showSpoilerContent) {
      return;
    }

    spoilerContentAppliedState = showSpoilerContent;
    spoilerFilter = showSpoilerContent;
    void reloadFirstPage();
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
    listLoadMoreHintDesktop = translate("listLoadMoreHintDesktop");
    listLoadMoreHintMobile = translate("listLoadMoreHintMobile");
    musicListLoadFailed = translate("musicListLoadFailed");
    listOpenFilters = translate("listOpenFilters");
    listFiltersTitle = translate("listFiltersTitle");
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
    listFilterReset = translate("listFilterReset");
    listFilterApply = translate("listFilterApply");
    listSortById = translate("listSortById");
    listSortByReleaseAt = translate("listSortByReleaseAt");
    listViewGrid = translate("listViewGrid");
    listViewAgenda = translate("listViewAgenda");
    musicListCreatorLabel = translate("musicListCreatorLabel");
    musicJacketAltSuffix = translate("musicJacketAltSuffix");
    spoilerContentLabel = translate("spoilerContent");
  };

  const refreshTranslations = async (locale: string, messagesOrPromise: typeof data.i18nMessages, requestId: number): Promise<void> => {
    let messages: Record<string, string>;
    try {
      messages = await messagesOrPromise;
    } catch {
      return;
    }
    if (requestId !== translationRequestId) return;
    const resolvedLocale = locale;
    currentMessages = messages;
    applyTranslations(createI18nTranslator(resolvedLocale, messages));
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

<section class="mx-auto flex w-full max-w-360 flex-col gap-5 px-2">
  <PageHeader breadcrumbs={[{ label: homeLabel, href: resolve("/") }, { label: musicListTitle }]}>
    {#snippet actions()}<RegionBadgeSwitch options={getRegionOptions()} />{/snippet}
  </PageHeader>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="join">
      {#each [{ value: "publishedAt", icon: "mdi:clock-outline", label: listSortByReleaseAt }, { value: "id", icon: "mdi:numeric", label: listSortById }] as option (option.value)}
        <ListToolbarButton
          icon={option.icon}
          label={option.label}
          ariaLabel={`${option.label} (${sortBy === option.value ? sortOrder : "desc"})`}
          sortIndicatorIcon={sortBy === option.value
            ? sortOrder === "asc"
              ? "mdi:arrow-up"
              : "mdi:arrow-down"
            : undefined}
          class={`join-item ${sortBy === option.value ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          onclick={() => toggleSort(option.value as MusicListSortBy)}
        />
      {/each}
    </div>
    <div class="flex gap-2">
      <div class="join">
        <ListToolbarButton
          icon="mdi:view-grid-outline"
          label={listViewGrid}
          class={`join-item ${viewMode === "grid" ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          onclick={() => setViewMode("grid")}
        />
        <ListToolbarButton
          icon="mdi:view-agenda-outline"
          label={listViewAgenda}
          class={`join-item ${viewMode === "agenda" ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          onclick={() => setViewMode("agenda")}
        />
      </div>
      <ListToolbarButton
        icon="mdi:funnel"
        label={listOpenFilters}
        class={hasFilters() ? "btn-primary" : "btn-outline border-primary text-primary"}
        onclick={openFilters}
      />
    </div>
  </div>

  {#if isReloading}
    <div class="content-card-shell flex min-h-48 items-center justify-center rounded-2xl">
      <span class="loading loading-spinner loading-md"></span>
      <span class="ml-3 text-sm opacity-70">{musicListLoading}</span>
    </div>
  {:else if isInitialLoading}
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
        <div class="content-card-shell rounded-2xl p-4 shadow-sm">
          <div class="skeleton aspect-square w-full rounded-xl"></div>
          <div class="mt-3 skeleton h-4 w-3/4 rounded"></div>
          <div class="mt-2 skeleton h-3 w-1/2 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div
      class={viewMode === "agenda"
        ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"}
    >
      {#each visibleItems as item (item.id)}
        <MusicListCard
          href={resolve("/music/[region]/[id]", { region: data.region, id: item.id })}
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
            {isTouchPointer ? listLoadMoreHintMobile : listLoadMoreHintDesktop}
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
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-lg font-semibold">{listFiltersTitle}</h3>
      <form method="dialog">
        <button
          type="submit"
          class="btn btn-circle btn-ghost btn-sm min-h-12! w-12!"
          aria-label={closeLabel}
          title={closeLabel}
        >
          <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
        </button>
      </form>
    </div>
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
              class="btn btn-circle btn-ghost btn-xs absolute top-1/2 right-1 size-12! min-h-12! -translate-y-1/2"
              title={`${clearLabel}: ${musicListFilterNameLabel}`}
              aria-label={`${clearLabel}: ${musicListFilterNameLabel}`}
              onclick={() => (nameDraft = "")}
            >
              <Icon icon="mdi:close-circle-outline" class="size-5" />
            </button>
          {/if}
        </div>
      </label>
      <fieldset class="form-control gap-2">
        <legend class="label-text text-sm font-medium">{musicListFilterCategoryLabel}</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each data.filterMeta.categories as category (category)}
            <label
              class={`btn btn-sm min-h-12! ${categoryDraft.includes(category) ? "btn-primary" : "btn-outline border-primary text-primary"}`}
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
            {@const unitCode = unitCodeByMusicTag[tag]}
            <label
              class={`btn btn-sm join-item size-12! min-h-12! p-0 ${tag === "all" ? (tagDraft.length === 0 ? "btn-primary" : "btn-outline border-primary text-primary") : getFilterButtonClass(tagDraft, tag)}`}
              title={getMusicTagLabel(tag)}
            >
              <input
                class="sr-only"
                type="checkbox"
                checked={tag === "all" ? tagDraft.length === 0 : tagDraft.includes(tag)}
                onchange={(event) => toggleMusicTag(tag, event.currentTarget.checked)}
                aria-label={getMusicTagLabel(tag)}
              />
              {#if tag === "all"}
                <Icon icon="mdi:apps" class="size-6" aria-hidden="true" />
              {:else if unitCode}
                <UnitIconBadge unit={unitCode} variant="sm" fallbackLabel={getMusicTagLabel(tag)} />
              {:else}
                <Icon icon="mdi:dots-horizontal-circle-outline" class="size-6" aria-hidden="true" />
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
              class={`btn btn-sm size-12! min-h-12! p-0 ${getFilterButtonClass(vocalCharacterDraft, character)}`}
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
              <CharacterAvatar
                src={getLocalCharacterThumbnailAssetURL(character)}
                label={character}
                characterId={character}
                variant="xs"
                decorative
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
                class="btn btn-circle btn-ghost btn-xs absolute top-1/2 right-1 size-12! min-h-12! -translate-y-1/2"
                title={`${clearLabel}: ${filter.label}`}
                aria-label={`${clearLabel}: ${filter.label}`}
                onclick={() => filter.set("")}
              >
                <Icon icon="mdi:close-circle-outline" class="size-5" />
              </button>
            {/if}
          </div>
        </label>
      {/each}
    </div>
    <div class="modal-action">
      <button type="button" class="btn btn-outline min-h-12!" onclick={resetDrafts}
        >{listFilterReset}</button
      >
      <button type="button" class="btn btn-primary min-h-12!" onclick={applyFilters}
        >{listFilterApply}</button
      >
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="submit" aria-label={closeLabel}></button></form>
</dialog>
