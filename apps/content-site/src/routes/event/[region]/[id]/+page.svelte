<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import type { SupportedRegion } from "$lib/regions";
  import { AudioPlayer, ImagePreviewDialog } from "@platform/ui-shell";
  import {
    getEventBackgroundAssetURL,
    getEventBannerAssetURL,
    getEventBgmAssetURL,
    getEventCharacterAssetURL,
    getEventLogoAssetURL,
    getEventPointIconAssetURL
  } from "$lib/assets";
  import EventCountdownCard from "$lib/components/EventCountdownCard.svelte";
  import EventAssetImage from "$lib/components/EventAssetImage.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RegionBadgeSwitch, { type RegionBadgeOption } from "$lib/components/RegionBadgeSwitch.svelte";
  import { formatDisplayDateTime } from "$lib/date-time";
  import { getEventTypeDisplay } from "$lib/event";
  import { createCommonTranslator, setI18nLocale, tCommon } from "$lib/i18n";
  import type { PageData } from "./$types";

  type EventAssetTab = "banner" | "title" | "background" | "characters";

  let { data }: { data: PageData } = $props();
  const getInitialCommonText = (key: string): string =>
    createCommonTranslator(data.uiLocale, data.commonMessages)(key);
  let debugDialog: HTMLDialogElement | null = $state(null);
  let displayLocale = $state<string>("");
  let activeAssetTab = $state<EventAssetTab>("banner");
  let assetPreviewOpen = $state(false);
  let assetPreviewFormat = $state("");
  let homeLabel = $state(getInitialCommonText("home"));
  let eventListTitle = $state(getInitialCommonText("eventListTitle"));
  let startAtLabel = $state(getInitialCommonText("startAt"));
  let endAtLabel = $state(getInitialCommonText("endAt"));
  let idLabel = $state(getInitialCommonText("idLabel"));
  let nameLabel = $state(getInitialCommonText("nameLabel"));
  let unitLabel = $state(getInitialCommonText("unitLabel"));
  let mixedUnitLabel = $state(getInitialCommonText("mixedUnitLabel"));
  let eventTypeLabel = $state(getInitialCommonText("eventTypeLabel"));
  let eventBgmTitle = $state(getInitialCommonText("eventBgmTitle"));
  let audioPlayLabel = $state(getInitialCommonText("audioPlayLabel"));
  let audioPauseLabel = $state(getInitialCommonText("audioPauseLabel"));
  let audioDownloadLabel = $state(getInitialCommonText("audioDownloadLabel"));
  let audioVolumeLabel = $state(getInitialCommonText("audioVolumeLabel"));
  let audioSeekLabel = $state(getInitialCommonText("audioSeekLabel"));
  let audioUnavailableLabel = $state(getInitialCommonText("audioUnavailableLabel"));
  let audioDownloadStagePreparingLabel = $state(
    getInitialCommonText("audioDownloadStages.preparing")
  );
  let audioDownloadStageFetchingAudioLabel = $state(
    getInitialCommonText("audioDownloadStages.fetchingAudio")
  );
  let audioDownloadStageFetchingCoverLabel = $state(
    getInitialCommonText("audioDownloadStages.fetchingCover")
  );
  let audioDownloadStageWritingMetadataLabel = $state(
    getInitialCommonText("audioDownloadStages.writingMetadata")
  );
  let audioDownloadStageFinalizingLabel = $state(
    getInitialCommonText("audioDownloadStages.finalizing")
  );
  let audioDownloadStageReadyLabel = $state(getInitialCommonText("audioDownloadStages.ready"));
  let audioDownloadStageFailedLabel = $state(getInitialCommonText("audioDownloadStages.failed"));
  let audioDownloadStageCancelledLabel = $state(
    getInitialCommonText("audioDownloadStages.cancelled")
  );
  let audioDownloadCloseLabel = $state(getInitialCommonText("audioDownloadCloseLabel"));
  let bannerAltSuffix = $state(getInitialCommonText("bannerAltSuffix"));
  let imageUnavailableLabel = $state(getInitialCommonText("imageUnavailable"));
  let noEventLabel = $state(getInitialCommonText("noCurrentEventData"));
  let eventTitlePrefix = $state(getInitialCommonText("pageTitle.eventPrefix"));
  let bannerTabLabel = $state(getInitialCommonText("eventAssetTabs.banner"));
  let titleTabLabel = $state(getInitialCommonText("eventAssetTabs.title"));
  let backgroundTabLabel = $state(getInitialCommonText("eventAssetTabs.background"));
  let charactersTabLabel = $state(getInitialCommonText("eventAssetTabs.characters"));
  let eventInfoTitle = $state(getInitialCommonText("eventInfoTitle"));
  let eventCountdownTitle = $state(getInitialCommonText("eventCountdownTitle"));
  let debugEventJsonButtonLabel = $state(getInitialCommonText("debugEventJsonButton"));
  let debugEventJsonTitle = $state(getInitialCommonText("debugEventJsonTitle"));
  let closeLabel = $state(getInitialCommonText("closeLabel"));

  $effect(() => {
    displayLocale = data.uiLocale;
    const translate = createCommonTranslator(data.uiLocale, data.commonMessages);
    applyTranslations(translate);
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    void refreshTranslations(data.uiLocale);
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    eventListTitle = translate("eventListTitle");
    startAtLabel = translate("startAt");
    endAtLabel = translate("endAt");
    idLabel = translate("idLabel");
    nameLabel = translate("nameLabel");
    unitLabel = translate("unitLabel");
    mixedUnitLabel = translate("mixedUnitLabel");
    eventTypeLabel = translate("eventTypeLabel");
    eventBgmTitle = translate("eventBgmTitle");
    audioPlayLabel = translate("audioPlayLabel");
    audioPauseLabel = translate("audioPauseLabel");
    audioDownloadLabel = translate("audioDownloadLabel");
    audioVolumeLabel = translate("audioVolumeLabel");
    audioSeekLabel = translate("audioSeekLabel");
    audioUnavailableLabel = translate("audioUnavailableLabel");
    audioDownloadStagePreparingLabel = translate("audioDownloadStages.preparing");
    audioDownloadStageFetchingAudioLabel = translate("audioDownloadStages.fetchingAudio");
    audioDownloadStageFetchingCoverLabel = translate("audioDownloadStages.fetchingCover");
    audioDownloadStageWritingMetadataLabel = translate("audioDownloadStages.writingMetadata");
    audioDownloadStageFinalizingLabel = translate("audioDownloadStages.finalizing");
    audioDownloadStageReadyLabel = translate("audioDownloadStages.ready");
    audioDownloadStageFailedLabel = translate("audioDownloadStages.failed");
    audioDownloadStageCancelledLabel = translate("audioDownloadStages.cancelled");
    audioDownloadCloseLabel = translate("audioDownloadCloseLabel");
    bannerAltSuffix = translate("bannerAltSuffix");
    imageUnavailableLabel = translate("imageUnavailable");
    noEventLabel = translate("noCurrentEventData");
    eventTitlePrefix = translate("pageTitle.eventPrefix");
    bannerTabLabel = translate("eventAssetTabs.banner");
    titleTabLabel = translate("eventAssetTabs.title");
    backgroundTabLabel = translate("eventAssetTabs.background");
    charactersTabLabel = translate("eventAssetTabs.characters");
    eventInfoTitle = translate("eventInfoTitle");
    eventCountdownTitle = translate("eventCountdownTitle");
    debugEventJsonButtonLabel = translate("debugEventJsonButton");
    debugEventJsonTitle = translate("debugEventJsonTitle");
    closeLabel = translate("closeLabel");
  };

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, data.commonMessages);
    applyTranslations((key) => tCommon(locale, key));
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
    `${resolve("/event/[region]/[id]/bgm", { region: data.region, id: data.eventId })}?format=${encodeURIComponent(format)}`;
  const getEventBgmProgressHref = (): string =>
    resolve("/event/[region]/[id]/bgm/progress", { region: data.region, id: data.eventId });
  const getEventListHref = (): string => resolve("/events/[region]", { region: data.region });
  const getEventBreadcrumbItems = (currentLabel: string) => [
    {
      label: homeLabel,
      href: resolve("/")
    },
    {
      label: eventListTitle,
      href: getEventListHref()
    },
    {
      label: currentLabel
    }
  ];
  const getRegionBadgeOptions = (regionOptions: SupportedRegion[]): RegionBadgeOption[] =>
    regionOptions.map((regionOption) => ({
      key: regionOption,
      label: regionOption.toUpperCase(),
      href:
        regionOption === data.region
          ? undefined
          : resolve("/event/[region]/[id]", { region: regionOption, id: data.eventId }),
      active: regionOption === data.region
    }));
  const getCurrentRegionBadgeOption = (): RegionBadgeOption[] => [
    {
      key: data.region,
      label: data.region.toUpperCase(),
      active: true
    }
  ];
  const toTimestampMs = (value: string | number | null): number | null => {
    if (value === null) {
      return null;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return null;
      }

      return value > 1e12 ? value : value * 1000;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (/^\d+$/.test(normalized)) {
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) {
        return null;
      }

      return parsed > 1e12 ? parsed : parsed * 1000;
    }

    const dateValue = new Date(normalized).getTime();
    return Number.isNaN(dateValue) ? null : dateValue;
  };
  const isEventEnded = (endAtValue: string | number | null): boolean => {
    const endAtMs = toTimestampMs(endAtValue);
    return endAtMs !== null && Date.now() >= endAtMs;
  };
  const getDisplayUnitName = (unitName: string | null | undefined): string | null => {
    if (!unitName) {
      return null;
    }

    return unitName.trim().toLowerCase() === "none" ? mixedUnitLabel : unitName;
  };
  const isWorldLinkEvent = (eventType: string | null | undefined): boolean =>
    eventType === "world_bloom";
  const shouldShowCharacterAssetTab = (eventType: string | null | undefined): boolean =>
    !isWorldLinkEvent(eventType);
  const getResolvedAssetTab = (eventType: string | null | undefined): EventAssetTab =>
    isWorldLinkEvent(eventType) && activeAssetTab === "characters" ? "banner" : activeAssetTab;
  const isCompactAssetTab = (tab: EventAssetTab): boolean => tab === "banner" || tab === "title";
  const getAssetPreviewResetKey = (): string =>
    `${data.eventId}:${data.region}:${activeAssetTab}`;

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

{#snippet assetPreview(src: string, alt: string, imageClass: string, fallbackLabel: string, buttonClass: string)}
  {@const resolvedSrc = getResolvedAssetPreviewSrc(src)}
  <EventAssetImage
    src={resolvedSrc}
    {alt}
    {fallbackLabel}
    {buttonClass}
    interactive={true}
    imageClass={imageClass}
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
    onFormatChange={(format: string) => {
      assetPreviewFormat = format;
    }}
  />
{/snippet}

<section class="mx-auto flex w-full max-w-400 flex-col gap-4 px-4">
  {#await data.eventPayload}
    <PageHeader
      breadcrumbs={getEventBreadcrumbItems(`${eventTitlePrefix} ${data.eventId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        <RegionBadgeSwitch options={getCurrentRegionBadgeOption()} />
      {/snippet}
    </PageHeader>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
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
    <PageHeader
      breadcrumbs={getEventBreadcrumbItems(payload.event?.title ?? `${eventTitlePrefix} ${data.eventId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
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
          <RegionBadgeSwitch options={getRegionBadgeOptions(getRegionOptions(availableRegions))} />
        {/await}
      {/snippet}
    </PageHeader>

    {#if payload.error}
      <div class="alert alert-error">{payload.error}</div>
    {/if}

    {#if payload.event}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <div class="flex flex-col gap-4">
          <article class="card content-card-shell overflow-hidden shadow-sm">
            <div class="card-body items-center gap-3 p-5 text-center">
              <div class="tabs tabs-box content-card-inset w-full p-1">
                <button
                  type="button"
                  class={`tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
                    getResolvedAssetTab(payload.event.eventType) === "banner"
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
                    getResolvedAssetTab(payload.event.eventType) === "title"
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
                    getResolvedAssetTab(payload.event.eventType) === "background"
                      ? "border-primary/45 bg-primary text-primary-content shadow-sm"
                      : "text-base-content/70 hover:bg-base-100/80"
                  }`}
                  onclick={() => {
                    activeAssetTab = "background";
                  }}
                >
                  {backgroundTabLabel}
                </button>
                {#if shouldShowCharacterAssetTab(payload.event.eventType)}
                  <button
                    type="button"
                    class={`tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
                      getResolvedAssetTab(payload.event.eventType) === "characters"
                        ? "border-primary/45 bg-primary text-primary-content shadow-sm"
                        : "text-base-content/70 hover:bg-base-100/80"
                    }`}
                    onclick={() => {
                      activeAssetTab = "characters";
                    }}
                  >
                    {charactersTabLabel}
                  </button>
                {/if}
              </div>

              <div
                class={`content-card-inset w-full overflow-hidden rounded-[1.75rem] transition-[aspect-ratio] duration-300 ease-out ${
                  isCompactAssetTab(getResolvedAssetTab(payload.event.eventType)) ? "aspect-[16/7]" : "aspect-[16/10]"
                }`}
              >
                {#if getResolvedAssetTab(payload.event.eventType) === "banner"}
                  {#if payload.event.assetBundleName}
                    {@render assetPreview(
                      getEventBannerAssetURL(payload.event.assetBundleName, data.region),
                      `${payload.event.title} ${bannerAltSuffix}`,
                      "h-full w-full object-contain p-4 md:p-6",
                      "",
                      "block h-full w-full cursor-zoom-in overflow-hidden"
                    )}
                  {:else}
                    <div class="flex h-full items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else if getResolvedAssetTab(payload.event.eventType) === "title"}
                  {#if payload.event.assetBundleName}
                    {@render assetPreview(
                      getEventLogoAssetURL(payload.event.assetBundleName, data.region),
                      payload.event.title,
                      "h-full w-full object-contain p-4 md:p-6",
                      "",
                      "block h-full w-full cursor-zoom-in overflow-hidden"
                    )}
                  {:else}
                    <div class="flex h-full items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else if getResolvedAssetTab(payload.event.eventType) === "background"}
                  {#if payload.event.assetBundleName}
                    {@render assetPreview(
                      getEventBackgroundAssetURL(payload.event.assetBundleName, data.region),
                      payload.event.title,
                      "h-full w-full object-cover",
                      "",
                      "block h-full w-full cursor-zoom-in overflow-hidden"
                    )}
                  {:else}
                    <div class="flex h-full items-center justify-center px-6 text-center text-sm opacity-70">
                      {payload.event.title}
                    </div>
                  {/if}
                {:else}
                  {#if payload.event.assetBundleName}
                    {@render assetPreview(
                      getEventCharacterAssetURL(payload.event.assetBundleName, data.region),
                      payload.event.title,
                      "h-full w-full object-contain",
                      imageUnavailableLabel,
                      "block h-full w-full cursor-zoom-in overflow-hidden"
                    )}
                  {:else}
                    <div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65">
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
                <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
                  <Icon icon="mdi:information-outline" class="h-4 w-4 shrink-0 translate-y-[0.5px]" aria-hidden="true" />
                  <span>{eventInfoTitle}</span>
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
                    {idLabel}{payload.event.id}
                  </span>
                </div>
              </div>

              <dl class="space-y-2">
                <div class="content-card-inset rounded-xl px-4 py-3">
                  <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
                  <dd class="mt-1 text-sm font-medium">{payload.event.title}</dd>
                </div>
                {#if getDisplayUnitName(payload.event.unitName)}
                  <div class="content-card-inset rounded-xl px-4 py-3">
                    <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{unitLabel}</dt>
                    <dd class="mt-1 text-sm font-medium">{getDisplayUnitName(payload.event.unitName)}</dd>
                  </div>
                {/if}
                {#if payload.event.eventType}
                  <div class="content-card-inset rounded-xl px-4 py-3">
                    <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                      {eventTypeLabel}
                    </dt>
                    <dd class="mt-1 text-sm font-medium">
                      {getEventTypeDisplay(payload.event.eventType, data.uiLocale)}
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
            {#if isCurrentEvent && !isEventEnded(payload.event.endAt)}
              <article class="card content-card-shell shadow-sm">
                <div class="card-body gap-4 p-5">
                  <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
                    <Icon icon="mdi:timer-sand" class="h-4 w-4 shrink-0 translate-y-[0.5px]" aria-hidden="true" />
                    <span>{eventCountdownTitle}</span>
                  </p>
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

        <article class="card content-card-shell overflow-hidden shadow-sm">
          <div class="card-body gap-4 p-5">
            <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
              <Icon icon="mdi:music-note-outline" class="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{eventBgmTitle}</span>
            </p>
            <div class="content-card-inset rounded-[1.75rem] p-4">
            <AudioPlayer
              src={
                payload.event.bgmAssetbundleName
                  ? getEventBgmAssetURL(payload.event.bgmAssetbundleName, data.region)
                  : null
              }
              title={payload.event.title}
              subtitle={getDisplayUnitName(payload.event.unitName) ?? ""}
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
          </div>
        </article>
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
