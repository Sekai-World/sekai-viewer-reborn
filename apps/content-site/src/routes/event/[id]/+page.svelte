<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import { getContentSiteCommonText, type SupportedRegion } from "@platform/i18n-dicts";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import {
    getEventBackgroundAssetURL,
    getEventBannerAssetURL,
    getEventCharacterAssetURL,
    getEventLogoAssetURL
  } from "$lib/assets";
  import { formatDisplayDateTime } from "$lib/date-time";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { DEFAULT_UI_LOCALE } from "$lib/region";
  import type { PageData } from "./$types";

  type EventAssetTab = "banner" | "title" | "background" | "characters";

  let { data }: { data: PageData } = $props();
  let debugDialog: HTMLDialogElement | null = $state(null);
  const initialLocale = DEFAULT_UI_LOCALE;
  let displayLocale = $state<string>(initialLocale);
  let activeAssetTab = $state<EventAssetTab>("banner");
  let homeLabel = $state(getContentSiteCommonText(initialLocale, "home"));
  let startAtLabel = $state(getContentSiteCommonText(initialLocale, "startAt"));
  let endAtLabel = $state(getContentSiteCommonText(initialLocale, "endAt"));
  let idLabel = $state(getContentSiteCommonText(initialLocale, "idLabel"));
  let nameLabel = $state(getContentSiteCommonText(initialLocale, "nameLabel"));
  let bannerAltSuffix = $state(getContentSiteCommonText(initialLocale, "bannerAltSuffix"));
  let noEventLabel = $state(getContentSiteCommonText(initialLocale, "noCurrentEventData"));
  let eventTitlePrefix = $state(getContentSiteCommonText(initialLocale, "pageTitle.eventPrefix"));
  let bannerTabLabel = $state(getContentSiteCommonText(initialLocale, "eventAssetTabs.banner"));
  let titleTabLabel = $state(getContentSiteCommonText(initialLocale, "eventAssetTabs.title"));
  let backgroundTabLabel = $state(
    getContentSiteCommonText(initialLocale, "eventAssetTabs.background")
  );
  let charactersTabLabel = $state(
    getContentSiteCommonText(initialLocale, "eventAssetTabs.characters")
  );
  let eventInfoTitle = $state(getContentSiteCommonText(initialLocale, "eventInfoTitle"));
  let debugEventJsonButtonLabel = $state(
    getContentSiteCommonText(initialLocale, "debugEventJsonButton")
  );
  let debugEventJsonTitle = $state(getContentSiteCommonText(initialLocale, "debugEventJsonTitle"));
  let closeLabel = $state(getContentSiteCommonText(initialLocale, "closeLabel"));

  $effect(() => {
    displayLocale = data.uiLocale;
    applyTranslations(data.uiLocale);
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    void refreshTranslations(data.uiLocale);
  });

  const applyTranslations = (localeValue: string): void => {
    const locale = localeValue;
    homeLabel = tCommon(locale, "home");
    startAtLabel = tCommon(locale, "startAt");
    endAtLabel = tCommon(locale, "endAt");
    idLabel = tCommon(locale, "idLabel");
    nameLabel = tCommon(locale, "nameLabel");
    bannerAltSuffix = tCommon(locale, "bannerAltSuffix");
    noEventLabel = tCommon(locale, "noCurrentEventData");
    eventTitlePrefix = tCommon(locale, "pageTitle.eventPrefix");
    bannerTabLabel = tCommon(locale, "eventAssetTabs.banner");
    titleTabLabel = tCommon(locale, "eventAssetTabs.title");
    backgroundTabLabel = tCommon(locale, "eventAssetTabs.background");
    charactersTabLabel = tCommon(locale, "eventAssetTabs.characters");
    eventInfoTitle = tCommon(locale, "eventInfoTitle");
    debugEventJsonButtonLabel = tCommon(locale, "debugEventJsonButton");
    debugEventJsonTitle = tCommon(locale, "debugEventJsonTitle");
    closeLabel = tCommon(locale, "closeLabel");
  };

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    applyTranslations(locale);
  };

  const openDebugDialog = (): void => {
    debugDialog?.showModal();
  };

  const regionDisplayOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];
  const getRegionOptions = (availableRegions: SupportedRegion[]): SupportedRegion[] =>
    regionDisplayOrder.filter(
      (regionOption) => availableRegions.includes(regionOption) || regionOption === data.region
    );

</script>

<svelte:head>
  {#await data.eventPayload}
    <title>{eventTitlePrefix} {data.eventId} - Sekai Viewer</title>
  {:then payload}
    <title>{payload.event ? `${payload.event.title} - Sekai Viewer` : `${eventTitlePrefix} ${data.eventId} - Sekai Viewer`}</title>
  {/await}
</svelte:head>

<section class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4">
  {#await data.eventPayload}
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <a class="btn btn-ghost btn-sm w-fit" href={resolve("/")}>← {homeLabel}</a>
      <div class="flex flex-wrap items-center gap-1.5 md:justify-end">
        <span class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
          {data.region.toUpperCase()}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] md:items-start">
      <article class="card overflow-hidden border border-base-content/10 bg-base-100 shadow-sm">
        <div class="card-body gap-4 p-5">
          <div class="h-9 w-full animate-pulse rounded-xl bg-base-300"></div>
          <div class="h-[240px] w-full animate-pulse rounded-[1.75rem] bg-base-300"></div>
          <div class="space-y-2">
            <div class="h-4 w-full animate-pulse rounded bg-base-300"></div>
            <div class="h-4 w-2/3 animate-pulse rounded bg-base-300"></div>
          </div>
        </div>
      </article>
      <article class="card overflow-hidden border border-base-content/10 bg-base-100 shadow-sm">
        <div class="card-body gap-3 p-5">
          <div class="h-5 w-1/3 animate-pulse rounded bg-base-300"></div>
          <div class="h-10 w-2/3 animate-pulse rounded bg-base-300"></div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="h-20 animate-pulse rounded-2xl bg-base-300"></div>
            <div class="h-20 animate-pulse rounded-2xl bg-base-300"></div>
            <div class="h-20 animate-pulse rounded-2xl bg-base-300"></div>
            <div class="h-20 animate-pulse rounded-2xl bg-base-300"></div>
          </div>
        </div>
      </article>
    </div>
  {:then payload}
    {@const regionOptions = getRegionOptions(payload.availableRegions)}
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <a class="btn btn-ghost btn-sm w-fit" href={resolve("/")}>← {homeLabel}</a>
      <div class="flex flex-wrap items-center gap-1.5 md:justify-end">
        {#if dev && payload.debugEventJson}
          <button
            type="button"
            class="btn btn-outline btn-sm"
            onclick={openDebugDialog}
          >
            {debugEventJsonButtonLabel}
          </button>
        {/if}
        {#each regionOptions as regionOption (regionOption)}
          {#if regionOption === data.region}
            <span class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
              {regionOption.toUpperCase()}
            </span>
          {:else}
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a
              href={`${resolve("/event/[id]", { id: data.eventId })}?region=${encodeURIComponent(regionOption)}`}
              class="badge badge-primary badge-outline border-primary/55 bg-base-100/88 font-semibold"
            >
              {regionOption.toUpperCase()}
            </a>
          {/if}
        {/each}
      </div>
    </div>

    {#if payload.error}
      <div class="alert alert-error">{payload.error}</div>
    {/if}

    {#if payload.event}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] md:items-start">
        <div class="flex flex-col gap-4">
          <article class="card overflow-hidden border border-base-content/10 bg-base-100 shadow-sm">
            <div class="card-body items-center gap-4 p-5 text-center">
              <div class="tabs tabs-box w-full border border-base-content/10 bg-base-200/45 p-1">
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl font-semibold ${activeAssetTab === "banner" ? "tab-active" : ""}`}
                  onclick={() => {
                    activeAssetTab = "banner";
                  }}
                >
                  {bannerTabLabel}
                </button>
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl font-semibold ${activeAssetTab === "title" ? "tab-active" : ""}`}
                  onclick={() => {
                    activeAssetTab = "title";
                  }}
                >
                  {titleTabLabel}
                </button>
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl font-semibold ${activeAssetTab === "background" ? "tab-active" : ""}`}
                  onclick={() => {
                    activeAssetTab = "background";
                  }}
                >
                  {backgroundTabLabel}
                </button>
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl font-semibold ${activeAssetTab === "characters" ? "tab-active" : ""}`}
                  onclick={() => {
                    activeAssetTab = "characters";
                  }}
                >
                  {charactersTabLabel}
                </button>
              </div>

              <div class="w-full overflow-hidden rounded-[1.75rem] bg-base-200/55">
                {#if activeAssetTab === "banner"}
                  {#if payload.event.assetBundleName}
                    <ImagePreviewDialog
                      src={getEventBannerAssetURL(payload.event.assetBundleName, data.region)}
                      alt={`${payload.event.title} ${bannerAltSuffix}`}
                      closeLabel={closeLabel}
                      formatOptions={["webp", "png"]}
                      buttonClass="block aspect-[16/10] w-full cursor-zoom-in overflow-hidden"
                      imageClass="h-full w-full object-contain p-4 md:p-6"
                      dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
                    />
                  {:else}
                    <div class="flex aspect-[16/10] items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else if activeAssetTab === "title"}
                  {#if payload.event.assetBundleName}
                    <ImagePreviewDialog
                      src={getEventLogoAssetURL(payload.event.assetBundleName, data.region)}
                      alt={payload.event.title}
                      closeLabel={closeLabel}
                      formatOptions={["webp", "png"]}
                      buttonClass="block aspect-[16/10] w-full cursor-zoom-in overflow-hidden"
                      imageClass="h-full w-full object-contain p-4 md:p-6"
                      dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
                    />
                  {:else}
                    <div class="flex aspect-[16/10] items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else if activeAssetTab === "background"}
                  {#if payload.event.assetBundleName}
                    <ImagePreviewDialog
                      src={getEventBackgroundAssetURL(payload.event.assetBundleName, data.region)}
                      alt={payload.event.title}
                      closeLabel={closeLabel}
                      formatOptions={["webp", "png"]}
                      buttonClass="block aspect-[16/10] w-full cursor-zoom-in overflow-hidden"
                      imageClass="h-full w-full object-cover"
                      dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
                    />
                  {:else}
                    <div class="flex aspect-[16/10] items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else}
                  {#if payload.event.assetBundleName}
                    <ImagePreviewDialog
                      src={getEventCharacterAssetURL(payload.event.assetBundleName, data.region)}
                      alt={payload.event.title}
                      closeLabel={closeLabel}
                      formatOptions={["webp", "png"]}
                      buttonClass="block aspect-[16/10] w-full cursor-zoom-in overflow-hidden"
                      imageClass="h-full w-full object-contain"
                      dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
                    />
                  {:else}
                    <div class="flex aspect-[16/10] items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          </article>

          <article class="card border border-base-content/10 bg-base-100 shadow-sm">
            <div class="card-body gap-4 p-5">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
                  {eventInfoTitle}
                </p>
              </div>

              <dl class="space-y-3">
                <div class="rounded-xl bg-base-200/45 px-4 py-3">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{idLabel}</dt>
                  <dd class="mt-1 text-sm font-medium">{payload.event.id}</dd>
                </div>
                <div class="rounded-xl bg-base-200/45 px-4 py-3">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
                  <dd class="mt-1 text-sm font-medium">{payload.event.title}</dd>
                </div>
                <div class="rounded-xl bg-base-200/45 px-4 py-3">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</dt>
                  <dd class="mt-1 text-sm font-medium">
                    {formatDisplayDateTime(payload.event.startAt, displayLocale)}
                  </dd>
                </div>
                <div class="rounded-xl bg-base-200/45 px-4 py-3">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</dt>
                  <dd class="mt-1 text-sm font-medium">
                    {formatDisplayDateTime(payload.event.endAt, displayLocale)}
                  </dd>
                </div>
              </dl>
            </div>
          </article>
        </div>

        <article class="card overflow-hidden border border-base-content/10 bg-base-100 shadow-sm">
          <div class="card-body gap-5 p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
                  {data.regionLabel}
                </p>
                <h2 class="mt-2 text-xl font-semibold leading-tight">{payload.event.title}</h2>
              </div>
              <span class="badge badge-primary badge-lg border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
                {data.region.toUpperCase()}
              </span>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-base-200/45 px-4 py-4">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{idLabel}</p>
                <p class="mt-2 text-lg font-semibold">{payload.event.id}</p>
              </div>
              <div class="rounded-2xl bg-base-200/45 px-4 py-4">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</p>
                <p class="mt-2 text-lg font-semibold leading-tight">{payload.event.title}</p>
              </div>
              <div class="rounded-2xl bg-base-200/45 px-4 py-4">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</p>
                <p class="mt-2 text-base font-medium">
                  {formatDisplayDateTime(payload.event.startAt, displayLocale)}
                </p>
              </div>
              <div class="rounded-2xl bg-base-200/45 px-4 py-4">
                <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</p>
                <p class="mt-2 text-base font-medium">
                  {formatDisplayDateTime(payload.event.endAt, displayLocale)}
                </p>
              </div>
            </div>

            <div class="rounded-[1.75rem] border border-base-content/10 bg-base-200/35 p-5">
              <div class="flex flex-wrap gap-1.5">
                {#each regionOptions as regionOption (regionOption)}
                  {#if regionOption === data.region}
                    <span class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
                      {regionOption.toUpperCase()}
                    </span>
                  {:else}
                    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                    <a
                      href={`${resolve("/event/[id]", { id: data.eventId })}?region=${encodeURIComponent(regionOption)}`}
                      class="badge badge-outline font-semibold"
                    >
                      {regionOption.toUpperCase()}
                    </a>
                  {/if}
                {/each}
              </div>
            </div>
          </div>
        </article>
      </div>
    {:else if !payload.error}
      <div class="alert">{noEventLabel}</div>
    {/if}

    {#if dev && payload.debugEventJson}
      <dialog bind:this={debugDialog} class="modal">
        <div class="modal-box max-w-5xl">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold">{debugEventJsonTitle}</h3>
            <form method="dialog">
              <button type="submit" class="btn btn-sm btn-ghost">{closeLabel}</button>
            </form>
          </div>
          <pre class="max-h-[70vh] overflow-auto rounded-xl bg-base-200/55 p-4 text-xs leading-6"><code>{payload.debugEventJson}</code></pre>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="submit">{closeLabel}</button>
        </form>
      </dialog>
    {/if}
  {/await}
</section>
