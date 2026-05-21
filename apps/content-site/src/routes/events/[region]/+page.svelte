<script lang="ts">
  import { browser } from "$app/environment";
  import { asset, resolve } from "$app/paths";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { createCommonTranslator, setI18nLocale, tCommon } from "$lib/i18n";
  import { regionLabels, supportedRegions } from "$lib/regions";
  import Icon from "@iconify/svelte";
  import EventListCard from "$lib/components/EventListCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/RegionBadgeSwitch.svelte";
  import type { PageData } from "./$types";

  type EventListPagePayload = PageData["initialPage"];
  type EventListItem = EventListPagePayload["items"][number];
  type EventListSortBy = "id" | "startAt";
  type EventListSortOrder = "asc" | "desc";

  let { data }: { data: PageData } = $props();
  const getInitialCommonText = (key: string): string =>
    createCommonTranslator(data.uiLocale, data.commonMessages)(key);
  let items = $state<EventListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isLoading = $state(false);
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
  let initialStateAppliedKey = $state("");
  let homeLabel = $state(getInitialCommonText("home"));
  let idLabel = $state(getInitialCommonText("idLabel"));
  let closeLabel = $state(getInitialCommonText("closeLabel"));
  let mixedUnitLabel = $state(getInitialCommonText("mixedUnitLabel"));
  let eventListTitle = $state(getInitialCommonText("eventListTitle"));
  let eventListEmpty = $state(getInitialCommonText("eventListEmpty"));
  let eventListLoadingMore = $state(getInitialCommonText("eventListLoadingMore"));
  let eventListLoadMoreHintDesktop = $state(getInitialCommonText("eventListLoadMoreHintDesktop"));
  let eventListLoadMoreHintMobile = $state(getInitialCommonText("eventListLoadMoreHintMobile"));
  let eventListLoadFailed = $state(getInitialCommonText("eventListLoadFailed"));
  let eventListRetry = $state(getInitialCommonText("eventListRetry"));
  let eventListEnd = $state(getInitialCommonText("eventListEnd"));
  let eventListCurrentEvent = $state(getInitialCommonText("eventListCurrentEvent"));
  let eventListSortById = $state(getInitialCommonText("eventListSortById"));
  let eventListSortByStartAt = $state(getInitialCommonText("eventListSortByStartAt"));
  let eventListOpenFilters = $state(getInitialCommonText("eventListOpenFilters"));
  let eventListFiltersTitle = $state(getInitialCommonText("eventListFiltersTitle"));
  let eventListFilterNameLabel = $state(getInitialCommonText("eventListFilterNameLabel"));
  let eventListFilterNamePlaceholder = $state(getInitialCommonText("eventListFilterNamePlaceholder"));
  let eventListFilterEventTypeLabel = $state(getInitialCommonText("eventListFilterEventTypeLabel"));
  let eventListFilterUnitLabel = $state(getInitialCommonText("eventListFilterUnitLabel"));
  let eventListFilterReset = $state(getInitialCommonText("eventListFilterReset"));
  let eventListFilterApply = $state(getInitialCommonText("eventListFilterApply"));
  let spoilerContentLabel = $state(getInitialCommonText("spoilerContent"));
  let bannerAltSuffix = $state(getInitialCommonText("bannerAltSuffix"));

  const unitFilterValues = [
    "idol",
    "light_sound",
    "street",
    "theme_park",
    "school_refusal",
    "piapro",
    "mixed"
  ] as const;

  const formatUnitLabel = (value: string): string => {
    if (value === "mixed") {
      return mixedUnitLabel;
    }

    return value
      .split("_")
      .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const getEventTypeOptions = (): Array<{ value: string; label: string }> => [
    { value: "marathon", label: tCommon(data.uiLocale, "eventTypeValues.marathon", "marathon") },
    {
      value: "cheerful_carnival",
      label: tCommon(data.uiLocale, "eventTypeValues.cheerfulCarnival", "cheerful_carnival")
    },
    { value: "world_bloom", label: tCommon(data.uiLocale, "eventTypeValues.worldLink", "world_bloom") }
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
    return [
      "sort_by",
      "sort_order",
      "name",
      "event_type",
      "unit"
    ].some((key) => searchParams.has(key));
  };

  const getFilterStorageKey = (): string => `content-site:event-list-filters:${data.region}`;

  const getInitialStateKey = (): string =>
    [
      data.region,
      data.initialQuery.sortBy,
      data.initialQuery.sortOrder,
      data.initialQuery.name,
      data.initialQuery.eventType,
      data.initialQuery.unit,
      data.initialPage.pagination.page,
      data.initialPage.items.length,
      data.currentEventId ?? ""
    ].join("|");

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

      const nextSortBy = parsed.sortBy === "startAt" ? "startAt" : "id";
      const nextSortOrder = parsed.sortOrder === "asc" ? "asc" : "desc";
      const nextName = typeof parsed.name === "string" ? parsed.name.trim() : "";
      const nextEventType = Array.isArray(parsed.eventType)
        ? parsed.eventType.filter((v) => typeof v === "string").map((v: string) => v.trim()).filter((v: string) => v.length > 0)
        : [];
      const nextUnit = Array.isArray(parsed.unit)
        ? parsed.unit.filter((v) => typeof v === "string").map((v: string) => v.trim()).filter((v: string) => v.length > 0)
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
    eventTypeFilter = [...data.initialQuery.eventType];
    unitFilter = [...data.initialQuery.unit];
    syncDraftFiltersFromCurrent();
    errorMessage = data.initialLoadFailed ? getInitialCommonText("eventListLoadFailed") : null;

    // Do not overwrite persisted state on plain route entry without query params.
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

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    idLabel = translate("idLabel");
    closeLabel = translate("closeLabel");
    mixedUnitLabel = translate("mixedUnitLabel");
    eventListTitle = translate("eventListTitle");
    eventListEmpty = translate("eventListEmpty");
    eventListLoadingMore = translate("eventListLoadingMore");
    eventListLoadMoreHintDesktop = translate("eventListLoadMoreHintDesktop");
    eventListLoadMoreHintMobile = translate("eventListLoadMoreHintMobile");
    eventListLoadFailed = translate("eventListLoadFailed");
    eventListRetry = translate("eventListRetry");
    eventListEnd = translate("eventListEnd");
    eventListCurrentEvent = translate("eventListCurrentEvent");
    eventListSortById = translate("eventListSortById");
    eventListSortByStartAt = translate("eventListSortByStartAt");
    eventListOpenFilters = translate("eventListOpenFilters");
    eventListFiltersTitle = translate("eventListFiltersTitle");
    eventListFilterNameLabel = translate("eventListFilterNameLabel");
    eventListFilterNamePlaceholder = translate("eventListFilterNamePlaceholder");
    eventListFilterEventTypeLabel = translate("eventListFilterEventTypeLabel");
    eventListFilterUnitLabel = translate("eventListFilterUnitLabel");
    eventListFilterReset = translate("eventListFilterReset");
    eventListFilterApply = translate("eventListFilterApply");
    spoilerContentLabel = translate("spoilerContent");
    bannerAltSuffix = translate("bannerAltSuffix");
  };

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, data.commonMessages);
    applyTranslations((key) => tCommon(locale, key));
  };

  const createListSearchParams = (page: number): SvelteURLSearchParams => {
    const searchParams = new SvelteURLSearchParams();
    searchParams.set("page", String(page));
    searchParams.set("sort_by", sortBy);
    searchParams.set("sort_order", sortOrder);

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
    window.history.replaceState(window.history.state, "", nextUrl);
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
      <button
        type="button"
        class={`btn join-item btn-sm ${getSortButtonClass("id")}`}
        onclick={() => toggleSortBy("id")}
        title={eventListSortById}
        aria-label={`${eventListSortById} (${sortBy === "id" ? sortOrder : "desc"})`}
      >
        <Icon icon="mdi:numeric" class="h-4 w-4" aria-hidden="true" />
        {#if sortBy === "id"}
          <Icon icon={getSortOrderIcon("id")} class="h-4 w-4" aria-hidden="true" />
        {/if}
      </button>

      <button
        type="button"
        class={`btn join-item btn-sm ${getSortButtonClass("startAt")}`}
        onclick={() => toggleSortBy("startAt")}
        title={eventListSortByStartAt}
        aria-label={`${eventListSortByStartAt} (${sortBy === "startAt" ? sortOrder : "desc"})`}
      >
        <Icon icon="mdi:clock-start" class="h-4 w-4" aria-hidden="true" />
        {#if sortBy === "startAt"}
          <Icon icon={getSortOrderIcon("startAt")} class="h-4 w-4" aria-hidden="true" />
        {/if}
      </button>
    </div>

    <button
      type="button"
      class={`btn btn-sm ${hasAnyAppliedFilters() ? "btn-primary" : "btn-outline border-primary text-primary"}`}
      onclick={openFilterDialog}
      title={eventListOpenFilters}
      aria-label={eventListOpenFilters}
    >
      <Icon icon="mdi:funnel" class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>

  {#if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {#each items as item (item.id)}
        <EventListCard
          region={data.region}
          {item}
          currentEventId={data.currentEventId}
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
        <button type="button" class="btn btn-outline btn-sm" onclick={() => void loadNextPage()}>
          {eventListRetry}
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
            {isTouchPointer ? eventListLoadMoreHintMobile : eventListLoadMoreHintDesktop}
          </span>
        {/if}
      </div>
    {:else if items.length > 0}
      <div class="py-2 text-center text-sm opacity-60">{eventListEnd}</div>
    {/if}

    {#if items.length === 0 && !errorMessage}
      <div class="py-12 text-center text-sm opacity-70">{eventListEmpty}</div>
    {/if}
  {/if}
</section>

<dialog bind:this={filterDialog} class="modal">
  <div class="modal-box max-w-xl">
    <h3 class="text-lg font-semibold">{eventListFiltersTitle}</h3>

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
              class={`btn btn-sm join-item ${filterEventTypeDraft.includes(option.value) ? "btn-primary" : "btn-outline border-primary text-primary"}`}
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
              class={`btn btn-sm join-item h-10 min-h-10 w-10 p-0 ${filterUnitDraft.includes(option.value) ? "btn-primary" : "btn-outline border-primary text-primary"}`}
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
                <Icon icon="mdi:puzzle" class="h-4 w-4" aria-hidden="true" />
              {:else if getUnitIconUrl(option.value)}
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
    </div>

    <div class="modal-action flex-wrap gap-2">
      <button type="button" class="btn btn-outline" onclick={resetFilterDrafts}>
        {eventListFilterReset}
      </button>
      <button type="button" class="btn btn-primary" onclick={applyFilters}>
        {eventListFilterApply}
      </button>
      <form method="dialog">
        <button type="submit" class="btn">{closeLabel}</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
