<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { asset, resolve } from "$app/paths";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { toTimestampMs } from "$lib/time/date-time";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import { createI18nTranslator, resolveStreamingMessages, setI18nLocale, tCommon } from "$lib/i18n/runtime";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { formatUnitFallbackLabel, UNIT_CODE_ORDER } from "$lib/domain/unit-profile";
  import Icon from "@iconify/svelte";
  import EventListCard from "$lib/components/event/EventListCard.svelte";
  import ListToolbarButton from "$lib/components/shared/ListToolbarButton.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import type { EventListPage, EventListItem as EventListItemType } from "$lib/server/event-list";
  import type { PageData } from "./$types";

  type EventListPagePayload = EventListPage;
  type EventListItem = EventListItemType;
  type EventListSortBy = "id" | "startAt";
  type EventListSortOrder = "asc" | "desc";

  let { data }: { data: PageData } = $props();
  const eventListLoadingFallback = "Loading events...";
  const getInitialI18nText = (key: string, fallback?: string): string =>
    createI18nTranslator(data.uiLocale, resolveStreamingMessages(data.i18nMessages))(key, fallback);
  let items = $state<EventListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isLoading = $state(false);
  let isInitialLoading = $state(true);
  let isReloadingFirstPage = $state(false);
  let errorMessage = $state<string | null>(null);
  let sentinel: HTMLDivElement | null = $state(null);
  let isLoadMoreHintVisible = $state(false);
  let isTouchPointer = $state(false);
  let lastTouchY = $state<number | null>(null);
  let sortBy = $state<EventListSortBy>("startAt");
  let sortOrder = $state<EventListSortOrder>("desc");
  let nameFilter = $state("");
  let eventTypeFilter = $state<string[]>([]);
  let unitFilter = $state<string[]>([]);
  let filterNameDraft = $state("");
  let filterEventTypeDraft = $state<string[]>([]);
  let filterUnitDraft = $state<string[]>([]);
  let filterDialog: HTMLDialogElement | null = $state(null);
  let hasTriedRestorePersistedFilters = $state(false);
  let spoilerContentAppliedState = $state<boolean | null>(null);
  let homeLabel = $state(getInitialI18nText("home"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let mixedUnitLabel = $state(getInitialI18nText("mixedUnitLabel"));
  let eventListTitle = $state(getInitialI18nText("eventListTitle"));
  let eventListEmpty = $state(getInitialI18nText("eventListEmpty"));
  let eventListLoading = $state(getInitialI18nText("eventListLoading"));
  let eventListLoadingMore = $state(getInitialI18nText("eventListLoadingMore"));
  let listLoadMoreHintDesktop = $state(getInitialI18nText("listLoadMoreHintDesktop"));
  let listLoadMoreHintMobile = $state(getInitialI18nText("listLoadMoreHintMobile"));
  let eventListLoadFailed = $state(getInitialI18nText("eventListLoadFailed"));
  let listRetry = $state(getInitialI18nText("listRetry"));
  let eventListEnd = $state(getInitialI18nText("eventListEnd"));
  let eventListCurrentEvent = $state(getInitialI18nText("eventListCurrentEvent"));
  let listSortById = $state(getInitialI18nText("listSortById"));
  let eventListSortByStartAt = $state(getInitialI18nText("eventListSortByStartAt"));
  let listOpenFilters = $state(getInitialI18nText("listOpenFilters"));
  let listFiltersTitle = $state(getInitialI18nText("listFiltersTitle"));
  let eventListFilterNameLabel = $state(getInitialI18nText("eventListFilterNameLabel"));
  let eventListFilterNamePlaceholder = $state(getInitialI18nText("eventListFilterNamePlaceholder"));
  let eventListFilterEventTypeLabel = $state(getInitialI18nText("eventListFilterEventTypeLabel"));
  let eventListFilterUnitLabel = $state(getInitialI18nText("eventListFilterUnitLabel"));
  let listFilterReset = $state(getInitialI18nText("listFilterReset"));
  let listFilterApply = $state(getInitialI18nText("listFilterApply"));
  let spoilerContentLabel = $state(getInitialI18nText("spoilerContent"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  const contentDisplaySettings = getContentDisplaySettings();

  const unitFilterValues = [...UNIT_CODE_ORDER, "mixed"] as const;

  const formatUnitLabel = (value: string): string => {
    if (value === "mixed") {
      return mixedUnitLabel;
    }

    return data.unitProfiles[value] ?? formatUnitFallbackLabel(value);
  };

  const getEventTypeOptions = (): Array<{ value: string; label: string }> => [
    { value: "marathon", label: tCommon(data.uiLocale, "eventTypeValues.marathon", "marathon") },
    {
      value: "cheerful_carnival",
      label: tCommon(data.uiLocale, "eventTypeValues.cheerfulCarnival", "cheerful_carnival")
    },
    {
      value: "world_bloom",
      label: tCommon(data.uiLocale, "eventTypeValues.worldLink", "world_bloom")
    }
  ];

  const getUnitOptions = (): Array<{ value: string; label: string }> => [
    ...unitFilterValues.map((value) => ({ value, label: formatUnitLabel(value) }))
  ];

  const getUnitIconUrl = (value: string): string | null => {
    if (value === "" || value === "mixed") {
      return null;
    }

    return asset(`/icons/icon_${value}.png`);
  };

  const isSpoilerEvent = (item: EventListItem): boolean => {
    const startAtMs = toTimestampMs(item.startAt);
    return startAtMs !== null && startAtMs > Date.now();
  };

  const visibleItems = $derived.by(() => {
    if (contentDisplaySettings.showSpoilerContent) {
      return items;
    }

    return items.filter((item) => !isSpoilerEvent(item));
  });

  const syncDraftFiltersFromCurrent = (): void => {
    filterNameDraft = nameFilter;
    filterEventTypeDraft = [...eventTypeFilter];
    filterUnitDraft = [...unitFilter];
  };

  const hasAnyAppliedFilters = (): boolean =>
    nameFilter.length > 0 || eventTypeFilter.length > 0 || unitFilter.length > 0;

  const hasNonDefaultSort = (): boolean => sortBy !== "startAt" || sortOrder !== "desc";

  const hasExplicitQueryStateInUrl = (): boolean => {
    if (!browser) {
      return false;
    }

    const searchParams = new URLSearchParams(window.location.search);
    return ["sort_by", "sort_order", "name", "event_type", "unit", "spoiler"].some((key) =>
      searchParams.has(key)
    );
  };

  const getFilterStorageKey = (): string => `content-site:event-list-filters:${data.region}`;

  let currentEventId = $state<string | null>(null);

  const persistAppliedFilters = (): void => {
    if (!browser) {
      return;
    }

    const payload = {
      sortBy,
      sortOrder,
      name: nameFilter,
      eventType: eventTypeFilter,
      unit: unitFilter
    };

    window.localStorage.setItem(getFilterStorageKey(), JSON.stringify(payload));
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
        eventType?: unknown;
        unit?: unknown;
      };

      const nextSortBy = parsed.sortBy === "id" ? "id" : "startAt";
      const nextSortOrder = parsed.sortOrder === "asc" ? "asc" : "desc";
      const nextName = typeof parsed.name === "string" ? parsed.name.trim() : "";
      const nextEventType = Array.isArray(parsed.eventType)
        ? parsed.eventType
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];
      const nextUnit = Array.isArray(parsed.unit)
        ? parsed.unit
            .filter((v) => typeof v === "string")
            .map((v: string) => v.trim())
            .filter((v: string) => v.length > 0)
        : [];

      if (
        nextSortBy === sortBy &&
        nextSortOrder === sortOrder &&
        nextName.length === 0 &&
        nextEventType.length === 0 &&
        nextUnit.length === 0
      ) {
        return false;
      }

      sortBy = nextSortBy;
      sortOrder = nextSortOrder;
      nameFilter = nextName;
      eventTypeFilter = nextEventType;
      unitFilter = nextUnit;
      syncDraftFiltersFromCurrent();
      return true;
    } catch {
      return false;
    }
  };

  type InitialPageResult = {
    page: EventListPagePayload;
    loadFailed: boolean;
    currentEventId: string | null;
  };

  const applyInitialPage = (result: InitialPageResult): void => {
    items = result.page.items;
    currentPage = result.page.pagination.page;
    hasNext = result.page.pagination.hasNext;
    currentEventId = result.currentEventId;
    errorMessage = result.loadFailed ? getInitialI18nText("eventListLoadFailed") : null;

    // Initialize filter/sort state from server query params once per navigation.
    // Must be here (not in a $effect) to avoid effect_update_depth_exceeded:
    // writing reactive state inside $effect triggers re-run → infinite loop.
    sortBy = data.initialQuery.sortBy;
    sortOrder = data.initialQuery.sortOrder;
    nameFilter = data.initialQuery.name;
    eventTypeFilter = [...data.initialQuery.eventType];
    unitFilter = [...data.initialQuery.unit];
    syncDraftFiltersFromCurrent();

    if (browser && hasExplicitQueryStateInUrl()) {
      persistAppliedFilters();
    }

    isInitialLoading = false;
  };

  $effect(() => {
    const initialPagePromise = data.initialPage as unknown as Promise<InitialPageResult>;
    initialPagePromise.then(applyInitialPage);
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
    const translate = createI18nTranslator(data.uiLocale, resolveStreamingMessages(data.i18nMessages));
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
    if (spoilerContentAppliedState === nextShowSpoilerContent) {
      return;
    }

    spoilerContentAppliedState = nextShowSpoilerContent;

    const hasSpoilerQueryParam =
      new URL(window.location.href).searchParams.get("spoiler") === "true";
    if (hasSpoilerQueryParam !== nextShowSpoilerContent) {
      void reloadFirstPage();
    }
  });

  const applyTranslations = (translate: (key: string, fallback?: string) => string): void => {
    homeLabel = translate("home");
    idLabel = translate("idLabel");
    closeLabel = translate("closeLabel");
    mixedUnitLabel = translate("mixedUnitLabel");
    eventListTitle = translate("eventListTitle");
    eventListEmpty = translate("eventListEmpty");
    eventListLoading = translate("eventListLoading", eventListLoadingFallback);
    eventListLoadingMore = translate("eventListLoadingMore");
    listLoadMoreHintDesktop = translate("listLoadMoreHintDesktop");
    listLoadMoreHintMobile = translate("listLoadMoreHintMobile");
    eventListLoadFailed = translate("eventListLoadFailed");
    listRetry = translate("listRetry");
    eventListEnd = translate("eventListEnd");
    eventListCurrentEvent = translate("eventListCurrentEvent");
    listSortById = translate("listSortById");
    eventListSortByStartAt = translate("eventListSortByStartAt");
    listOpenFilters = translate("listOpenFilters");
    listFiltersTitle = translate("listFiltersTitle");
    eventListFilterNameLabel = translate("eventListFilterNameLabel");
    eventListFilterNamePlaceholder = translate("eventListFilterNamePlaceholder");
    eventListFilterEventTypeLabel = translate("eventListFilterEventTypeLabel");
    eventListFilterUnitLabel = translate("eventListFilterUnitLabel");
    listFilterReset = translate("listFilterReset");
    listFilterApply = translate("listFilterApply");
    spoilerContentLabel = translate("spoilerContent");
    bannerAltSuffix = translate("bannerAltSuffix");
  };

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, resolveStreamingMessages(data.i18nMessages));
    applyTranslations((key: string, fallback?: string) => tCommon(locale, key, fallback));
  };

  const createListSearchParams = (page: number): SvelteURLSearchParams => {
    const searchParams = new SvelteURLSearchParams();
    searchParams.set("page", String(page));
    searchParams.set("sort_by", sortBy);
    searchParams.set("sort_order", sortOrder);
    searchParams.set("spoiler", String(contentDisplaySettings.showSpoilerContent));

    if (nameFilter) {
      searchParams.set("name", nameFilter);
    }

    eventTypeFilter.forEach((value) => {
      searchParams.append("event_type", value);
    });

    unitFilter.forEach((value) => {
      searchParams.append("unit", value);
    });

    return searchParams;
  };

  const getDataHref = (page: number): string => {
    const searchParams = createListSearchParams(page);
    return `${resolve("/events/[region]/data", { region: data.region })}?${searchParams.toString()}`;
  };

  const syncPageUrl = (): void => {
    if (!browser) {
      return;
    }

    const searchParams = createListSearchParams(1);
    searchParams.delete("page");
    const pathname = resolve("/events/[region]", { region: data.region });
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
      label: eventListTitle
    }
  ];
  const regionDisplayOrder = supportedRegions;
  const getEventListHref = (region: string): string => {
    const searchParams = createListSearchParams(1);
    searchParams.delete("page");
    const query = searchParams.toString();
    const pathname = resolve("/events/[region]", { region });
    return query.length > 0 ? `${pathname}?${query}` : pathname;
  };
  const getRegionBadgeOptions = (): RegionBadgeOption[] =>
    regionDisplayOrder.map((regionOption) =>
      regionOption === data.region
        ? {
            key: regionOption,
            label: regionLabels[regionOption],
            active: true
          }
        : {
            key: regionOption,
            label: regionLabels[regionOption],
            href: getEventListHref(regionOption),
            active: false
          }
    );

  const mergeItems = (
    currentItems: EventListItem[],
    nextItems: EventListItem[]
  ): EventListItem[] => {
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
        throw new Error("Failed to load event list page.");
      }

      const nextPage = (await response.json()) as EventListPagePayload;
      items = mergeItems(items, nextPage.items);
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
    } catch {
      errorMessage = eventListLoadFailed;
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
        throw new Error("Failed to load first event list page.");
      }

      const nextPage = (await response.json()) as EventListPagePayload;
      items = nextPage.items;
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
      syncPageUrl();
    } catch {
      errorMessage = eventListLoadFailed;
    } finally {
      isReloadingFirstPage = false;
      isLoading = false;
    }
  };

  const toggleSortBy = (nextSortBy: EventListSortBy): void => {
    if (nextSortBy !== sortBy) {
      sortBy = nextSortBy;
      sortOrder = "desc";
    } else {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
    }

    persistAppliedFilters();
    void reloadFirstPage();
  };

  const openFilterDialog = (): void => {
    syncDraftFiltersFromCurrent();
    filterDialog?.showModal();
  };

  const resetFilterDrafts = (): void => {
    filterNameDraft = "";
    filterEventTypeDraft = [];
    filterUnitDraft = [];
  };

  const applyFilters = (): void => {
    const nextName = filterNameDraft.trim();
    const nextEventType = filterEventTypeDraft;
    const nextUnit = filterUnitDraft;

    const hasChanged =
      nextName !== nameFilter ||
      nextEventType.length !== eventTypeFilter.length ||
      nextEventType.some((v, i) => v !== eventTypeFilter[i]) ||
      nextUnit.length !== unitFilter.length ||
      nextUnit.some((v, i) => v !== unitFilter[i]);

    nameFilter = nextName;
    eventTypeFilter = nextEventType;
    unitFilter = nextUnit;
    persistAppliedFilters();
    filterDialog?.close();

    if (hasChanged) {
      void reloadFirstPage();
    }
  };

  const getSortOrderIcon = (targetSortBy: EventListSortBy): string =>
    sortBy === targetSortBy && sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down";

  const getSortButtonClass = (targetSortBy: EventListSortBy): string =>
    sortBy === targetSortBy ? "btn-primary" : "btn-outline border-primary text-primary";
</script>

<svelte:head>
  <title>{eventListTitle} {regionLabels[data.region]} - Sekai Viewer</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-360 flex-col gap-5 px-4">
  <PageHeader breadcrumbs={getBreadcrumbItems()} breadcrumbClass="md:max-w-[60%]">
    {#snippet actions()}
      <RegionBadgeSwitch options={getRegionBadgeOptions()} />
    {/snippet}
  </PageHeader>

  <div class="flex items-center justify-between gap-2">
    <div class="join">
      <ListToolbarButton
        icon="mdi:numeric"
        label={listSortById}
        ariaLabel={`${listSortById} (${sortBy === "id" ? sortOrder : "desc"})`}
        sortIndicatorIcon={sortBy === "id" ? getSortOrderIcon("id") : undefined}
        class={`join-item ${getSortButtonClass("id")}`}
        onclick={() => toggleSortBy("id")}
      />

      <ListToolbarButton
        icon="mdi:clock-start"
        label={eventListSortByStartAt}
        ariaLabel={`${eventListSortByStartAt} (${sortBy === "startAt" ? sortOrder : "desc"})`}
        sortIndicatorIcon={sortBy === "startAt" ? getSortOrderIcon("startAt") : undefined}
        class={`join-item ${getSortButtonClass("startAt")}`}
        onclick={() => toggleSortBy("startAt")}
      />
    </div>

    <ListToolbarButton
      icon="mdi:funnel"
      label={listOpenFilters}
      class={hasAnyAppliedFilters() ? "btn-primary" : "btn-outline border-primary text-primary"}
      onclick={openFilterDialog}
    />
  </div>

  {#if isReloadingFirstPage}
    <div
      class="content-card-shell flex min-h-48 items-center justify-center rounded-2xl p-8 shadow-sm"
    >
      <span class="loading loading-spinner loading-md"></span>
      <span class="ml-3 text-sm opacity-70">{eventListLoading}</span>
    </div>
  {:else if isInitialLoading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {#each Array(12) as _, _i (_i)}
        <div class="content-card-shell rounded-2xl p-4 shadow-sm">
          <div class="skeleton h-36 w-full rounded-xl"></div>
          <div class="mt-3 skeleton h-4 w-3/4 rounded"></div>
          <div class="mt-2 skeleton h-3 w-1/2 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {#each visibleItems as item (item.id)}
        <EventListCard
          region={data.region}
          {item}
          {currentEventId}
          currentEventLabel={eventListCurrentEvent}
          {spoilerContentLabel}
          uiLocale={data.uiLocale}
          {idLabel}
          {bannerAltSuffix}
        />
      {/each}
    </div>

    {#if errorMessage}
      <div class="flex items-center justify-center gap-3">
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
      <div bind:this={sentinel} class="flex min-h-24 items-center justify-center py-5">
        {#if isLoading}
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-3 text-sm opacity-70">{eventListLoadingMore}</span>
        {:else}
          <span class="text-sm opacity-60">
            {isTouchPointer ? listLoadMoreHintMobile : listLoadMoreHintDesktop}
          </span>
        {/if}
      </div>
    {:else if visibleItems.length > 0}
      <div class="py-2 text-center text-sm opacity-60">{eventListEnd}</div>
    {/if}

    {#if visibleItems.length === 0 && !errorMessage}
      <div class="py-12 text-center text-sm opacity-70">{eventListEmpty}</div>
    {/if}
  {/if}
</section>

<dialog bind:this={filterDialog} class="modal">
  <div class="modal-box max-w-xl">
    <h3 class="text-lg font-semibold">{listFiltersTitle}</h3>

    <div class="mt-4 grid grid-cols-1 gap-3">
      <label class="form-control w-full">
        <span class="label-text mb-1 text-sm font-medium">{eventListFilterNameLabel}</span>
        <input
          type="text"
          class="input input-bordered w-full"
          bind:value={filterNameDraft}
          placeholder={eventListFilterNamePlaceholder}
        />
      </label>

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{eventListFilterEventTypeLabel}</legend>
        <div class="join flex w-full flex-wrap">
          {#each getEventTypeOptions() as option (option.value)}
            <label
              class={`btn btn-sm join-item min-h-12! ${filterEventTypeDraft.includes(option.value) ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
              title={option.label}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterEventTypeDraft.includes(option.value)}
                onchange={(e) => {
                  if (e.currentTarget.checked) {
                    filterEventTypeDraft = [...filterEventTypeDraft, option.value];
                  } else {
                    filterEventTypeDraft = filterEventTypeDraft.filter((v) => v !== option.value);
                  }
                }}
                aria-label={option.label}
              />
              <span>{option.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="form-control w-full gap-2">
        <legend class="label-text text-sm font-medium">{eventListFilterUnitLabel}</legend>
        <div class="join flex w-full flex-wrap">
          {#each getUnitOptions() as option (`unit:${option.value}`)}
            <label
              class={`btn btn-sm join-item size-12! min-h-12! p-0 ${filterUnitDraft.includes(option.value) ? "btn-primary" : "btn-outline border-base-content/20 text-primary"}`}
              title={option.label}
            >
              <input
                type="checkbox"
                class="sr-only"
                checked={filterUnitDraft.includes(option.value)}
                onchange={(e) => {
                  if (e.currentTarget.checked) {
                    filterUnitDraft = [...filterUnitDraft, option.value];
                  } else {
                    filterUnitDraft = filterUnitDraft.filter((v) => v !== option.value);
                  }
                }}
                aria-label={option.label}
              />
              {#if option.value === "mixed"}
                <Icon icon="mdi:puzzle" class="size-4" aria-hidden="true" />
              {:else if getUnitIconUrl(option.value)}
                <img
                  src={getUnitIconUrl(option.value) ?? ""}
                  alt=""
                  aria-hidden="true"
                  class="size-7 object-contain"
                  loading="lazy"
                  decoding="async"
                />
              {/if}
            </label>
          {/each}
        </div>
      </fieldset>
    </div>

    <div class="modal-action flex-wrap gap-2">
      <button type="button" class="btn btn-outline min-h-12!" onclick={resetFilterDrafts}>
        {listFilterReset}
      </button>
      <button type="button" class="btn btn-primary min-h-12!" onclick={applyFilters}>
        {listFilterApply}
      </button>
      <form method="dialog">
        <button type="submit" class="btn min-h-12!">{closeLabel}</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
