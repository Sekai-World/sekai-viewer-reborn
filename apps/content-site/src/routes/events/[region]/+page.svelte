<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { getContentSiteCommonText, regionLabels, supportedRegions } from "$lib/i18n-data";
  import EventListCard from "$lib/components/EventListCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RegionBadgeSwitch, { type RegionBadgeOption } from "$lib/components/RegionBadgeSwitch.svelte";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { DEFAULT_UI_LOCALE } from "$lib/region";
  import type { PageData } from "./$types";

  type EventListPagePayload = PageData["initialPage"];
  type EventListItem = EventListPagePayload["items"][number];

  let { data }: { data: PageData } = $props();
  const initialLocale = DEFAULT_UI_LOCALE;
  let items = $state<EventListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);
  let sentinel: HTMLDivElement | null = $state(null);
  let isLoadMoreHintVisible = $state(false);
  let isTouchPointer = $state(false);
  let lastTouchY = $state<number | null>(null);
  let homeLabel = $state(getContentSiteCommonText(initialLocale, "home"));
  let idLabel = $state(getContentSiteCommonText(initialLocale, "idLabel"));
  let eventListTitle = $state(getContentSiteCommonText(initialLocale, "eventListTitle"));
  let eventListEmpty = $state(getContentSiteCommonText(initialLocale, "eventListEmpty"));
  let eventListLoadingMore = $state(getContentSiteCommonText(initialLocale, "eventListLoadingMore"));
  let eventListLoadMoreHintDesktop = $state(
    getContentSiteCommonText(initialLocale, "eventListLoadMoreHintDesktop")
  );
  let eventListLoadMoreHintMobile = $state(
    getContentSiteCommonText(initialLocale, "eventListLoadMoreHintMobile")
  );
  let eventListLoadFailed = $state(getContentSiteCommonText(initialLocale, "eventListLoadFailed"));
  let eventListRetry = $state(getContentSiteCommonText(initialLocale, "eventListRetry"));
  let eventListEnd = $state(getContentSiteCommonText(initialLocale, "eventListEnd"));
  let eventListCurrentEvent = $state(getContentSiteCommonText(initialLocale, "eventListCurrentEvent"));
  let spoilerContentLabel = $state(getContentSiteCommonText(initialLocale, "spoilerContent"));
  let bannerAltSuffix = $state(getContentSiteCommonText(initialLocale, "bannerAltSuffix"));

  $effect(() => {
    items = data.initialPage.items;
    currentPage = data.initialPage.pagination.page;
    hasNext = data.initialPage.pagination.hasNext;
    errorMessage = data.initialLoadFailed ? tCommon(data.uiLocale, "eventListLoadFailed") : null;
  });

  $effect(() => {
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

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    homeLabel = tCommon(locale, "home");
    idLabel = tCommon(locale, "idLabel");
    eventListTitle = tCommon(locale, "eventListTitle");
    eventListEmpty = tCommon(locale, "eventListEmpty");
    eventListLoadingMore = tCommon(locale, "eventListLoadingMore");
    eventListLoadMoreHintDesktop = tCommon(locale, "eventListLoadMoreHintDesktop");
    eventListLoadMoreHintMobile = tCommon(locale, "eventListLoadMoreHintMobile");
    eventListLoadFailed = tCommon(locale, "eventListLoadFailed");
    eventListRetry = tCommon(locale, "eventListRetry");
    eventListEnd = tCommon(locale, "eventListEnd");
    eventListCurrentEvent = tCommon(locale, "eventListCurrentEvent");
    spoilerContentLabel = tCommon(locale, "spoilerContent");
    bannerAltSuffix = tCommon(locale, "bannerAltSuffix");
  };

  const getDataHref = (page: number): string =>
    `${resolve("/events/[region]/data", { region: data.region })}?page=${page}`;
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
  const getEventListHref = (region: string): string =>
    resolve("/events/[region]", { region });
  const getRegionBadgeOptions = (): RegionBadgeOption[] =>
    regionDisplayOrder.map((regionOption) => ({
      key: regionOption,
      label: regionLabels[regionOption],
      href: regionOption === data.region ? undefined : getEventListHref(regionOption),
      active: regionOption === data.region
    }));

  const mergeItems = (currentItems: EventListItem[], nextItems: EventListItem[]): EventListItem[] => {
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

  {#if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
