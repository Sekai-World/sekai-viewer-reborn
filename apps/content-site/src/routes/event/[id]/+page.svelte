<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import { getContentSiteCommonText, type SupportedRegion } from "@platform/i18n-dicts";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import {
    getEventBackgroundAssetURL,
    getEventBannerAssetURL,
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
  const regionOptions = $derived<SupportedRegion[]>(
    regionDisplayOrder.filter(
      (regionOption) => data.availableRegions.includes(regionOption) || regionOption === data.region
    )
  );

</script>

<svelte:head>
  <title>{data.event ? `${data.event.title} - Sekai Viewer` : `${eventTitlePrefix} ${data.eventId} - Sekai Viewer`}</title>
</svelte:head>

<section class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4">
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <a class="btn btn-ghost btn-sm w-fit" href={resolve("/")}>← {homeLabel}</a>
    <div class="flex flex-wrap items-center gap-1.5 md:justify-end">
      {#if dev && data.debugEventJson}
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

  {#if data.error}
    <div class="alert alert-error">{data.error}</div>
  {/if}

  {#if data.event}
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
                {#if data.event.assetBundleName}
                  <div class="flex aspect-[16/10] items-center justify-center p-4 md:p-6">
                    <img
                      src={getEventBannerAssetURL(data.event.assetBundleName, data.region)}
                      alt={`${data.event.title} ${bannerAltSuffix}`}
                      class="h-auto max-h-full w-full object-contain"
                    />
                  </div>
                {:else}
                  <div class="flex aspect-[16/10] items-center justify-center px-6 text-center text-sm opacity-70">
                    {data.event.title}
                  </div>
                {/if}
              {:else if activeAssetTab === "title"}
                {#if data.event.assetBundleName}
                  <div class="flex aspect-[16/10] items-center justify-center p-4 md:p-6">
                    <img
                      src={getEventLogoAssetURL(data.event.assetBundleName, data.region)}
                      alt={data.event.title}
                      class="h-auto max-h-full w-full object-contain"
                    />
                  </div>
                {:else}
                  <div class="flex aspect-[16/10] items-center justify-center px-6 text-center text-sm opacity-70">
                    {data.event.title}
                  </div>
                {/if}
              {:else if activeAssetTab === "background"}
                {#if data.event.assetBundleName}
                  <ImagePreviewDialog
                    src={getEventBackgroundAssetURL(data.event.assetBundleName, data.region)}
                    alt={data.event.title}
                    closeLabel={closeLabel}
                    formatOptions={["webp", "png"]}
                    buttonClass="block aspect-[16/10] w-full cursor-zoom-in overflow-hidden"
                    imageClass="h-full w-full object-cover"
                    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
                  />
                {:else}
                  <div class="flex aspect-[16/10] items-center justify-center px-6 text-center text-sm opacity-70">
                    {data.event.title}
                  </div>
                {/if}
              {:else}
                <div class="relative aspect-[16/10] overflow-hidden">
                  {#if data.event.assetBundleName}
                    <img
                      src={getEventBannerAssetURL(data.event.assetBundleName, data.region)}
                      alt={`${data.event.title} ${bannerAltSuffix}`}
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div class="h-full w-full bg-[linear-gradient(135deg,rgba(0,0,0,0.05),rgba(0,0,0,0.18))]"></div>
                  {/if}
                  <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.35),rgba(0,0,0,0.08),rgba(0,0,0,0.35))]"></div>
                  <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 p-6 text-white md:p-8">
                    <h3 class="text-left text-xl font-semibold leading-tight md:text-3xl">{data.event.title}</h3>
                    <span class="badge badge-outline border-white/55 bg-black/20 font-semibold text-white">
                      {data.region.toUpperCase()}
                    </span>
                  </div>
                </div>
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
                <dd class="mt-1 text-sm font-medium">{data.event.id}</dd>
              </div>
              <div class="rounded-xl bg-base-200/45 px-4 py-3">
                <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
                <dd class="mt-1 text-sm font-medium">{data.event.title}</dd>
              </div>
              <div class="rounded-xl bg-base-200/45 px-4 py-3">
                <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</dt>
                <dd class="mt-1 text-sm font-medium">
                  {formatDisplayDateTime(data.event.startAt, displayLocale)}
                </dd>
              </div>
              <div class="rounded-xl bg-base-200/45 px-4 py-3">
                <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</dt>
                <dd class="mt-1 text-sm font-medium">
                  {formatDisplayDateTime(data.event.endAt, displayLocale)}
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
              <h2 class="mt-2 text-xl font-semibold leading-tight">{data.event.title}</h2>
            </div>
            <span class="badge badge-primary badge-lg border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
              {data.region.toUpperCase()}
            </span>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl bg-base-200/45 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{idLabel}</p>
              <p class="mt-2 text-lg font-semibold">{data.event.id}</p>
            </div>
            <div class="rounded-2xl bg-base-200/45 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</p>
              <p class="mt-2 text-lg font-semibold leading-tight">{data.event.title}</p>
            </div>
            <div class="rounded-2xl bg-base-200/45 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</p>
              <p class="mt-2 text-base font-medium">
                {formatDisplayDateTime(data.event.startAt, displayLocale)}
              </p>
            </div>
            <div class="rounded-2xl bg-base-200/45 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</p>
              <p class="mt-2 text-base font-medium">
                {formatDisplayDateTime(data.event.endAt, displayLocale)}
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
  {:else if !data.error}
    <div class="alert">{noEventLabel}</div>
  {/if}

  {#if dev && data.debugEventJson}
    <dialog bind:this={debugDialog} class="modal">
      <div class="modal-box max-w-5xl">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold">{debugEventJsonTitle}</h3>
          <form method="dialog">
            <button type="submit" class="btn btn-sm btn-ghost">{closeLabel}</button>
          </form>
        </div>
        <pre class="max-h-[70vh] overflow-auto rounded-xl bg-base-200/55 p-4 text-xs leading-6"><code>{data.debugEventJson}</code></pre>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">{closeLabel}</button>
      </form>
    </dialog>
  {/if}
</section>
