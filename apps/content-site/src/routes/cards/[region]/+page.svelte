<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { asset, resolve } from "$app/paths";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { toTimestampMs } from "$lib/date-time";
  import { getContentDisplaySettings } from "$lib/content-display-settings";
  import { createCommonTranslator, setI18nLocale, tCommon } from "$lib/i18n";
  import { regionLabels, supportedRegions } from "$lib/regions";
  import { UNIT_CODE_ORDER } from "$lib/unit-profile";
  import Icon from "@iconify/svelte";
  import CardListCard from "$lib/components/CardListCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/RegionBadgeSwitch.svelte";
  import type { PageData } from "./$types";

  type CardListPagePayload = PageData["initialPage"];
  type CardListItem = CardListPagePayload["items"][number];
  type CardListFilterOption = { value: string; label: string };
  type CardListQueryState = {
    sortBy: CardListSortBy;
    sortOrder: CardListSortOrder;
    name: string;
    unit: string[];
    character: string[];
    skill: string[];
    type: string[];
    attr: string[];
    rarity: string[];
    supportUnit: string[];
    has3dmvCutIn: boolean;
    spoiler: boolean;
  };
  type CardListFilterMeta = {
    unit: CardListFilterOption[];
    character: CardListFilterOption[];
    skill: CardListFilterOption[];
    type: CardListFilterOption[];
  };
  type CardListSortBy = "releaseAt" | "id";
  type CardListSortOrder = "asc" | "desc";
  type CardListViewMode = "grid" | "agenda" | "comfy";

  type CardListPageData = Omit<PageData, "initialQuery" | "filterMeta"> & {
    initialQuery: CardListQueryState;
    filterMeta?: CardListFilterMeta;
  };

  let { data }: { data: CardListPageData } = $props();
  const getInitialCommonText = (key: string): string =>
    createCommonTranslator(data.uiLocale, data.commonMessages)(key);
  let items = $state<CardListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isLoading = $state(false);
  let isReloadingFirstPage = $state(false);
  let errorMessage = $state<string | null>(null);
  let sentinel: HTMLDivElement | null = $state(null);
  let isLoadMoreHintVisible = $state(false);
  let isTouchPointer = $state(false);
  let lastTouchY = $state<number | null>(null);
  let sortBy = $state<CardListSortBy>("releaseAt");
  let sortOrder = $state<CardListSortOrder>("desc");
  let nameFilter = $state("");
  let unitFilter = $state<string[]>([]);
  let characterFilter = $state<string[]>([]);
  let skillFilter = $state<string[]>([]);
  let typeFilter = $state<string[]>([]);
  let attrFilter = $state<string[]>([]);
  let rarityFilter = $state<string[]>([]);
  let supportUnitFilter = $state<string[]>([]);
  let has3dmvCutInFilter = $state(false);
  let spoilerFilter = $state(false);
  let filterNameDraft = $state("");
  let filterUnitDraft = $state<string[]>([]);
  let filterCharacterDraft = $state<string[]>([]);
  let filterSkillDraft = $state<string[]>([]);
  let filterTypeDraft = $state<string[]>([]);
  let filterAttrDraft = $state<string[]>([]);
  let filterRarityDraft = $state<string[]>([]);
  let filterSupportUnitDraft = $state<string[]>([]);
  let has3dmvCutInDraft = $state(false);
  let filterDialog: HTMLDialogElement | null = $state(null);
  let viewMode = $state<CardListViewMode>("grid");
  let hasTriedRestorePersistedFilters = $state(false);
  let hasTriedRestoreViewMode = $state(false);
  let initialStateAppliedKey = $state("");
  let spoilerContentAppliedState = $state<boolean | null>(null);
  let homeLabel = $state(getInitialCommonText("home"));
  let idLabel = $state(getInitialCommonText("idLabel"));
  let closeLabel = $state(getInitialCommonText("closeLabel"));
  let cardListTitle = $state(getInitialCommonText("cardListTitle"));
  let cardListEmpty = $state(getInitialCommonText("cardListEmpty"));
  let cardListLoadingMore = $state(getInitialCommonText("cardListLoadingMore"));
  let cardListLoadMoreHintDesktop = $state(getInitialCommonText("cardListLoadMoreHintDesktop"));
  let cardListLoadMoreHintMobile = $state(getInitialCommonText("cardListLoadMoreHintMobile"));
  let cardListLoadFailed = $state(getInitialCommonText("cardListLoadFailed"));
  let cardListRetry = $state(getInitialCommonText("cardListRetry"));
  let cardListEnd = $state(getInitialCommonText("cardListEnd"));
  let cardListSortById = $state(getInitialCommonText("cardListSortById"));
  let cardListSortByReleaseAt = $state(getInitialCommonText("cardListSortByReleaseAt"));
  let cardListOpenFilters = $state(getInitialCommonText("cardListOpenFilters"));
  let cardListFiltersTitle = $state(getInitialCommonText("cardListFiltersTitle"));
  let cardListFilterNameLabel = $state(getInitialCommonText("cardListFilterNameLabel"));
  let cardListFilterNamePlaceholder = $state(getInitialCommonText("cardListFilterNamePlaceholder"));
  let cardListFilterAttrLabel = $state(getInitialCommonText("cardListFilterAttrLabel"));
  let cardListFilterCharacterLabel = $state(getInitialCommonText("cardListFilterCharacterLabel"));
  let cardListFilter3dmvCutInLabel = $state(getInitialCommonText("cardListFilter3dmvCutInLabel"));
  let cardListFilterRarityLabel = $state(getInitialCommonText("cardListFilterRarityLabel"));
  let cardListFilterSkillLabel = $state(getInitialCommonText("cardListFilterSkillLabel"));
  let cardListFilterSupportUnitLabel = $state(
    getInitialCommonText("cardListFilterSupportUnitLabel")
  );
  let cardListFilterTypeLabel = $state(getInitialCommonText("cardListFilterTypeLabel"));
  let cardListFilterUnitLabel = $state(getInitialCommonText("cardListFilterUnitLabel"));
  let cardListFilterReset = $state(getInitialCommonText("cardListFilterReset"));
  let cardListFilterApply = $state(getInitialCommonText("cardListFilterApply"));
  let cardListLoading = $state(getInitialCommonText("cardListLoading"));
  let cardListViewGrid = $state(getInitialCommonText("cardListViewGrid"));
  let cardListViewAgenda = $state(getInitialCommonText("cardListViewAgenda"));
  let cardListViewComfy = $state(getInitialCommonText("cardListViewComfy"));
  let cardListCharacterFallback = $state(getInitialCommonText("cardListCharacterFallback"));
  let cardListReleaseLabel = $state(getInitialCommonText("cardListReleaseLabel"));
  let cardImageAltSuffix = $state(getInitialCommonText("cardImageAltSuffix"));
  let spoilerContentLabel = $state(getInitialCommonText("spoilerContent"));
  const contentDisplaySettings = getContentDisplaySettings();
  const emptyFilterMeta: CardListFilterMeta = {
    unit: [],
    character: [],
    skill: [],
    type: []
  };

  const attrOptions = ["cute", "mysterious", "cool", "happy", "pure"] as const;
  const rarityOptions = [
    "rarity_1",
    "rarity_2",
    "rarity_3",
    "rarity_4",
    "rarity_birthday"
  ] as const;
  const supportUnitOptions = ["none", ...UNIT_CODE_ORDER.filter((unit) => unit !== "piapro")];
  const filterMeta = $derived.by(() => data.filterMeta ?? emptyFilterMeta);

  const formatOptionLabel = (value: string): string =>
    value
      .replaceAll("_", " ")
      .split(" ")
      .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
      .join(" ");

  const getRarityLabel = (value: string): string => {
    if (value === "rarity_birthday") {
      return "BD";
    }

    return `${value.replace("rarity_", "")}*`;
  };

  const getUnitIconUrl = (value: string): string | null => {
    if (value === "none") {
      return asset("/icons/icon_piapro.png");
    }

    return asset(`/icons/icon_${value}.png`);
  };

  const getUnitOptionLabel = (value: string): string =>
    filterMeta.unit.find((option) => option.value === value)?.label ?? formatOptionLabel(value);

  const getSupportUnitOptionLabel = (value: string): string =>
    value === "none" ? getUnitOptionLabel("piapro") : getUnitOptionLabel(value);

  const isPiaproUnitSelected = (values: string[]): boolean => values.includes("piapro");

  const getVisibleSupportUnitFilter = (units: string[], supportUnits: string[]): string[] =>
    isPiaproUnitSelected(units) ? supportUnits : [];

  const getAttrIconUrl = (value: string): string => asset(`/card_attr/icon_attribute_${value}.png`);

  const getCharacterThumbnailUrl = (value: string): string | null => {
    const id = Number.parseInt(value, 10);
    if (!Number.isFinite(id)) {
      return null;
    }

    return asset(`/chr_ts/chr_ts_${id}_g1.png`);
  };

  const isSpoilerCard = (item: CardListItem): boolean => {
    const releaseAtMs = toTimestampMs(item.releaseAt ?? item.archivePublishedAt);
    return releaseAtMs !== null && releaseAtMs > Date.now();
  };

  const visibleItems = $derived.by(() => {
    if (spoilerFilter) {
      return items;
    }

    return items.filter((item) => !isSpoilerCard(item));
  });

  const syncDraftFiltersFromCurrent = (): void => {
    filterNameDraft = nameFilter;
    filterUnitDraft = [...unitFilter];
    filterCharacterDraft = [...characterFilter];
    filterSkillDraft = [...skillFilter];
    filterTypeDraft = [...typeFilter];
    filterAttrDraft = [...attrFilter];
    filterRarityDraft = [...rarityFilter];
    filterSupportUnitDraft = [...supportUnitFilter];
    has3dmvCutInDraft = has3dmvCutInFilter;
  };

  const hasAnyAppliedFilters = (): boolean =>
    nameFilter.length > 0 ||
    unitFilter.length > 0 ||
    characterFilter.length > 0 ||
    skillFilter.length > 0 ||
    typeFilter.length > 0 ||
    attrFilter.length > 0 ||
    rarityFilter.length > 0 ||
    supportUnitFilter.length > 0 ||
    has3dmvCutInFilter;

  const hasNonDefaultSort = (): boolean => sortBy !== "releaseAt" || sortOrder !== "desc";

  const hasExplicitQueryStateInUrl = (): boolean => {
    if (!browser) {
      return false;
    }

    const searchParams = new URLSearchParams(window.location.search);
    return [
      "sort_by",
      "sort_order",
      "name",
      "unit",
      "character",
      "skill",
      "type",
      "attr",
      "rarity",
      "support_unit",
      "has_3dmv_cut_in",
      "spoiler"
    ].some((key) => searchParams.has(key));
  };

  const getFilterStorageKey = (): string => `content-site:card-list-filters:${data.region}`;
  const getViewModeStorageKey = (): string => "content-site:card-list-view-mode";

  const getInitialStateKey = (): string =>
    [
      data.region,
      data.initialQuery.sortBy,
      data.initialQuery.sortOrder,
      data.initialQuery.name,
      data.initialQuery.unit,
      data.initialQuery.character,
      data.initialQuery.skill,
      data.initialQuery.type,
      data.initialQuery.attr,
      data.initialQuery.rarity,
      data.initialQuery.supportUnit,
      data.initialQuery.has3dmvCutIn ? "1" : "0",
      data.initialQuery.spoiler ? "1" : "0",
      data.initialPage.pagination.page,
      data.initialPage.items.length
    ].join("|");

  const persistAppliedFilters = (): void => {
    if (!browser) {
      return;
    }

    const payload = {
      sortBy,
      sortOrder,
      name: nameFilter,
      unit: unitFilter,
      character: characterFilter,
      skill: skillFilter,
      type: typeFilter,
      attr: attrFilter,
      rarity: rarityFilter,
      supportUnit: supportUnitFilter,
      has3dmvCutIn: has3dmvCutInFilter
    };

    window.localStorage.setItem(getFilterStorageKey(), JSON.stringify(payload));
  };

  const persistViewMode = (): void => {
    if (!browser) {
      return;
    }

    window.localStorage.setItem(getViewModeStorageKey(), viewMode);
  };

  const restorePersistedFilters = (): boolean => {
    if (!browser) {
      return false;
    }

    const raw = window.localStorage.getItem(getFilterStorageKey());
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as {
        sortBy?: unknown;
        sortOrder?: unknown;
        name?: unknown;
        unit?: unknown;
        character?: unknown;
        skill?: unknown;
        type?: unknown;
        attr?: unknown;
        rarity?: unknown;
        supportUnit?: unknown;
        has3dmvCutIn?: unknown;
      };

      const nextSortBy = parsed.sortBy === "id" ? "id" : "releaseAt";
      const nextSortOrder = parsed.sortOrder === "asc" ? "asc" : "desc";
      const nextName = typeof parsed.name === "string" ? parsed.name.trim() : "";
      const nextUnit = Array.isArray(parsed.unit)
        ? parsed.unit
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];
      const nextCharacter = Array.isArray(parsed.character)
        ? parsed.character
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];
      const nextSkill = Array.isArray(parsed.skill)
        ? parsed.skill
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];
      const nextType = Array.isArray(parsed.type)
        ? parsed.type
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];
      const nextAttr = Array.isArray(parsed.attr)
        ? parsed.attr
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];
      const nextRarity = Array.isArray(parsed.rarity)
        ? parsed.rarity
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];
      const nextSupportUnit = Array.isArray(parsed.supportUnit)
        ? parsed.supportUnit
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];
      const nextHas3dmvCutIn = parsed.has3dmvCutIn === true;

      if (
        nextSortBy === sortBy &&
        nextSortOrder === sortOrder &&
        nextName.length === 0 &&
        nextUnit.length === 0 &&
        nextCharacter.length === 0 &&
        nextSkill.length === 0 &&
        nextType.length === 0 &&
        nextAttr.length === 0 &&
        nextRarity.length === 0 &&
        nextSupportUnit.length === 0 &&
        !nextHas3dmvCutIn
      ) {
        return false;
      }

      sortBy = nextSortBy;
      sortOrder = nextSortOrder;
      nameFilter = nextName;
      unitFilter = nextUnit;
      characterFilter = nextCharacter;
      skillFilter = nextSkill;
      typeFilter = nextType;
      attrFilter = nextAttr;
      rarityFilter = nextRarity;
      supportUnitFilter = getVisibleSupportUnitFilter(nextUnit, nextSupportUnit);
      has3dmvCutInFilter = nextHas3dmvCutIn;
      syncDraftFiltersFromCurrent();
      return true;
    } catch {
      return false;
    }
  };

  const restorePersistedViewMode = (): void => {
    if (!browser) {
      return;
    }

    const stored = window.localStorage.getItem(getViewModeStorageKey());
    if (stored === "grid" || stored === "agenda" || stored === "comfy") {
      viewMode = stored;
    }
  };

  $effect(() => {
    const nextInitialStateKey = getInitialStateKey();
    if (nextInitialStateKey === initialStateAppliedKey) {
      return;
    }

    initialStateAppliedKey = nextInitialStateKey;
    items = data.initialPage.items;
    currentPage = data.initialPage.pagination.page;
    hasNext = data.initialPage.pagination.hasNext;
    sortBy = data.initialQuery.sortBy;
    sortOrder = data.initialQuery.sortOrder;
    nameFilter = data.initialQuery.name;
    unitFilter = [...data.initialQuery.unit];
    characterFilter = [...data.initialQuery.character];
    skillFilter = [...data.initialQuery.skill];
    typeFilter = [...data.initialQuery.type];
    attrFilter = [...data.initialQuery.attr];
    rarityFilter = [...data.initialQuery.rarity];
    supportUnitFilter = [...data.initialQuery.supportUnit];
    has3dmvCutInFilter = data.initialQuery.has3dmvCutIn;
    spoilerFilter = data.initialQuery.spoiler;
    syncDraftFiltersFromCurrent();
    errorMessage = data.initialLoadFailed ? getInitialCommonText("cardListLoadFailed") : null;

    if (browser && hasExplicitQueryStateInUrl()) {
      persistAppliedFilters();
    }
  });

  $effect(() => {
    if (!browser || hasTriedRestorePersistedFilters) {
      return;
    }

    hasTriedRestorePersistedFilters = true;

    if (hasAnyAppliedFilters() || hasNonDefaultSort()) {
      return;
    }

    if (restorePersistedFilters()) {
      persistAppliedFilters();
      void reloadFirstPage();
    }
  });

  $effect(() => {
    if (!browser || hasTriedRestoreViewMode) {
      return;
    }

    hasTriedRestoreViewMode = true;
    restorePersistedViewMode();
  });

  $effect(() => {
    const translate = createCommonTranslator(data.uiLocale, data.commonMessages);
    applyTranslations(translate);
    void refreshPageTranslations(data.uiLocale);
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

      void loadNextPage();
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
    if (!browser) {
      return;
    }

    const nextShowSpoilerContent = contentDisplaySettings.showSpoilerContent;
    const isInitialSpoilerState = spoilerContentAppliedState === null;
    if (spoilerContentAppliedState === nextShowSpoilerContent) {
      return;
    }

    spoilerContentAppliedState = nextShowSpoilerContent;

    const searchParams = new URL(window.location.href).searchParams;
    const hasSpoilerQueryParam = searchParams.has("spoiler");
    const requestIncludesSpoilers = searchParams.get("spoiler") === "true";
    if (isInitialSpoilerState && hasSpoilerQueryParam) {
      return;
    }

    if (requestIncludesSpoilers !== nextShowSpoilerContent) {
      spoilerFilter = nextShowSpoilerContent;
      void reloadFirstPage();
    }
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    idLabel = translate("idLabel");
    closeLabel = translate("closeLabel");
    cardListTitle = translate("cardListTitle");
    cardListEmpty = translate("cardListEmpty");
    cardListLoadingMore = translate("cardListLoadingMore");
    cardListLoadMoreHintDesktop = translate("cardListLoadMoreHintDesktop");
    cardListLoadMoreHintMobile = translate("cardListLoadMoreHintMobile");
    cardListLoadFailed = translate("cardListLoadFailed");
    cardListRetry = translate("cardListRetry");
    cardListEnd = translate("cardListEnd");
    cardListSortById = translate("cardListSortById");
    cardListSortByReleaseAt = translate("cardListSortByReleaseAt");
    cardListOpenFilters = translate("cardListOpenFilters");
    cardListFiltersTitle = translate("cardListFiltersTitle");
    cardListFilterNameLabel = translate("cardListFilterNameLabel");
    cardListFilterNamePlaceholder = translate("cardListFilterNamePlaceholder");
    cardListFilterAttrLabel = translate("cardListFilterAttrLabel");
    cardListFilterCharacterLabel = translate("cardListFilterCharacterLabel");
    cardListFilter3dmvCutInLabel = translate("cardListFilter3dmvCutInLabel");
    cardListFilterRarityLabel = translate("cardListFilterRarityLabel");
    cardListFilterSkillLabel = translate("cardListFilterSkillLabel");
    cardListFilterSupportUnitLabel = translate("cardListFilterSupportUnitLabel");
    cardListFilterTypeLabel = translate("cardListFilterTypeLabel");
    cardListFilterUnitLabel = translate("cardListFilterUnitLabel");
    cardListFilterReset = translate("cardListFilterReset");
    cardListFilterApply = translate("cardListFilterApply");
    cardListLoading = translate("cardListLoading");
    cardListViewGrid = translate("cardListViewGrid");
    cardListViewAgenda = translate("cardListViewAgenda");
    cardListViewComfy = translate("cardListViewComfy");
    cardListCharacterFallback = translate("cardListCharacterFallback");
    cardListReleaseLabel = translate("cardListReleaseLabel");
    cardImageAltSuffix = translate("cardImageAltSuffix");
    spoilerContentLabel = translate("spoilerContent");
  };

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, data.commonMessages);
    applyTranslations((key: string) => tCommon(locale, key));
  };

  const createListSearchParams = (page: number): SvelteURLSearchParams => {
    const searchParams = new SvelteURLSearchParams();
    searchParams.set("page", String(page));
    searchParams.set("sort_by", sortBy);
    searchParams.set("sort_order", sortOrder);
    searchParams.set("spoiler", String(spoilerFilter));

    if (nameFilter) {
      searchParams.set("name", nameFilter);
    }

    unitFilter.forEach((value) => {
      searchParams.append("unit", value);
    });

    characterFilter.forEach((value) => {
      searchParams.append("character", value);
    });

    skillFilter.forEach((value) => {
      searchParams.append("skill", value);
    });

    typeFilter.forEach((value) => {
      searchParams.append("type", value);
    });

    attrFilter.forEach((value) => {
      searchParams.append("attr", value);
    });

    rarityFilter.forEach((value) => {
      searchParams.append("rarity", value);
    });

    getVisibleSupportUnitFilter(unitFilter, supportUnitFilter).forEach((value) => {
      searchParams.append("support_unit", value);
    });

    if (has3dmvCutInFilter) {
      searchParams.set("has_3dmv_cut_in", "true");
    }

    return searchParams;
  };

  const getDataHref = (page: number): string => {
    const searchParams = createListSearchParams(page);
    return `${resolve("/cards/[region]/data", { region: data.region })}?${searchParams.toString()}`;
  };

  const syncPageUrl = (): void => {
    if (!browser) {
      return;
    }

    const searchParams = createListSearchParams(1);
    searchParams.delete("page");
    const pathname = resolve("/cards/[region]", { region: data.region });
    const query = searchParams.toString();
    const nextUrl = query.length > 0 ? `${pathname}?${query}` : pathname;
    replaceState(nextUrl, {});
  };

  const getBreadcrumbItems = () => [
    {
      label: homeLabel,
      href: resolve("/")
    },
    {
      label: cardListTitle
    }
  ];

  const getCardListHref = (region: string): string => {
    const searchParams = createListSearchParams(1);
    searchParams.delete("page");
    const query = searchParams.toString();
    const pathname = resolve("/cards/[region]", { region });
    return query.length > 0 ? `${pathname}?${query}` : pathname;
  };

  const getRegionBadgeOptions = (): RegionBadgeOption[] =>
    supportedRegions.map((regionOption) =>
      regionOption === data.region
        ? {
            key: regionOption,
            label: regionLabels[regionOption],
            active: true
          }
        : {
            key: regionOption,
            label: regionLabels[regionOption],
            href: getCardListHref(regionOption),
            active: false
          }
    );

  const mergeItems = (currentItems: CardListItem[], nextItems: CardListItem[]): CardListItem[] => {
    const existingIds = new Set(currentItems.map((item) => item.id));
    return [...currentItems, ...nextItems.filter((item) => !existingIds.has(item.id))];
  };

  const loadNextPage = async (): Promise<void> => {
    if (isLoading || !hasNext) {
      return;
    }

    isLoading = true;
    isLoadMoreHintVisible = false;
    errorMessage = null;

    try {
      const response = await fetch(getDataHref(currentPage + 1));
      if (!response.ok) {
        throw new Error("Failed to load card list page.");
      }

      const nextPage = (await response.json()) as CardListPagePayload;
      items = mergeItems(items, nextPage.items);
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
    } catch {
      errorMessage = cardListLoadFailed;
    } finally {
      isLoading = false;
    }
  };

  const reloadFirstPage = async (): Promise<void> => {
    if (isLoading) {
      return;
    }

    isLoading = true;
    isReloadingFirstPage = true;
    errorMessage = null;
    isLoadMoreHintVisible = false;

    try {
      const response = await fetch(getDataHref(1));
      if (!response.ok) {
        throw new Error("Failed to load first card list page.");
      }

      const nextPage = (await response.json()) as CardListPagePayload;
      items = nextPage.items;
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
      syncPageUrl();
    } catch {
      errorMessage = cardListLoadFailed;
    } finally {
      isReloadingFirstPage = false;
      isLoading = false;
    }
  };

  const toggleSortBy = (nextSortBy: CardListSortBy): void => {
    if (nextSortBy !== sortBy) {
      sortBy = nextSortBy;
      sortOrder = "desc";
    } else {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
    }

    persistAppliedFilters();
    void reloadFirstPage();
  };

  const setViewMode = (nextViewMode: CardListViewMode): void => {
    viewMode = nextViewMode;
    persistViewMode();
  };

  const openFilterDialog = (): void => {
    syncDraftFiltersFromCurrent();
    filterDialog?.showModal();
  };

  const resetFilterDrafts = (): void => {
    filterNameDraft = "";
    filterUnitDraft = [];
    filterCharacterDraft = [];
    filterSkillDraft = [];
    filterTypeDraft = [];
    filterAttrDraft = [];
    filterRarityDraft = [];
    filterSupportUnitDraft = [];
    has3dmvCutInDraft = false;
  };

  const applyFilters = (): void => {
    const nextName = filterNameDraft.trim();
    const nextUnit = filterUnitDraft;
    const nextCharacter = filterCharacterDraft;
    const nextSkill = filterSkillDraft;
    const nextType = filterTypeDraft;
    const nextAttr = filterAttrDraft;
    const nextRarity = filterRarityDraft;
    const nextSupportUnit = getVisibleSupportUnitFilter(nextUnit, filterSupportUnitDraft);
    const nextHas3dmvCutIn = has3dmvCutInDraft;

    const hasChanged =
      nextName !== nameFilter ||
      nextUnit.length !== unitFilter.length ||
      nextUnit.some((v, i) => v !== unitFilter[i]) ||
      nextCharacter.length !== characterFilter.length ||
      nextCharacter.some((v, i) => v !== characterFilter[i]) ||
      nextSkill.length !== skillFilter.length ||
      nextSkill.some((v, i) => v !== skillFilter[i]) ||
      nextType.length !== typeFilter.length ||
      nextType.some((v, i) => v !== typeFilter[i]) ||
      nextAttr.length !== attrFilter.length ||
      nextAttr.some((v, i) => v !== attrFilter[i]) ||
      nextRarity.length !== rarityFilter.length ||
      nextRarity.some((v, i) => v !== rarityFilter[i]) ||
      nextSupportUnit.length !== supportUnitFilter.length ||
      nextSupportUnit.some((v, i) => v !== supportUnitFilter[i]) ||
      nextHas3dmvCutIn !== has3dmvCutInFilter;

    nameFilter = nextName;
    unitFilter = nextUnit;
    characterFilter = nextCharacter;
    skillFilter = nextSkill;
    typeFilter = nextType;
    attrFilter = nextAttr;
    rarityFilter = nextRarity;
    supportUnitFilter = nextSupportUnit;
    has3dmvCutInFilter = nextHas3dmvCutIn;
    persistAppliedFilters();
    filterDialog?.close();

    if (hasChanged) {
      void reloadFirstPage();
    }
  };

  const toggleDraftValue = (values: string[], value: string, checked: boolean): string[] =>
    checked ? [...values, value] : values.filter((v) => v !== value);

  const getSortOrderIcon = (targetSortBy: CardListSortBy): string =>
    sortBy === targetSortBy && sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down";

  const getSortButtonClass = (targetSortBy: CardListSortBy): string =>
    sortBy === targetSortBy ? "btn-primary" : "btn-outline border-primary text-primary";

  const getViewButtonClass = (targetViewMode: CardListViewMode): string =>
    viewMode === targetViewMode ? "btn-primary" : "btn-outline border-primary text-primary";

  const getListGridClass = (): string => {
    if (viewMode === "agenda") {
      return "grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3";
    }

    if (viewMode === "comfy") {
      return "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
    }

    return "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  };

  const getSelectedFilterButtonClass = (selected: boolean): string =>
    selected ? "btn-primary" : "btn-outline border-base-content/20 text-primary";

  const getFilterButtonClass = (values: string[], value: string): string =>
    getSelectedFilterButtonClass(values.includes(value));
</script>

<svelte:head>
  <title>{cardListTitle} {regionLabels[data.region]} - Sekai Viewer</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-360 flex-col gap-5 px-4">
  <PageHeader breadcrumbs={getBreadcrumbItems()} breadcrumbClass="md:max-w-[60%]">
    {#snippet actions()}
      <RegionBadgeSwitch options={getRegionBadgeOptions()} />
    {/snippet}
  </PageHeader>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="join">
      <button
        type="button"
        class={`btn join-item btn-sm relative !h-12 !min-h-12 !w-12 overflow-visible p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${getSortButtonClass("releaseAt")}`}
        onclick={() => toggleSortBy("releaseAt")}
        title={cardListSortByReleaseAt}
        aria-label={`${cardListSortByReleaseAt} (${sortBy === "releaseAt" ? sortOrder : "desc"})`}
      >
        <Icon icon="mdi:clock-outline" class="h-4 w-4" aria-hidden="true" />
        {#if sortBy === "releaseAt"}
          <span
            class="absolute bottom-1 right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary-content/90 text-primary sm:bottom-0.5 sm:right-0.5 sm:h-3 sm:w-3"
            aria-hidden="true"
          >
            <Icon icon={getSortOrderIcon("releaseAt")} class="h-2.5 w-2.5" />
          </span>
        {/if}
      </button>

      <button
        type="button"
        class={`btn join-item btn-sm relative !h-12 !min-h-12 !w-12 overflow-visible p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${getSortButtonClass("id")}`}
        onclick={() => toggleSortBy("id")}
        title={cardListSortById}
        aria-label={`${cardListSortById} (${sortBy === "id" ? sortOrder : "desc"})`}
      >
        <Icon icon="mdi:numeric" class="h-4 w-4" aria-hidden="true" />
        {#if sortBy === "id"}
          <span
            class="absolute bottom-1 right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary-content/90 text-primary sm:bottom-0.5 sm:right-0.5 sm:h-3 sm:w-3"
            aria-hidden="true"
          >
            <Icon icon={getSortOrderIcon("id")} class="h-2.5 w-2.5" />
          </span>
        {/if}
      </button>
    </div>

    <div class="flex items-center gap-2">
      <div class="join">
        <button
          type="button"
          class={`btn join-item btn-sm !h-12 !min-h-12 !w-12 p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${getViewButtonClass("grid")}`}
          onclick={() => setViewMode("grid")}
          title={cardListViewGrid}
          aria-label={cardListViewGrid}
        >
          <Icon icon="mdi:view-grid-outline" class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`btn join-item btn-sm !h-12 !min-h-12 !w-12 p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${getViewButtonClass("agenda")}`}
          onclick={() => setViewMode("agenda")}
          title={cardListViewAgenda}
          aria-label={cardListViewAgenda}
        >
          <Icon icon="mdi:view-agenda-outline" class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`btn join-item btn-sm !h-12 !min-h-12 !w-12 p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${getViewButtonClass("comfy")}`}
          onclick={() => setViewMode("comfy")}
          title={cardListViewComfy}
          aria-label={cardListViewComfy}
        >
          <Icon icon="mdi:view-comfy-outline" class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        class={`btn btn-sm !h-12 !min-h-12 !w-12 p-0 sm:!h-8 sm:!min-h-8 sm:!w-8 ${hasAnyAppliedFilters() ? "btn-primary" : "btn-outline border-primary text-primary"}`}
        onclick={openFilterDialog}
        title={cardListOpenFilters}
        aria-label={cardListOpenFilters}
      >
        <Icon icon="mdi:funnel" class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>

  {#if isReloadingFirstPage}
    <div
      class="content-card-shell flex min-h-48 items-center justify-center rounded-2xl p-8 shadow-sm"
    >
      <span class="loading loading-spinner loading-md"></span>
      <span class="ml-3 text-sm opacity-70">{cardListLoading}</span>
    </div>
  {:else if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div class={getListGridClass()}>
      {#each visibleItems as item (item.id)}
        <CardListCard
          region={data.region}
          {item}
          {viewMode}
          {idLabel}
          {spoilerContentLabel}
          {cardListCharacterFallback}
          {cardListReleaseLabel}
          {cardImageAltSuffix}
        />
      {/each}
    </div>

    {#if errorMessage}
      <div class="flex items-center justify-center gap-3">
        <div class="alert alert-error max-w-xl flex-1">{errorMessage}</div>
        <button
          type="button"
          class="btn btn-outline btn-sm !min-h-12 sm:!min-h-8"
          onclick={() => void loadNextPage()}
        >
          {cardListRetry}
        </button>
      </div>
    {/if}

    {#if hasNext}
      <div bind:this={sentinel} class="flex min-h-24 items-center justify-center py-5">
        {#if isLoading}
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-3 text-sm opacity-70">{cardListLoadingMore}</span>
        {:else}
          <span class="text-sm opacity-60">
            {isTouchPointer ? cardListLoadMoreHintMobile : cardListLoadMoreHintDesktop}
          </span>
        {/if}
      </div>
    {:else if visibleItems.length > 0}
      <div class="py-2 text-center text-sm opacity-60">{cardListEnd}</div>
    {/if}

    {#if visibleItems.length === 0 && !errorMessage}
      <div class="py-12 text-center text-sm opacity-70">{cardListEmpty}</div>
    {/if}
  {/if}
</section>

<dialog bind:this={filterDialog} class="modal">
  <div class="modal-box max-w-xl">
    <h3 class="text-lg font-semibold">{cardListFiltersTitle}</h3>

    <div class="mt-4 grid grid-cols-1 gap-3">
      <label class="form-control w-full">
        <span class="label-text mb-1 text-sm font-medium">{cardListFilterNameLabel}</span>
        <input
          type="text"
          class="input input-bordered w-full"
          bind:value={filterNameDraft}
          placeholder={cardListFilterNamePlaceholder}
        />
      </label>

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{cardListFilterUnitLabel}</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each filterMeta.unit as option (option.value)}
            <label
              class={`btn btn-sm !h-12 !min-h-12 !w-12 p-0 ${getFilterButtonClass(filterUnitDraft, option.value)}`}
              title={option.label}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterUnitDraft.includes(option.value)}
                onchange={(e) => {
                  filterUnitDraft = toggleDraftValue(
                    filterUnitDraft,
                    option.value,
                    e.currentTarget.checked
                  );
                }}
                aria-label={option.label}
              />
              {#if getUnitIconUrl(option.value)}
                <img
                  src={getUnitIconUrl(option.value) ?? ""}
                  alt=""
                  aria-hidden="true"
                  class="h-7 w-7 object-contain"
                  loading="lazy"
                  decoding="async"
                />
              {/if}
            </label>
          {/each}
        </div>
      </fieldset>

      {#if isPiaproUnitSelected(filterUnitDraft)}
        <fieldset class="form-control w-full gap-2">
          <legend class="label-text text-sm font-medium">{cardListFilterSupportUnitLabel}</legend>
          <div class="join flex w-full flex-wrap">
            {#each supportUnitOptions as option (`support-unit:${option}`)}
              <label
                class={`btn btn-sm join-item !h-12 !min-h-12 !w-12 p-0 ${getFilterButtonClass(filterSupportUnitDraft, option)}`}
                title={getSupportUnitOptionLabel(option)}
              >
                <input
                  type="checkbox"
                  class="sr-only"
                  checked={filterSupportUnitDraft.includes(option)}
                  onchange={(e) => {
                    filterSupportUnitDraft = toggleDraftValue(
                      filterSupportUnitDraft,
                      option,
                      e.currentTarget.checked
                    );
                  }}
                  aria-label={getSupportUnitOptionLabel(option)}
                />
                {#if getUnitIconUrl(option)}
                  <img
                    src={getUnitIconUrl(option) ?? ""}
                    alt=""
                    aria-hidden="true"
                    class="h-7 w-7 object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                {/if}
              </label>
            {/each}
          </div>
        </fieldset>
      {/if}

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{cardListFilterCharacterLabel}</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each filterMeta.character as option (option.value)}
            <label
              class={`btn btn-sm !h-12 !min-h-12 !w-12 p-0 ${getFilterButtonClass(filterCharacterDraft, option.value)}`}
              title={option.label}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterCharacterDraft.includes(option.value)}
                onchange={(e) => {
                  filterCharacterDraft = toggleDraftValue(
                    filterCharacterDraft,
                    option.value,
                    e.currentTarget.checked
                  );
                }}
                aria-label={option.label}
              />
              {#if getCharacterThumbnailUrl(option.value)}
                <img
                  src={getCharacterThumbnailUrl(option.value) ?? ""}
                  alt=""
                  aria-hidden="true"
                  class="h-7 w-7 rounded-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              {/if}
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{cardListFilterSkillLabel}</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each filterMeta.skill as option (option.value)}
            <label
              class={`btn btn-sm !min-h-12 ${getFilterButtonClass(filterSkillDraft, option.value)}`}
              title={formatOptionLabel(option.value)}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterSkillDraft.includes(option.value)}
                onchange={(e) => {
                  filterSkillDraft = toggleDraftValue(
                    filterSkillDraft,
                    option.value,
                    e.currentTarget.checked
                  );
                }}
                aria-label={formatOptionLabel(option.value)}
              />
              <span class="truncate">{formatOptionLabel(option.value)}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{cardListFilterTypeLabel}</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each filterMeta.type as option (option.value)}
            <label
              class={`btn btn-sm !min-h-12 ${getFilterButtonClass(filterTypeDraft, option.value)}`}
              title={formatOptionLabel(option.value)}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterTypeDraft.includes(option.value)}
                onchange={(e) => {
                  filterTypeDraft = toggleDraftValue(
                    filterTypeDraft,
                    option.value,
                    e.currentTarget.checked
                  );
                }}
                aria-label={formatOptionLabel(option.value)}
              />
              <span class="truncate">{formatOptionLabel(option.value)}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{cardListFilterAttrLabel}</legend>
        <div class="join flex w-full flex-wrap">
          {#each attrOptions as option (option)}
            <label
              class={`btn btn-sm join-item !h-12 !min-h-12 !w-12 p-0 ${filterAttrDraft.includes(option) ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
              title={formatOptionLabel(option)}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterAttrDraft.includes(option)}
                onchange={(e) => {
                  filterAttrDraft = toggleDraftValue(
                    filterAttrDraft,
                    option,
                    e.currentTarget.checked
                  );
                }}
                aria-label={formatOptionLabel(option)}
              />
              <img
                src={getAttrIconUrl(option)}
                alt=""
                aria-hidden="true"
                class="h-7 w-7 object-contain"
                loading="lazy"
                decoding="async"
              />
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{cardListFilterRarityLabel}</legend>
        <div class="join flex w-full flex-wrap">
          {#each rarityOptions as option (option)}
            <label
              class={`btn btn-sm join-item !min-h-12 !min-w-12 ${filterRarityDraft.includes(option) ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
              title={getRarityLabel(option)}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterRarityDraft.includes(option)}
                onchange={(e) => {
                  filterRarityDraft = toggleDraftValue(
                    filterRarityDraft,
                    option,
                    e.currentTarget.checked
                  );
                }}
                aria-label={getRarityLabel(option)}
              />
              <span>{getRarityLabel(option)}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <label
        class="flex items-center justify-between gap-3 rounded-box border border-base-content/20 px-3 py-2"
      >
        <span class="text-sm font-medium">{cardListFilter3dmvCutInLabel}</span>
        <input
          type="checkbox"
          class="toggle toggle-primary"
          bind:checked={has3dmvCutInDraft}
          aria-label={cardListFilter3dmvCutInLabel}
        />
      </label>
    </div>

    <div class="modal-action flex-wrap gap-2">
      <button type="button" class="btn btn-outline !min-h-12" onclick={resetFilterDrafts}>
        {cardListFilterReset}
      </button>
      <button type="button" class="btn btn-primary !min-h-12" onclick={applyFilters}>
        {cardListFilterApply}
      </button>
      <form method="dialog">
        <button type="submit" class="btn !min-h-12">{closeLabel}</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
