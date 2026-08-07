<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { asset, resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import { untrack } from "svelte";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import { toTimestampMs } from "$lib/time/date-time";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { UNIT_CODE_ORDER } from "$lib/domain/unit-profile";
  import CardListCard from "$lib/components/card/CardListCard.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import ListToolbarButton from "$lib/components/shared/ListToolbarButton.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import type { CardListPage, CardListItem as CardListItemType } from "$lib/server/card-list";
  import type { PageData } from "./$types";

  type CardListPagePayload = CardListPage;
  type CardListItem = CardListItemType;
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
  const fallbackMessages = getLocalI18nMessages(["common", "card", "event", "error"]);
  const resolveStreamingMessages = (
    messagesOrPromise: typeof data.i18nMessages
  ): Record<string, string> =>
    messagesOrPromise instanceof Promise ? fallbackMessages : messagesOrPromise;
  let translationRequestId = 0;
  let initialPageRequestId = 0;
  let listRequestId = 0;
  let currentMessages = $state<Record<string, string>>(
    resolveStreamingMessages(untrack(() => data.i18nMessages))
  );
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, currentMessages)(key);
  let items = $state<CardListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isLoading = $state(false);
  let isInitialLoading = $state(true);
  let isReloadingFirstPage = $state(false);
  let loadedRegion = $state("");
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
  let hasTriedRestoreViewMode = $state(false);
  let spoilerContentAppliedState = $state<boolean | null>(null);
  let homeLabel = $state(getInitialI18nText("home"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let cardListTitle = $state(getInitialI18nText("cardListTitle"));
  let cardListEmpty = $state(getInitialI18nText("cardListEmpty"));
  let cardListLoadingMore = $state(getInitialI18nText("cardListLoadingMore"));
  let listLoadMoreHintDesktop = $state(getInitialI18nText("listLoadMoreHintDesktop"));
  let listLoadMoreHintMobile = $state(getInitialI18nText("listLoadMoreHintMobile"));
  let cardListLoadFailed = $state(getInitialI18nText("cardListLoadFailed"));
  let listRetry = $state(getInitialI18nText("listRetry"));
  let cardListEnd = $state(getInitialI18nText("cardListEnd"));
  let listSortById = $state(getInitialI18nText("listSortById"));
  let listSortByReleaseAt = $state(getInitialI18nText("listSortByReleaseAt"));
  let listOpenFilters = $state(getInitialI18nText("listOpenFilters"));
  let listFiltersTitle = $state(getInitialI18nText("listFiltersTitle"));
  let cardListFilterNameLabel = $state(getInitialI18nText("cardListFilterNameLabel"));
  let cardListFilterNamePlaceholder = $state(getInitialI18nText("cardListFilterNamePlaceholder"));
  let cardListFilterAttrLabel = $state(getInitialI18nText("cardListFilterAttrLabel"));
  let cardListFilterCharacterLabel = $state(getInitialI18nText("cardListFilterCharacterLabel"));
  let cardListFilter3dmvCutInLabel = $state(getInitialI18nText("cardListFilter3dmvCutInLabel"));
  let cardListFilterRarityLabel = $state(getInitialI18nText("cardListFilterRarityLabel"));
  let cardListFilterSkillLabel = $state(getInitialI18nText("cardListFilterSkillLabel"));
  let cardListFilterSupportUnitLabel = $state(getInitialI18nText("cardListFilterSupportUnitLabel"));
  let cardListFilterTypeLabel = $state(getInitialI18nText("cardListFilterTypeLabel"));
  let cardListFilterUnitLabel = $state(getInitialI18nText("cardListFilterUnitLabel"));
  let listFilterReset = $state(getInitialI18nText("listFilterReset"));
  let listFilterApply = $state(getInitialI18nText("listFilterApply"));
  let cardListLoading = $state(getInitialI18nText("cardListLoading"));
  let listViewGrid = $state(getInitialI18nText("listViewGrid"));
  let listViewAgenda = $state(getInitialI18nText("listViewAgenda"));
  let cardListViewComfy = $state(getInitialI18nText("cardListViewComfy"));
  let cardListCharacterFallback = $state(getInitialI18nText("cardListCharacterFallback"));
  let cardListReleaseLabel = $state(getInitialI18nText("cardListReleaseLabel"));
  let cardImageAltSuffix = $state(getInitialI18nText("cardImageAltSuffix"));
  let spoilerContentLabel = $state(getInitialI18nText("spoilerContent"));
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

  const getUnitOptionLabel = (value: string): string =>
    filterMeta.unit.find((option) => option.value === value)?.label ?? formatOptionLabel(value);

  const getSupportUnitOptionLabel = (value: string): string =>
    value === "none" ? getUnitOptionLabel("piapro") : getUnitOptionLabel(value);

  const isPiaproUnitSelected = (values: string[]): boolean => values.includes("piapro");

  const getVisibleSupportUnitFilter = (units: string[], supportUnits: string[]): string[] =>
    isPiaproUnitSelected(units) ? supportUnits : [];

  const getAttrIconUrl = (value: string): string => asset(`/card_attr/icon_attribute_${value}.png`);

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

  const getCurrentListIdentity = (): string =>
    JSON.stringify({
      region: data.region,
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
      has3dmvCutIn: has3dmvCutInFilter,
      spoiler: spoilerFilter
    });

  const beginListRequest = (): number => {
    listRequestId += 1;
    return listRequestId;
  };

  const isCurrentListRequest = (requestId: number, listIdentity: string): boolean =>
    requestId === listRequestId && listIdentity === getCurrentListIdentity();

  const resetListStateForNavigation = (): void => {
    items = [];
    currentPage = 1;
    hasNext = false;
    isLoading = false;
    isInitialLoading = true;
    isReloadingFirstPage = false;
    errorMessage = null;
    isLoadMoreHintVisible = false;
    lastTouchY = null;
    loadedRegion = data.region;
  };

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

  type InitialPageResult = {
    page: CardListPagePayload;
    loadFailed: boolean;
  };

  const applyInitialPage = (result: InitialPageResult): void => {
    items = result.page.items;
    currentPage = result.page.pagination.page;
    hasNext = result.page.pagination.hasNext;
    errorMessage = result.loadFailed ? getInitialI18nText("cardListLoadFailed") : null;

    // Initialize filter/sort state from server query params once per navigation.
    // Must be here (not in a $effect) to avoid effect_update_depth_exceeded:
    // writing reactive state inside $effect triggers re-run → infinite loop.
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

    if (browser && hasExplicitQueryStateInUrl()) {
      persistAppliedFilters();
    }

    isInitialLoading = false;
    loadedRegion = data.region;
    // Post-initial reconciliation: persisted filters and spoiler preference.
    // These must run AFTER isInitialLoading=false and filter state is set from
    // the server load, to avoid racing with applyInitialPage's own state writes.
    let needsReload = false;

    // Restore persisted filters only when the URL has no explicit filter/sort
    // query params (same guard as the old $effect, but now sequential).
    if (browser && !hasExplicitQueryStateInUrl()) {
      if (restorePersistedFilters()) {
        persistAppliedFilters();
        needsReload = true;
      }
    }

    // Reconcile spoiler preference: if the user's content display setting differs
    // from the server-loaded state, reload with the correct spoiler filter.
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
    const requestId = initialPageRequestId + 1;
    initialPageRequestId = requestId;
    const listRequestIdForInitialPage = beginListRequest();
    resetListStateForNavigation();

    initialPagePromise.then((result) => {
      if (requestId !== initialPageRequestId || listRequestIdForInitialPage !== listRequestId) {
        return;
      }

      applyInitialPage(result);
    });
  });

  $effect(() => {
    if (!browser || hasTriedRestoreViewMode) {
      return;
    }

    hasTriedRestoreViewMode = true;
    restorePersistedViewMode();
  });

  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    void refreshPageTranslations(data.uiLocale, messagesOrPromise, requestId);
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
    // On initial mount, applyInitialPage handles spoiler reconciliation after
    // the server load settles. Skip here to avoid a race between the effect's
    // reloadFirstPage() and applyInitialPage resetting filter state.
    if (isInitialSpoilerState) {
      return;
    }

    if (spoilerContentAppliedState === nextShowSpoilerContent) {
      return;
    }

    spoilerContentAppliedState = nextShowSpoilerContent;
    spoilerFilter = nextShowSpoilerContent;
    void reloadFirstPage();
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    idLabel = translate("idLabel");
    closeLabel = translate("closeLabel");
    cardListTitle = translate("cardListTitle");
    cardListEmpty = translate("cardListEmpty");
    cardListLoadingMore = translate("cardListLoadingMore");
    listLoadMoreHintDesktop = translate("listLoadMoreHintDesktop");
    listLoadMoreHintMobile = translate("listLoadMoreHintMobile");
    cardListLoadFailed = translate("cardListLoadFailed");
    listRetry = translate("listRetry");
    cardListEnd = translate("cardListEnd");
    listSortById = translate("listSortById");
    listSortByReleaseAt = translate("listSortByReleaseAt");
    listOpenFilters = translate("listOpenFilters");
    listFiltersTitle = translate("listFiltersTitle");
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
    listFilterReset = translate("listFilterReset");
    listFilterApply = translate("listFilterApply");
    cardListLoading = translate("cardListLoading");
    listViewGrid = translate("listViewGrid");
    listViewAgenda = translate("listViewAgenda");
    cardListViewComfy = translate("cardListViewComfy");
    cardListCharacterFallback = translate("cardListCharacterFallback");
    cardListReleaseLabel = translate("cardListReleaseLabel");
    cardImageAltSuffix = translate("cardImageAltSuffix");
    spoilerContentLabel = translate("spoilerContent");
  };

  const refreshPageTranslations = async (
    localeValue: string,
    messagesOrPromise: typeof data.i18nMessages,
    requestId: number
  ): Promise<void> => {
    let messages: Record<string, string>;
    try {
      messages = await messagesOrPromise;
    } catch {
      return;
    }
    if (requestId !== translationRequestId) return;
    const locale = localeValue;
    currentMessages = messages;
    applyTranslations(createI18nTranslator(locale, messages));
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

  const getCardDetailHref = (item: CardListItem): string =>
    resolve("/card/[region]/[id]", { region: data.region, id: item.id });

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

    const requestId = beginListRequest();
    const listIdentity = getCurrentListIdentity();
    isLoading = true;
    isLoadMoreHintVisible = false;
    errorMessage = null;

    try {
      const response = await fetch(getDataHref(currentPage + 1));
      if (!response.ok) {
        throw new Error("Failed to load card list page.");
      }

      const nextPage = (await response.json()) as CardListPagePayload;
      if (!isCurrentListRequest(requestId, listIdentity)) {
        return;
      }

      items = mergeItems(items, nextPage.items);
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
    } catch {
      if (isCurrentListRequest(requestId, listIdentity)) {
        errorMessage = cardListLoadFailed;
      }
    } finally {
      if (isCurrentListRequest(requestId, listIdentity)) {
        isLoading = false;
      }
    }
  };

  const reloadFirstPage = async (): Promise<void> => {
    if (isLoading) {
      return;
    }

    const requestId = beginListRequest();
    const listIdentity = getCurrentListIdentity();
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
      if (!isCurrentListRequest(requestId, listIdentity)) {
        return;
      }

      items = nextPage.items;
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
      syncPageUrl();
    } catch {
      if (isCurrentListRequest(requestId, listIdentity)) {
        errorMessage = cardListLoadFailed;
      }
    } finally {
      if (isCurrentListRequest(requestId, listIdentity)) {
        isReloadingFirstPage = false;
        isLoading = false;
      }
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

<section use:swipeRegion class="mx-auto flex w-full max-w-360 flex-col gap-5 px-2">
  <PageHeader breadcrumbs={getBreadcrumbItems()} breadcrumbClass="md:max-w-[60%]">
    {#snippet actions()}
      <RegionBadgeSwitch options={getRegionBadgeOptions()} />
    {/snippet}
  </PageHeader>

  <div
    class="archive-card-controls flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5"
  >
    <div class="archive-control-group flex items-center gap-2">
      <div class="join">
        <ListToolbarButton
          icon="mdi:clock-outline"
          label={listSortByReleaseAt}
          ariaLabel={`${listSortByReleaseAt} (${sortBy === "releaseAt" ? sortOrder : "desc"})`}
          sortIndicatorIcon={sortBy === "releaseAt" ? getSortOrderIcon("releaseAt") : undefined}
          class={`join-item ${getSortButtonClass("releaseAt")}`}
          onclick={() => toggleSortBy("releaseAt")}
        />

        <ListToolbarButton
          icon="mdi:numeric"
          label={listSortById}
          ariaLabel={`${listSortById} (${sortBy === "id" ? sortOrder : "desc"})`}
          sortIndicatorIcon={sortBy === "id" ? getSortOrderIcon("id") : undefined}
          class={`join-item ${getSortButtonClass("id")}`}
          onclick={() => toggleSortBy("id")}
        />
      </div>
    </div>

    <div class="archive-control-group flex items-center justify-between gap-2 sm:justify-end">
      <div class="join">
        <ListToolbarButton
          icon="mdi:view-grid-outline"
          label={listViewGrid}
          class={`join-item ${getViewButtonClass("grid")}`}
          onclick={() => setViewMode("grid")}
        />
        <ListToolbarButton
          icon="mdi:view-agenda-outline"
          label={listViewAgenda}
          class={`join-item ${getViewButtonClass("agenda")}`}
          onclick={() => setViewMode("agenda")}
        />
        <ListToolbarButton
          icon="mdi:view-comfy-outline"
          label={cardListViewComfy}
          class={`join-item ${getViewButtonClass("comfy")}`}
          onclick={() => setViewMode("comfy")}
        />
      </div>

      <ListToolbarButton
        icon="mdi:funnel"
        label={listOpenFilters}
        class={hasAnyAppliedFilters()
          ? "btn-primary shadow-sm"
          : "btn-outline border-primary text-primary"}
        onclick={openFilterDialog}
      />
    </div>
  </div>

  {#if isReloadingFirstPage}
    <div
      class="archive-list-status flex min-h-48 items-center justify-center rounded-2xl border p-8"
    >
      <span class="loading loading-spinner loading-md"></span>
      <span class="ml-3 text-sm opacity-70">{cardListLoading}</span>
    </div>
  {:else if isInitialLoading || data.region !== loadedRegion}
    <div class={`archive-results-field ${getListGridClass()}`}>
      {#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
        <div class="archive-card-skeleton rounded-2xl border p-4">
          <div class="skeleton h-48 w-full rounded-xl"></div>
          <div class="mt-3 skeleton h-4 w-3/4 rounded"></div>
          <div class="mt-2 skeleton h-3 w-1/2 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div class={`archive-results-field ${getListGridClass()}`}>
      {#each visibleItems as item (item.id)}
        <CardListCard
          href={getCardDetailHref(item)}
          region={data.region}
          {item}
          {viewMode}
          {idLabel}
          {spoilerContentLabel}
          {cardListCharacterFallback}
          {cardListReleaseLabel}
          {cardImageAltSuffix}
          displayLocale={data.uiLocale}
        />
      {/each}
    </div>

    {#if errorMessage}
      <div class="archive-list-error flex items-center justify-center gap-3 rounded-2xl border p-3">
        <div class="alert alert-error max-w-xl flex-1">{errorMessage}</div>
        <button
          type="button"
          class="btn btn-outline btn-sm min-h-12! sm:min-h-8!"
          onclick={() => void loadNextPage()}
        >
          {listRetry}
        </button>
      </div>
    {/if}

    {#if hasNext}
      <div
        bind:this={sentinel}
        class="archive-list-sentinel flex min-h-24 items-center justify-center rounded-2xl py-5"
      >
        {#if isLoading}
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-3 text-sm opacity-70">{cardListLoadingMore}</span>
        {:else}
          <span class="text-sm opacity-60">
            {isTouchPointer ? listLoadMoreHintMobile : listLoadMoreHintDesktop}
          </span>
        {/if}
      </div>
    {:else if visibleItems.length > 0}
      <div class="archive-list-end py-3 text-center text-sm">{cardListEnd}</div>
    {/if}

    {#if visibleItems.length === 0 && !errorMessage}
      <div class="archive-list-empty rounded-2xl border py-12 text-center text-sm">
        {cardListEmpty}
      </div>
    {/if}
  {/if}
</section>

<dialog bind:this={filterDialog} class="modal">
  <div class="modal-box archive-filter-dialog max-w-xl border">
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
              class={`btn btn-sm size-12! min-h-12! p-0 ${getFilterButtonClass(filterUnitDraft, option.value)}`}
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
              <UnitIconBadge unit={option.value} variant="sm" fallbackLabel={option.label} />
            </label>
          {/each}
        </div>
      </fieldset>

      {#if isPiaproUnitSelected(filterUnitDraft)}
        <fieldset class="form-control w-full gap-2">
          <legend class="label-text text-sm font-medium">{cardListFilterSupportUnitLabel}</legend>
          <div class="flex flex-wrap gap-1.5">
            {#each supportUnitOptions as option (`support-unit:${option}`)}
              <label
                class={`btn btn-sm size-12! min-h-12! p-0 ${getFilterButtonClass(filterSupportUnitDraft, option)}`}
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
                <UnitIconBadge
                  unit={option}
                  variant="sm"
                  fallbackLabel={getSupportUnitOptionLabel(option)}
                  mapNoneToPiapro
                />
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
              class={`btn btn-sm size-12! min-h-12! p-0 ${getFilterButtonClass(filterCharacterDraft, option.value)}`}
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
              <CharacterAvatar
                src={getLocalCharacterThumbnailAssetURL(option.value)}
                label={option.label}
                characterId={option.value}
                variant="xs"
                decorative
              />
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{cardListFilterSkillLabel}</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each filterMeta.skill as option (option.value)}
            <label
              class={`btn btn-sm min-h-12! ${getFilterButtonClass(filterSkillDraft, option.value)}`}
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
              class={`btn btn-sm min-h-12! ${getFilterButtonClass(filterTypeDraft, option.value)}`}
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
              class={`btn btn-sm join-item size-12! min-h-12! p-0 ${filterAttrDraft.includes(option) ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
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
                class="size-7 object-contain"
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
              class={`btn btn-sm join-item min-h-12! min-w-12! ${filterRarityDraft.includes(option) ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
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
      <button type="button" class="btn btn-outline min-h-12!" onclick={resetFilterDrafts}>
        {listFilterReset}
      </button>
      <button type="button" class="btn btn-primary min-h-12!" onclick={applyFilters}>
        {listFilterApply}
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit" aria-label={closeLabel}></button>
  </form>
</dialog>

<style>
  .archive-card-controls,
  .archive-list-status,
  .archive-list-error,
  .archive-list-empty,
  .archive-filter-dialog {
    background: var(--archive-surface-raised);
    border-color: var(--archive-border-default);
  }

  .archive-control-group {
    min-width: 0;
  }

  .archive-results-field {
    position: relative;
    isolation: isolate;
  }

  .archive-results-field::before {
    position: absolute;
    z-index: -1;
    inset: -0.75rem;
    border: 1px solid var(--archive-border-subtle);
    border-radius: 1.25rem;
    background: var(--archive-surface-sunken);
    content: "";
  }

  .archive-card-skeleton {
    background: var(--archive-surface-raised);
    border-color: var(--archive-border-subtle);
  }

  .archive-list-sentinel,
  .archive-list-end {
    color: var(--archive-text-muted);
  }

  .archive-filter-dialog {
    box-shadow: 0 1.5rem 4rem color-mix(in oklab, var(--archive-text-strong) 14%, transparent);
  }

  @media (max-width: 639px) {
    .archive-results-field::before {
      inset: -0.5rem;
      border-radius: 1rem;
    }
  }
</style>
