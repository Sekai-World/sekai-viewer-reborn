<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import { getContentSiteCommonText, type SupportedRegion } from "@platform/i18n-dicts";
  import { AudioPlayer, ImagePreviewDialog, ImagePreviewTrigger } from "@platform/ui-shell";
  import {
    getEventBackgroundAssetURL,
    getEventBannerAssetURL,
    getEventBgmAssetURL,
    getEventCharacterAssetURL,
    getEventLogoAssetURL,
    getEventPointIconAssetURL
  } from "$lib/assets";
  import EventCountdownCard from "$lib/components/EventCountdownCard.svelte";
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
  let assetPreviewOpen = $state(false);
  let assetPreviewFormat = $state("");
  let homeLabel = $state(getContentSiteCommonText(initialLocale, "home"));
  let startAtLabel = $state(getContentSiteCommonText(initialLocale, "startAt"));
  let endAtLabel = $state(getContentSiteCommonText(initialLocale, "endAt"));
  let idLabel = $state(getContentSiteCommonText(initialLocale, "idLabel"));
  let nameLabel = $state(getContentSiteCommonText(initialLocale, "nameLabel"));
  let unitLabel = $state(getContentSiteCommonText(initialLocale, "unitLabel"));
  let eventTypeLabel = $state(getContentSiteCommonText(initialLocale, "eventTypeLabel"));
  let eventBgmTitle = $state(getContentSiteCommonText(initialLocale, "eventBgmTitle"));
  let audioPlayLabel = $state(getContentSiteCommonText(initialLocale, "audioPlayLabel"));
  let audioPauseLabel = $state(getContentSiteCommonText(initialLocale, "audioPauseLabel"));
  let audioDownloadLabel = $state(getContentSiteCommonText(initialLocale, "audioDownloadLabel"));
  let audioVolumeLabel = $state(getContentSiteCommonText(initialLocale, "audioVolumeLabel"));
  let audioSeekLabel = $state(getContentSiteCommonText(initialLocale, "audioSeekLabel"));
  let audioUnavailableLabel = $state(getContentSiteCommonText(initialLocale, "audioUnavailableLabel"));
  let audioDownloadStagePreparingLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadStages.preparing")
  );
  let audioDownloadStageFetchingAudioLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadStages.fetchingAudio")
  );
  let audioDownloadStageFetchingCoverLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadStages.fetchingCover")
  );
  let audioDownloadStageWritingMetadataLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadStages.writingMetadata")
  );
  let audioDownloadStageFinalizingLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadStages.finalizing")
  );
  let audioDownloadStageReadyLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadStages.ready")
  );
  let audioDownloadStageFailedLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadStages.failed")
  );
  let audioDownloadStageCancelledLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadStages.cancelled")
  );
  let audioDownloadCloseLabel = $state(
    getContentSiteCommonText(initialLocale, "audioDownloadCloseLabel")
  );
  let bannerAltSuffix = $state(getContentSiteCommonText(initialLocale, "bannerAltSuffix"));
  let imageUnavailableLabel = $state(getContentSiteCommonText(initialLocale, "imageUnavailable"));
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
    unitLabel = tCommon(locale, "unitLabel");
    eventTypeLabel = tCommon(locale, "eventTypeLabel");
    eventBgmTitle = tCommon(locale, "eventBgmTitle");
    audioPlayLabel = tCommon(locale, "audioPlayLabel");
    audioPauseLabel = tCommon(locale, "audioPauseLabel");
    audioDownloadLabel = tCommon(locale, "audioDownloadLabel");
    audioVolumeLabel = tCommon(locale, "audioVolumeLabel");
    audioSeekLabel = tCommon(locale, "audioSeekLabel");
    audioUnavailableLabel = tCommon(locale, "audioUnavailableLabel");
    audioDownloadStagePreparingLabel = tCommon(locale, "audioDownloadStages.preparing");
    audioDownloadStageFetchingAudioLabel = tCommon(locale, "audioDownloadStages.fetchingAudio");
    audioDownloadStageFetchingCoverLabel = tCommon(locale, "audioDownloadStages.fetchingCover");
    audioDownloadStageWritingMetadataLabel = tCommon(locale, "audioDownloadStages.writingMetadata");
    audioDownloadStageFinalizingLabel = tCommon(locale, "audioDownloadStages.finalizing");
    audioDownloadStageReadyLabel = tCommon(locale, "audioDownloadStages.ready");
    audioDownloadStageFailedLabel = tCommon(locale, "audioDownloadStages.failed");
    audioDownloadStageCancelledLabel = tCommon(locale, "audioDownloadStages.cancelled");
    audioDownloadCloseLabel = tCommon(locale, "audioDownloadCloseLabel");
    bannerAltSuffix = tCommon(locale, "bannerAltSuffix");
    imageUnavailableLabel = tCommon(locale, "imageUnavailable");
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

  const getSrcExtension = (value: string): string => {
    const match = value.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
    return match?.[1]?.toLowerCase() ?? "";
  };

  const replaceSrcExtension = (value: string, extension: string): string => {
    return value.replace(/(\.[a-z0-9]+)(?=([?#].*)?$)/i, `.${extension}`);
  };

  const assetPreviewFormatOptions = ["webp", "png"];
  const normalizedAssetPreviewFormatOptions = assetPreviewFormatOptions
    .map((format) => format.trim().toLowerCase())
    .filter(Boolean);
  const getResolvedAssetPreviewSrc = (src: string): string =>
    assetPreviewFormat && normalizedAssetPreviewFormatOptions.includes(assetPreviewFormat)
      ? replaceSrcExtension(src, assetPreviewFormat)
      : src;
  const openAssetPreview = (src: string): void => {
    if (!assetPreviewFormat) {
      assetPreviewFormat = getSrcExtension(src);
    }

    assetPreviewOpen = true;
  };

  const regionDisplayOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];
  const getRegionOptions = (availableRegions: SupportedRegion[]): SupportedRegion[] =>
    regionDisplayOrder.filter(
      (regionOption) => availableRegions.includes(regionOption) || regionOption === data.region
    );
  const hasAlternativeRegion = (availableRegions: SupportedRegion[]): boolean =>
    availableRegions.some((regionOption) => regionOption !== data.region);
  const getUnavailableError = (availableRegions: SupportedRegion[]): string =>
    hasAlternativeRegion(availableRegions)
      ? data.eventUnavailableInCurrentRegionMessage
      : data.failedToLoadEventDataMessage;
  const getEventBgmDownloadHref = (format: "mp3" | "wav"): string =>
    `${resolve("/event/[id]/bgm", { id: data.eventId })}?region=${encodeURIComponent(data.region)}&format=${encodeURIComponent(format)}`;
  const getEventBgmProgressHref = (): string =>
    `${resolve("/event/[id]/bgm/progress", { id: data.eventId })}?region=${encodeURIComponent(data.region)}`;
  const getAssetPreviewResetKey = (): string =>
    `${data.eventId}:${data.region}:${activeAssetTab}`;
  const eventTypeDisplayMap = {
    marathon: "Marathon",
    cheerful_carnival: "Cheerful Carnival",
    world_bloom: "World Link"
  } as const;
  const getEventTypeDisplay = (eventType: string | null): string | null => {
    if (!eventType) {
      return null;
    }

    return eventTypeDisplayMap[eventType as keyof typeof eventTypeDisplayMap] ?? eventType;
  };

  $effect(() => {
    getAssetPreviewResetKey();
    assetPreviewOpen = false;
    assetPreviewFormat = "";
  });

</script>

<svelte:head>
  {#await data.eventPayload}
    <title>{eventTitlePrefix} {data.eventId} - Sekai Viewer</title>
  {:then payload}
    <title>{payload.event ? `${payload.event.title} - Sekai Viewer` : `${eventTitlePrefix} ${data.eventId} - Sekai Viewer`}</title>
  {/await}
</svelte:head>

{#snippet assetPreview(src: string, alt: string, imageClass: string, fallbackLabel: string)}
  {@const resolvedSrc = getResolvedAssetPreviewSrc(src)}
  <ImagePreviewTrigger
    src={resolvedSrc}
    {alt}
    {fallbackLabel}
    ariaLabel={alt || closeLabel}
    buttonClass="block aspect-[16/10] w-full cursor-zoom-in overflow-hidden"
    {imageClass}
    onclick={() => {
      openAssetPreview(src);
    }}
  />
  <ImagePreviewDialog
    bind:open={assetPreviewOpen}
    src={resolvedSrc}
    {alt}
    {fallbackLabel}
    closeLabel={closeLabel}
    formatOptions={normalizedAssetPreviewFormatOptions}
    currentFormat={assetPreviewFormat}
    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
    onFormatChange={(format) => {
      assetPreviewFormat = format;
    }}
  />
{/snippet}

<section class="mx-auto flex w-full max-w-400 flex-col gap-4 px-4">
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
      <article class="card content-card-shell overflow-hidden shadow-sm">
        <div class="card-body gap-4 p-5">
          <div class="h-9 w-full animate-pulse rounded-xl bg-base-300"></div>
          <div class="h-60 w-full animate-pulse rounded-[1.75rem] bg-base-300"></div>
          <div class="space-y-2">
            <div class="h-4 w-full animate-pulse rounded bg-base-300"></div>
            <div class="h-4 w-2/3 animate-pulse rounded bg-base-300"></div>
          </div>
        </div>
      </article>
      <article class="card content-card-shell overflow-hidden shadow-sm">
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
        {#await data.availableRegions then availableRegions}
          {@const regionOptions = getRegionOptions(availableRegions)}
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
        {/await}
      </div>
    </div>

    {#if payload.error}
      <div class="alert alert-error">{payload.error}</div>
    {/if}

    {#if payload.event}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] md:items-start">
        <div class="flex flex-col gap-4">
          <article class="card content-card-shell overflow-hidden shadow-sm">
            <div class="card-body items-center gap-3 p-5 text-center">
              <div class="tabs tabs-box content-card-inset w-full p-1">
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
                    activeAssetTab === "banner"
                      ? "border-primary/45 bg-primary text-primary-content shadow-sm"
                      : "text-base-content/70 hover:bg-base-100/80"
                  }`}
                  onclick={() => {
                    activeAssetTab = "banner";
                  }}
                >
                  {bannerTabLabel}
                </button>
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
                    activeAssetTab === "title"
                      ? "border-primary/45 bg-primary text-primary-content shadow-sm"
                      : "text-base-content/70 hover:bg-base-100/80"
                  }`}
                  onclick={() => {
                    activeAssetTab = "title";
                  }}
                >
                  {titleTabLabel}
                </button>
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
                    activeAssetTab === "background"
                      ? "border-primary/45 bg-primary text-primary-content shadow-sm"
                      : "text-base-content/70 hover:bg-base-100/80"
                  }`}
                  onclick={() => {
                    activeAssetTab = "background";
                  }}
                >
                  {backgroundTabLabel}
                </button>
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
                    activeAssetTab === "characters"
                      ? "border-primary/45 bg-primary text-primary-content shadow-sm"
                      : "text-base-content/70 hover:bg-base-100/80"
                  }`}
                  onclick={() => {
                    activeAssetTab = "characters";
                  }}
                >
                  {charactersTabLabel}
                </button>
              </div>

              <div class="content-card-inset w-full overflow-hidden rounded-[1.75rem]">
                {#if activeAssetTab === "banner"}
                  {#if payload.event.assetBundleName}
                    {@render assetPreview(
                      getEventBannerAssetURL(payload.event.assetBundleName, data.region),
                      `${payload.event.title} ${bannerAltSuffix}`,
                      "h-full w-full object-contain p-4 md:p-6",
                      ""
                    )}
                  {:else}
                    <div class="flex aspect-16/10 items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else if activeAssetTab === "title"}
                  {#if payload.event.assetBundleName}
                    {@render assetPreview(
                      getEventLogoAssetURL(payload.event.assetBundleName, data.region),
                      payload.event.title,
                      "h-full w-full object-contain p-4 md:p-6",
                      ""
                    )}
                  {:else}
                    <div class="flex aspect-16/10 items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else if activeAssetTab === "background"}
                  {#if payload.event.assetBundleName}
                    {@render assetPreview(
                      getEventBackgroundAssetURL(payload.event.assetBundleName, data.region),
                      payload.event.title,
                      "h-full w-full object-cover",
                      ""
                    )}
                  {:else}
                    <div class="flex aspect-16/10 items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else}
                  {#if payload.event.assetBundleName}
                    {@render assetPreview(
                      getEventCharacterAssetURL(payload.event.assetBundleName, data.region),
                      payload.event.title,
                      "h-full w-full object-contain",
                      imageUnavailableLabel
                    )}
                  {:else}
                    <div class="flex aspect-16/10 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65">
                      <Icon
                        icon="mdi:file-remove-outline"
                        class="h-10 w-10 opacity-75"
                        aria-hidden="true"
                      />
                      <span class="font-medium">{imageUnavailableLabel}</span>
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          </article>

          <article class="card content-card-shell shadow-sm">
            <div class="card-body gap-4 p-5">
              <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
                  {eventInfoTitle}
                </p>
                <div class="flex items-center gap-1.5">
                  {#if payload.event.eventPointIcon}
                    <img
                      src={getEventPointIconAssetURL(payload.event.eventPointIcon, data.region)}
                      alt=""
                      aria-hidden="true"
                      class="h-6 w-6 shrink-0 object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  {/if}
                  <span class="badge badge-outline border-base-content/20 font-semibold">
                    {idLabel}: {payload.event.id}
                  </span>
                </div>
              </div>

              <dl class="space-y-2">
                <div class="content-card-inset rounded-xl px-4 py-3">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
                  <dd class="mt-1 text-sm font-medium">{payload.event.title}</dd>
                </div>
                {#if payload.event.unitName}
                  <div class="content-card-inset rounded-xl px-4 py-3">
                    <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{unitLabel}</dt>
                    <dd class="mt-1 text-sm font-medium">{payload.event.unitName}</dd>
                  </div>
                {/if}
                {#if payload.event.eventType}
                  <div class="content-card-inset rounded-xl px-4 py-3">
                    <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                      {eventTypeLabel}
                    </dt>
                    <dd class="mt-1 text-sm font-medium">
                      {getEventTypeDisplay(payload.event.eventType)}
                    </dd>
                  </div>
                {/if}
                <div class="content-card-inset rounded-xl px-4 py-3">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</dt>
                  <dd class="mt-1 text-sm font-medium">
                    {formatDisplayDateTime(payload.event.startAt, displayLocale)}
                  </dd>
                </div>
                <div class="content-card-inset rounded-xl px-4 py-3">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</dt>
                  <dd class="mt-1 text-sm font-medium">
                    {formatDisplayDateTime(payload.event.endAt, displayLocale)}
                  </dd>
                </div>
              </dl>
            </div>
          </article>

          {#await data.isCurrentEvent then isCurrentEvent}
            {#if isCurrentEvent}
              <article class="card content-card-shell shadow-sm">
                <div class="card-body p-5">
                  <EventCountdownCard
                    startAt={payload.event.startAt}
                    endAt={payload.event.endAt}
                    uiLocale={data.uiLocale}
                    forceShowSeconds={true}
                    showProgress={false}
                  />
                </div>
              </article>
            {/if}
          {/await}
        </div>

        <AudioPlayer
          src={
            payload.event.bgmAssetbundleName
              ? getEventBgmAssetURL(payload.event.bgmAssetbundleName, data.region)
              : null
          }
          label={eventBgmTitle}
          title={payload.event.title}
          subtitle={payload.event.unitName ?? ""}
          downloadName={`${payload.event.id}-${data.region}-event-bgm.mp3`}
          downloadOptions={[
            {
              label: "MP3",
              href: getEventBgmDownloadHref("mp3"),
              progressHref: getEventBgmProgressHref(),
              downloadName: `${payload.event.id}-${data.region}-event-bgm.mp3`
            },
            {
              label: "WAV",
              href: getEventBgmDownloadHref("wav"),
              progressHref: getEventBgmProgressHref(),
              downloadName: `${payload.event.id}-${data.region}-event-bgm.wav`
            }
          ]}
          downloadProgressMessages={{
            preparing: audioDownloadStagePreparingLabel,
            fetchingAudio: audioDownloadStageFetchingAudioLabel,
            fetchingCover: audioDownloadStageFetchingCoverLabel,
            writingMetadata: audioDownloadStageWritingMetadataLabel,
            finalizing: audioDownloadStageFinalizingLabel,
            ready: audioDownloadStageReadyLabel,
            failed: audioDownloadStageFailedLabel,
            cancelled: audioDownloadStageCancelledLabel
          }}
          playLabel={audioPlayLabel}
          pauseLabel={audioPauseLabel}
          downloadLabel={audioDownloadLabel}
          downloadCloseLabel={audioDownloadCloseLabel}
          volumeLabel={audioVolumeLabel}
          seekLabel={audioSeekLabel}
          unavailableLabel={audioUnavailableLabel}
        />
      </div>
    {:else if !payload.error}
      {#await data.availableRegions}
        <div class="alert">
          <span class="loading loading-spinner loading-sm"></span>
          {noEventLabel}
        </div>
      {:then availableRegions}
        <div class="alert alert-error">{getUnavailableError(availableRegions)}</div>
      {/await}
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
          <pre class="content-card-inset max-h-[70vh] overflow-auto rounded-xl p-4 text-xs leading-6"><code>{payload.debugEventJson}</code></pre>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="submit">{closeLabel}</button>
        </form>
      </dialog>
    {/if}
  {/await}
</section>
