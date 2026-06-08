<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/regions";
  import EventDebugDialog from "$lib/components/EventDebugDialog.svelte";
  import EventDetailAssetCard from "$lib/components/EventDetailAssetCard.svelte";
  import EventDetailBgmCard from "$lib/components/EventDetailBgmCard.svelte";
  import EventDetailCountdownCard from "$lib/components/EventDetailCountdownCard.svelte";
  import EventDetailInfoCard from "$lib/components/EventDetailInfoCard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/RegionBadgeSwitch.svelte";
  import { createCommonTranslator, setI18nLocale, tCommon } from "$lib/i18n";
  import { formatUnitFallbackLabel } from "$lib/unit-profile";
  import type { PageData } from "./$types";

  type EventAssetTab = "banner" | "title" | "background" | "characters";

  let { data }: { data: PageData } = $props();
  const getInitialCommonText = (key: string): string =>
    createCommonTranslator(data.uiLocale, data.commonMessages)(key);
  let debugDialog: HTMLDialogElement | null = $state(null);
  let displayLocale = $state<string>("");
  let activeAssetTab = $state<EventAssetTab>("banner");
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
  let bannerCharacterLabel = $state(getInitialCommonText("bannerCharacterLabel"));

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
    bannerCharacterLabel = translate("bannerCharacterLabel");
  };

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, data.commonMessages);
    applyTranslations((key) => tCommon(locale, key));
  };

  const openDebugDialog = (): void => {
    debugDialog?.showModal();
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
    regionOptions.map((regionOption) =>
      regionOption === data.region
        ? {
            key: regionOption,
            label: regionOption.toUpperCase(),
            active: true
          }
        : {
            key: regionOption,
            label: regionOption.toUpperCase(),
            href: resolve("/event/[region]/[id]", { region: regionOption, id: data.eventId }),
            active: false
          }
    );
  const getCurrentRegionBadgeOption = (): RegionBadgeOption[] => [
    {
      key: data.region,
      label: data.region.toUpperCase(),
      active: true
    }
  ];
  const getDisplayUnitName = (
    unitProfiles: Record<string, string>,
    unit: string | null | undefined
  ): string | null => {
    if (!unit) {
      return null;
    }

    const normalizedUnit = unit.trim().toLowerCase();
    return normalizedUnit === "none" || normalizedUnit === "-"
      ? mixedUnitLabel
      : (unitProfiles[normalizedUnit] ?? formatUnitFallbackLabel(normalizedUnit));
  };
</script>

<svelte:head>
  {#await data.eventPayload}
    <title>{eventTitlePrefix} {data.eventId} - Sekai Viewer</title>
  {:then payload}
    <title
      >{payload.event
        ? `${payload.event.title} - Sekai Viewer`
        : `${eventTitlePrefix} ${data.eventId} - Sekai Viewer`}</title
    >
  {/await}
</svelte:head>

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

    <div
      class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
    >
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
      breadcrumbs={getEventBreadcrumbItems(
        payload.event?.title ?? `${eventTitlePrefix} ${data.eventId}`
      )}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        {#if dev && payload.debugEventJson}
          <button type="button" class="btn btn-outline btn-sm" onclick={openDebugDialog}>
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
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
      >
        <div class="flex flex-col gap-4">
          <EventDetailAssetCard
            event={payload.event}
            region={data.region}
            bind:activeTab={activeAssetTab}
            bannerLabel={bannerTabLabel}
            titleLabel={titleTabLabel}
            backgroundLabel={backgroundTabLabel}
            charactersLabel={charactersTabLabel}
            {bannerAltSuffix}
            {imageUnavailableLabel}
            {closeLabel}
          />

          {#await data.unitProfiles then unitProfiles}
            <EventDetailInfoCard
              event={payload.event}
              region={data.region}
              uiLocale={data.uiLocale}
              {displayLocale}
              title={eventInfoTitle}
              {idLabel}
              {nameLabel}
              {unitLabel}
              {mixedUnitLabel}
              {unitProfiles}
              {eventTypeLabel}
              {startAtLabel}
              {endAtLabel}
              {bannerCharacterLabel}
            />
          {/await}

          {#await data.isCurrentEvent then isCurrentEvent}
            <EventDetailCountdownCard
              event={payload.event}
              {isCurrentEvent}
              uiLocale={data.uiLocale}
              title={eventCountdownTitle}
            />
          {/await}
        </div>

        {#await data.unitProfiles then unitProfiles}
          <EventDetailBgmCard
            event={payload.event}
            region={data.region}
            title={eventBgmTitle}
            unitName={getDisplayUnitName(unitProfiles, payload.event.unit) ?? ""}
            bgmDownloadHref={getEventBgmDownloadHref}
            bgmProgressHref={getEventBgmProgressHref()}
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
        {/await}
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
      <EventDebugDialog
        bind:dialog={debugDialog}
        title={debugEventJsonTitle}
        {closeLabel}
        json={payload.debugEventJson}
      />
    {/if}
  {/await}
</section>
