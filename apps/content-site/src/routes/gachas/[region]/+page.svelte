<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SvelteSet, SvelteURLSearchParams } from "svelte/reactivity";
  import GachaListCard from "$lib/components/gacha/GachaListCard.svelte";
  import ListToolbarButton from "$lib/components/shared/ListToolbarButton.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import {
    createI18nTranslator,
    resolveStreamingMessages,
  } from "$lib/i18n/runtime";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import { toTimestampMs } from "$lib/time/date-time";
  import type { PageData } from "./$types";

  import type { GachaListPage, GachaListItem as GachaListItemType } from "$lib/server/gacha-list";

  type GachaListPagePayload = GachaListPage;
  type GachaListItem = GachaListItemType;
  type GachaListSortBy = "id" | "startAt";
  type GachaListSortOrder = "asc" | "desc";

  let { data }: { data: PageData } = $props();
  let translationRequestId = 0;
  const gachaListLoadingFallback = "Loading gachas...";
  const getInitialI18nText = (key: string, fallback?: string): string =>
    createI18nTranslator(data.uiLocale, resolveStreamingMessages(data.i18nMessages, ["common", "gacha", "error"]))(key, fallback);
  let items = $state<GachaListItem[]>([]);
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
  let sortBy = $state<GachaListSortBy>("startAt");
  let sortOrder = $state<GachaListSortOrder>("desc");
  let hasTriedRestorePersistedSort = $state(false);
  let spoilerContentAppliedState = $state<boolean | null>(null);
  let homeLabel = $state(getInitialI18nText("home"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let gachaListTitle = $state(getInitialI18nText("gachaListTitle"));
  let gachaListEmpty = $state(getInitialI18nText("gachaListEmpty"));
  let gachaListLoading = $state(getInitialI18nText("gachaListLoading"));
  let gachaListLoadingMore = $state(getInitialI18nText("gachaListLoadingMore"));
  let listLoadMoreHintDesktop = $state(getInitialI18nText("listLoadMoreHintDesktop"));
  let listLoadMoreHintMobile = $state(getInitialI18nText("listLoadMoreHintMobile"));
  let gachaListLoadFailed = $state(getInitialI18nText("gachaListLoadFailed"));
  let listRetry = $state(getInitialI18nText("listRetry"));
  let gachaListEnd = $state(getInitialI18nText("gachaListEnd"));
  let listSortById = $state(getInitialI18nText("listSortById"));
  let gachaListSortByStartAt = $state(getInitialI18nText("gachaListSortByStartAt"));
  let spoilerContentLabel = $state(getInitialI18nText("spoilerContent"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  let currentGachaLabel = $state(getInitialI18nText("currentGachaLabel"));
  const contentDisplaySettings = getContentDisplaySettings();

  const currentGachaIds = $derived.by(() => {
    const now = Date.now();
    const ids = new SvelteSet<string>();
    for (const item of items) {
      const startMs = toTimestampMs(item.startAt);
      const endMs = toTimestampMs(item.endAt);
      if (startMs !== null && endMs !== null && startMs <= now && now <= endMs) {
        ids.add(item.id);
      }
    }
    return ids;
  });

  const isSpoilerGacha = (item: GachaListItem): boolean => {
    const startAtMs = toTimestampMs(item.startAt);
    return startAtMs !== null && startAtMs > Date.now();
  };

  const visibleItems = $derived.by(() => {
    const base = contentDisplaySettings.showSpoilerContent
      ? items
      : items.filter((item) => !isSpoilerGacha(item));

    if (!contentDisplaySettings.ongoingFirst) {
      return base;
    }

    const ongoing: GachaListItem[] = [];
    const rest: GachaListItem[] = [];
    for (const item of base) {
      if (currentGachaIds.has(item.id)) {
        ongoing.push(item);
      } else {
        rest.push(item);
      }
    }
    return [...ongoing, ...rest];
  });

  const hasNonDefaultSort = (): boolean => sortBy !== "startAt" || sortOrder !== "desc";

  const hasExplicitQueryStateInUrl = (): boolean => {
    if (!browser) {
      return false;
    }

    const searchParams = new URLSearchParams(window.location.search);
    return ["sort_by", "sort_order", "spoiler"].some((key) => searchParams.has(key));
  };

  const getSortStorageKey = (): string => `content-site:gacha-list-sort:${data.region}`;

  const persistAppliedSort = (): void => {
    if (!browser) {
      return;
    }

    window.localStorage.setItem(getSortStorageKey(), JSON.stringify({ sortBy, sortOrder }));
  };

  const restorePersistedSort = (): boolean => {
    if (!browser) {
      return false;
    }

    const raw = window.localStorage.getItem(getSortStorageKey());
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as {
        sortBy?: unknown;
        sortOrder?: unknown;
      };

      const nextSortBy = parsed.sortBy === "id" ? "id" : "startAt";
      const nextSortOrder = parsed.sortOrder === "asc" ? "asc" : "desc";

      if (nextSortBy === sortBy && nextSortOrder === sortOrder) {
        return false;
      }

      sortBy = nextSortBy;
      sortOrder = nextSortOrder;
      return true;
    } catch {
      return false;
    }
  };

  const applyInitialPage = (
    page: GachaListPagePayload,
    loadFailed: boolean
  ): void => {
    items = page.items;
    currentPage = page.pagination.page;
    hasNext = page.pagination.hasNext;
    sortBy = data.initialQuery.sortBy;
    sortOrder = data.initialQuery.sortOrder;
    errorMessage = loadFailed ? getInitialI18nText("gachaListLoadFailed") : null;
    isInitialLoading = false;

    if (browser && hasExplicitQueryStateInUrl()) {
      persistAppliedSort();
    }
  };

  type InitialPageResult =
    | { page: GachaListPagePayload; loadFailed: false }
    | { page: GachaListPagePayload; loadFailed: true };

  const hydrateFromInitialPage = (result: InitialPageResult): void => {
    applyInitialPage(result.page, result.loadFailed);
  };

  $effect(() => {
    // data.initialPage is a streaming Promise at runtime, but SvelteKit's
    // generated types unwrap it. Cast to access .then() for streaming hydration.
    const streaming = data.initialPage as unknown as Promise<InitialPageResult>;
    streaming.then(hydrateFromInitialPage);
  });

  $effect(() => {
    if (!browser || hasTriedRestorePersistedSort) {
      return;
    }

    hasTriedRestorePersistedSort = true;

    if (hasNonDefaultSort()) {
      return;
    }

    if (restorePersistedSort()) {
      persistAppliedSort();
      void reloadFirstPage();
    }
  });

  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    const translate = createI18nTranslator(data.uiLocale, resolveStreamingMessages(messagesOrPromise, ["common", "gacha", "error"]));
    applyTranslations(translate);
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
    gachaListTitle = translate("gachaListTitle");
    gachaListEmpty = translate("gachaListEmpty");
    gachaListLoading = translate("gachaListLoading", gachaListLoadingFallback);
    gachaListLoadingMore = translate("gachaListLoadingMore");
    listLoadMoreHintDesktop = translate("listLoadMoreHintDesktop");
    listLoadMoreHintMobile = translate("listLoadMoreHintMobile");
    gachaListLoadFailed = translate("gachaListLoadFailed");
    listRetry = translate("listRetry");
    gachaListEnd = translate("gachaListEnd");
    listSortById = translate("listSortById");
    gachaListSortByStartAt = translate("gachaListSortByStartAt");
    spoilerContentLabel = translate("spoilerContent");
    bannerAltSuffix = translate("bannerAltSuffix");
    currentGachaLabel = translate("currentGachaLabel");
  };

  const refreshPageTranslations = async (localeValue: string, messagesOrPromise: typeof data.i18nMessages, requestId: number): Promise<void> => {
    const messages = await messagesOrPromise;
    if (requestId !== translationRequestId) return;
    const locale = localeValue;
    applyTranslations(createI18nTranslator(locale, messages));
  };

  const createListSearchParams = (page: number): SvelteURLSearchParams => {
    const searchParams = new SvelteURLSearchParams();
    searchParams.set("page", String(page));
    searchParams.set("sort_by", sortBy);
    searchParams.set("sort_order", sortOrder);
    searchParams.set("spoiler", String(contentDisplaySettings.showSpoilerContent));

    return searchParams;
  };

  const getDataHref = (page: number): string => {
    const searchParams = createListSearchParams(page);
    return `${resolve("/gachas/[region]/data", { region: data.region })}?${searchParams.toString()}`;
  };

  const syncPageUrl = (): void => {
    if (!browser) {
      return;
    }

    const searchParams = createListSearchParams(1);
    searchParams.delete("page");
    const pathname = resolve("/gachas/[region]", { region: data.region });
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
      label: gachaListTitle
    }
  ];

  const getGachaListHref = (region: string): string => {
    const searchParams = createListSearchParams(1);
    searchParams.delete("page");
    const query = searchParams.toString();
    const pathname = resolve("/gachas/[region]", { region });
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
            href: getGachaListHref(regionOption),
            active: false
          }
    );

  const mergeItems = (
    currentItems: GachaListItem[],
    nextItems: GachaListItem[]
  ): GachaListItem[] => {
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
        throw new Error("Failed to load gacha list page.");
      }

      const nextPage = (await response.json()) as GachaListPagePayload;
      items = mergeItems(items, nextPage.items);
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
    } catch {
      errorMessage = gachaListLoadFailed;
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
        throw new Error("Failed to load first gacha list page.");
      }

      const nextPage = (await response.json()) as GachaListPagePayload;
      items = nextPage.items;
      currentPage = nextPage.pagination.page;
      hasNext = nextPage.pagination.hasNext;
      syncPageUrl();
    } catch {
      errorMessage = gachaListLoadFailed;
    } finally {
      isReloadingFirstPage = false;
      isLoading = false;
    }
  };

  const toggleSortBy = (nextSortBy: GachaListSortBy): void => {
    if (nextSortBy !== sortBy) {
      sortBy = nextSortBy;
      sortOrder = "desc";
    } else {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
    }

    persistAppliedSort();
    void reloadFirstPage();
  };

  const getSortOrderIcon = (targetSortBy: GachaListSortBy): string =>
    sortBy === targetSortBy && sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down";

  const getSortButtonClass = (targetSortBy: GachaListSortBy): string =>
    sortBy === targetSortBy ? "btn-primary" : "btn-outline border-primary text-primary";
</script>

<svelte:head>
  <title>{gachaListTitle} {regionLabels[data.region]} - Sekai Viewer</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-360 flex-col gap-5 px-2">
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
        label={gachaListSortByStartAt}
        ariaLabel={`${gachaListSortByStartAt} (${sortBy === "startAt" ? sortOrder : "desc"})`}
        sortIndicatorIcon={sortBy === "startAt" ? getSortOrderIcon("startAt") : undefined}
        class={`join-item ${getSortButtonClass("startAt")}`}
        onclick={() => toggleSortBy("startAt")}
      />
    </div>
  </div>

  {#if isReloadingFirstPage}
    <div
      class="content-card-shell flex min-h-48 items-center justify-center rounded-2xl p-8 shadow-sm"
    >
      <span class="loading loading-spinner loading-md"></span>
      <span class="ml-3 text-sm opacity-70">{gachaListLoading}</span>
    </div>
  {:else if isInitialLoading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
        <div class="content-card-shell flex flex-col gap-3 rounded-2xl p-4 shadow-sm">
          <div class="skeleton h-32 rounded-xl"></div>
          <div class="skeleton h-4 w-3/4 rounded"></div>
          <div class="skeleton h-4 w-1/2 rounded"></div>
        </div>
      {/each}
    </div>
  {:else if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {#each visibleItems as item (item.id)}
        <GachaListCard
          region={data.region}
          {item}
          currentGachaIds={currentGachaIds}
          currentGachaLabel={currentGachaLabel}
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
          <span class="ml-3 text-sm opacity-70">{gachaListLoadingMore}</span>
        {:else}
          <span class="text-sm opacity-60">
            {isTouchPointer ? listLoadMoreHintMobile : listLoadMoreHintDesktop}
          </span>
        {/if}
      </div>
    {:else if visibleItems.length > 0}
      <div class="py-2 text-center text-sm opacity-60">{gachaListEnd}</div>
    {/if}

    {#if visibleItems.length === 0 && !errorMessage}
      <div class="content-card-inset py-12 text-center text-sm opacity-70">{gachaListEmpty}</div>
    {/if}
  {/if}
</section>
