<script lang="ts">
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { getContentDisplaySettings } from "$lib/content-display-settings";
  import MusicListCard from "$lib/components/MusicListCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/RegionBadgeSwitch.svelte";
  import { createCommonTranslator, setI18nLocale, tCommon } from "$lib/i18n";
  import { regionLabels, supportedRegions } from "$lib/regions";
  import Icon from "@iconify/svelte";
  import type { PageData } from "./$types";

  type MusicListPagePayload = PageData["initialPage"];
  type MusicListItem = MusicListPagePayload["items"][number];
  type MusicListSortBy = "publishedAt" | "id";
  type MusicListSortOrder = "asc" | "desc";
  type MusicListViewMode = "grid" | "agenda";

  let { data }: { data: PageData } = $props();
  const getInitialCommonText = (key: string): string =>
    createCommonTranslator(data.uiLocale, data.commonMessages)(key);

  let items = $state<MusicListItem[]>([]);
  let currentPage = $state(1);
  let hasNext = $state(false);
  let isLoading = $state(false);
  let isReloading = $state(false);
  let errorMessage = $state<string | null>(null);
  let sortBy = $state<MusicListSortBy>("publishedAt");
  let sortOrder = $state<MusicListSortOrder>("desc");
  let nameFilter = $state("");
  let categoryFilter = $state<string[]>([]);
  let composerFilter = $state("");
  let arrangerFilter = $state("");
  let lyricistFilter = $state("");
  let nameDraft = $state("");
  let categoryDraft = $state<string[]>([]);
  let composerDraft = $state("");
  let arrangerDraft = $state("");
  let lyricistDraft = $state("");
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
  let musicListLoadFailed = $state(getInitialCommonText("musicListLoadFailed"));
  let musicListLoadMore = $state(getInitialCommonText("musicListLoadMore"));
  let musicListOpenFilters = $state(getInitialCommonText("musicListOpenFilters"));
  let musicListFiltersTitle = $state(getInitialCommonText("musicListFiltersTitle"));
  let musicListFilterNameLabel = $state(getInitialCommonText("musicListFilterNameLabel"));
  let musicListFilterNamePlaceholder = $state(
    getInitialCommonText("musicListFilterNamePlaceholder")
  );
  let musicListFilterCategoryLabel = $state(getInitialCommonText("musicListFilterCategoryLabel"));
  let musicListComposerLabel = $state(getInitialCommonText("musicListComposerLabel"));
  let musicListArrangerLabel = $state(getInitialCommonText("musicListArrangerLabel"));
  let musicListLyricistLabel = $state(getInitialCommonText("musicListLyricistLabel"));
  let musicListFilterReset = $state(getInitialCommonText("musicListFilterReset"));
  let musicListFilterApply = $state(getInitialCommonText("musicListFilterApply"));
  let musicListSortById = $state(getInitialCommonText("musicListSortById"));
  let musicListSortByPublishedAt = $state(getInitialCommonText("musicListSortByPublishedAt"));
  let musicListViewGrid = $state(getInitialCommonText("musicListViewGrid"));
  let musicListViewAgenda = $state(getInitialCommonText("musicListViewAgenda"));
  let musicListCreatorLabel = $state(getInitialCommonText("musicListCreatorLabel"));
  let musicJacketAltSuffix = $state(getInitialCommonText("musicJacketAltSuffix"));

  const getCategoryLabel = (category: string): string =>
    tCommon(data.uiLocale, `musicListCategory.${category}`, category);

  const hasFilters = (): boolean =>
    Boolean(
      nameFilter || categoryFilter.length || composerFilter || arrangerFilter || lyricistFilter
    );

  const syncDrafts = (): void => {
    nameDraft = nameFilter;
    categoryDraft = [...categoryFilter];
    composerDraft = composerFilter;
    arrangerDraft = arrangerFilter;
    lyricistDraft = lyricistFilter;
  };

  const getPreferenceKey = (): string => `content-site:music-list-filters:${data.region}`;
  const getViewKey = (): string => "content-site:music-list-view-mode";

  $effect(() => {
    const key = `${data.region}|${data.initialQuery.sortBy}|${data.initialQuery.sortOrder}|${data.initialQuery.name}|${data.initialQuery.categories}|${data.initialQuery.composer}|${data.initialQuery.arranger}|${data.initialQuery.lyricist}`;
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
    syncDrafts();
    errorMessage = data.initialLoadFailed ? musicListLoadFailed : null;
  });

  $effect(() => {
    const translate = createCommonTranslator(data.uiLocale, data.commonMessages);
    applyTranslations(translate);
    void refreshTranslations(data.uiLocale);
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
    if (spoilerContentAppliedState === showSpoilerContent) {
      return;
    }

    spoilerContentAppliedState = showSpoilerContent;
    const requestIncludesSpoilers =
      new URL(window.location.href).searchParams.get("spoiler") === "true";
    if (requestIncludesSpoilers !== showSpoilerContent) {
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
    musicListLoadFailed = translate("musicListLoadFailed");
    musicListLoadMore = translate("musicListLoadMore");
    musicListOpenFilters = translate("musicListOpenFilters");
    musicListFiltersTitle = translate("musicListFiltersTitle");
    musicListFilterNameLabel = translate("musicListFilterNameLabel");
    musicListFilterNamePlaceholder = translate("musicListFilterNamePlaceholder");
    musicListFilterCategoryLabel = translate("musicListFilterCategoryLabel");
    musicListComposerLabel = translate("musicListComposerLabel");
    musicListArrangerLabel = translate("musicListArrangerLabel");
    musicListLyricistLabel = translate("musicListLyricistLabel");
    musicListFilterReset = translate("musicListFilterReset");
    musicListFilterApply = translate("musicListFilterApply");
    musicListSortById = translate("musicListSortById");
    musicListSortByPublishedAt = translate("musicListSortByPublishedAt");
    musicListViewGrid = translate("musicListViewGrid");
    musicListViewAgenda = translate("musicListViewAgenda");
    musicListCreatorLabel = translate("musicListCreatorLabel");
    musicJacketAltSuffix = translate("musicJacketAltSuffix");
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
    params.set("spoiler", String(contentDisplaySettings.showSpoilerContent));
    if (nameFilter) params.set("name", nameFilter);
    categoryFilter.forEach((value) => params.append("category", value));
    if (composerFilter) params.set("composer", composerFilter);
    if (arrangerFilter) params.set("arranger", arrangerFilter);
    if (lyricistFilter) params.set("lyricist", lyricistFilter);
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
        lyricist: lyricistFilter
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

  const loadMore = async (): Promise<void> => {
    if (isLoading || !hasNext) return;
    isLoading = true;
    errorMessage = null;
    try {
      const nextPage = await fetchPage(currentPage + 1);
      items = [...items, ...nextPage.items];
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
  };

  const applyFilters = (): void => {
    nameFilter = nameDraft.trim();
    categoryFilter = categoryDraft;
    composerFilter = composerDraft;
    arrangerFilter = arrangerDraft;
    lyricistFilter = lyricistDraft;
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
          class={`btn join-item btn-sm ${sortBy === option.value ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          title={option.label}
          aria-label={option.label}
          onclick={() => toggleSort(option.value as MusicListSortBy)}
        >
          <Icon icon={option.icon} class="h-4 w-4" />
          {#if sortBy === option.value}
            <Icon icon={sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down"} class="h-4 w-4" />
          {/if}
        </button>
      {/each}
    </div>
    <div class="flex gap-2">
      <div class="join">
        <button
          type="button"
          class={`btn join-item btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          title={musicListViewGrid}
          onclick={() => setViewMode("grid")}
        >
          <Icon icon="mdi:view-grid-outline" class="h-4 w-4" />
        </button>
        <button
          type="button"
          class={`btn join-item btn-sm ${viewMode === "agenda" ? "btn-primary" : "btn-outline border-primary text-primary"}`}
          title={musicListViewAgenda}
          onclick={() => setViewMode("agenda")}
        >
          <Icon icon="mdi:view-agenda-outline" class="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        class={`btn btn-sm ${hasFilters() ? "btn-primary" : "btn-outline border-primary text-primary"}`}
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
      {#each items as item (item.id)}
        <MusicListCard
          region={data.region}
          {item}
          {viewMode}
          {idLabel}
          jacketAltSuffix={musicJacketAltSuffix}
          creatorLabel={musicListCreatorLabel}
          {getCategoryLabel}
        />
      {/each}
    </div>
    {#if items.length === 0 && !errorMessage}
      <p class="py-12 text-center text-sm opacity-70">{musicListEmpty}</p>
    {/if}
    {#if errorMessage}
      <div class="alert alert-error">{errorMessage}</div>
    {/if}
    {#if hasNext}
      <div class="flex justify-center py-5">
        <button
          type="button"
          class="btn btn-outline btn-sm"
          disabled={isLoading}
          onclick={() => void loadMore()}
        >
          {#if isLoading}<span class="loading loading-spinner loading-xs"></span>{/if}
          {musicListLoadMore}
        </button>
      </div>
    {:else if items.length > 0}
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
              class="btn btn-circle btn-ghost btn-xs absolute top-1/2 right-2 -translate-y-1/2"
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
              class={`btn btn-sm ${categoryDraft.includes(category) ? "btn-primary" : "btn-outline border-primary text-primary"}`}
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
      {#each [{ value: composerDraft, label: musicListComposerLabel, listId: "music-composers", options: data.filterMeta.composers, set: (value: string) => (composerDraft = value) }, { value: arrangerDraft, label: musicListArrangerLabel, listId: "music-arrangers", options: data.filterMeta.arrangers, set: (value: string) => (arrangerDraft = value) }, { value: lyricistDraft, label: musicListLyricistLabel, listId: "music-lyricists", options: data.filterMeta.lyricists, set: (value: string) => (lyricistDraft = value) }] as filter (filter.label)}
        <label class="form-control">
          <span class="label-text mb-1 text-sm font-medium">{filter.label}</span>
          <div class="relative">
            <input
              type="text"
              class="input input-bordered w-full pr-10"
              list={filter.listId}
              autocomplete="off"
              value={filter.value}
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
                class="btn btn-circle btn-ghost btn-xs absolute top-1/2 right-2 -translate-y-1/2"
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
      <button type="button" class="btn btn-outline" onclick={resetDrafts}
        >{musicListFilterReset}</button
      >
      <button type="button" class="btn btn-primary" onclick={applyFilters}
        >{musicListFilterApply}</button
      >
      <form method="dialog"><button type="submit" class="btn">{closeLabel}</button></form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button type="submit">{closeLabel}</button></form>
</dialog>
