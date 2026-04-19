<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { getContentSiteCommonText, regionLabels } from "@platform/i18n-dicts";
  import { getEventBannerAssetURL } from "$lib/assets";
  import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
  import { getEventTypeDisplay } from "$lib/event";
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
  let homeLabel = $state(getContentSiteCommonText(initialLocale, "home"));
  let eventListTitle = $state(getContentSiteCommonText(initialLocale, "eventListTitle"));
  let eventListEmpty = $state(getContentSiteCommonText(initialLocale, "eventListEmpty"));
  let eventListLoadingMore = $state(getContentSiteCommonText(initialLocale, "eventListLoadingMore"));
  let eventListLoadFailed = $state(getContentSiteCommonText(initialLocale, "eventListLoadFailed"));
  let eventListRetry = $state(getContentSiteCommonText(initialLocale, "eventListRetry"));
  let eventListEnd = $state(getContentSiteCommonText(initialLocale, "eventListEnd"));
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
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPage();
        }
      },
      { rootMargin: "320px 0px" }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  });

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    homeLabel = tCommon(locale, "home");
    eventListTitle = tCommon(locale, "eventListTitle");
    eventListEmpty = tCommon(locale, "eventListEmpty");
    eventListLoadingMore = tCommon(locale, "eventListLoadingMore");
    eventListLoadFailed = tCommon(locale, "eventListLoadFailed");
    eventListRetry = tCommon(locale, "eventListRetry");
    eventListEnd = tCommon(locale, "eventListEnd");
    bannerAltSuffix = tCommon(locale, "bannerAltSuffix");
  };

  const getDataHref = (page: number): string =>
    `${resolve("/events/[region]/list/data", { region: data.region })}?page=${page}`;
  const getBreadcrumbItems = () => [
    {
      label: homeLabel,
      href: resolve("/")
    },
    {
      label: eventListTitle
    }
  ];

  const mergeItems = (currentItems: EventListItem[], nextItems: EventListItem[]): EventListItem[] => {
    const existingIds = new Set(currentItems.map((item) => item.id));
    return [...currentItems, ...nextItems.filter((item) => !existingIds.has(item.id))];
  };

  const loadNextPage = async (): Promise<void> => {
    if (isLoading || !hasNext) {
      return;
    }

    isLoading = true;
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
  <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <Breadcrumbs items={getBreadcrumbItems()} class="md:max-w-[60%]" />
    <div class="flex items-center gap-2">
      <h1 class="text-xl font-semibold md:text-2xl">{eventListTitle}</h1>
      <span class="badge homepage-region-badge font-semibold shadow-sm">
        {regionLabels[data.region]}
      </span>
    </div>
  </div>

  {#if items.length === 0 && errorMessage}
    <div class="alert alert-error">{errorMessage}</div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {#each items as item (item.id)}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a
          href={`${resolve("/event/[id]", { id: item.id })}?region=${encodeURIComponent(data.region)}`}
          class="card content-card-shell homepage-event-card group overflow-hidden shadow-sm"
        >
          <div class="relative aspect-[16/10] overflow-hidden">
            {#if item.assetBundleName}
              <img
                src={getEventBannerAssetURL(item.assetBundleName, data.region)}
                alt={`${item.title} ${bannerAltSuffix}`}
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
              />
            {:else}
              <div class="flex h-full items-center justify-center bg-base-200/70 px-6 text-center text-sm opacity-70">
                {item.title}
              </div>
            {/if}

            {#if getEventTypeDisplay(item.eventType)}
              <div class="absolute right-3 top-3">
                <span class="badge border-none bg-base-100/92 font-semibold text-base-content shadow-sm backdrop-blur-sm">
                  {getEventTypeDisplay(item.eventType)}
                </span>
              </div>
            {/if}
          </div>

          <div class="card-body gap-2 p-4">
            <h2 class="line-clamp-2 text-base font-semibold leading-tight">{item.title}</h2>
          </div>
        </a>
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
      <div bind:this={sentinel} class="flex min-h-16 items-center justify-center py-4">
        {#if isLoading}
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-3 text-sm opacity-70">{eventListLoadingMore}</span>
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
