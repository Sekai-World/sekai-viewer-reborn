<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import CardDetailAssetCard, {
    type CardAssetTab
  } from "$lib/components/card/CardDetailAssetCard.svelte";
  import CardDetailEpisodesCard from "$lib/components/card/CardDetailEpisodesCard.svelte";
  import CardDetailEventsCard from "$lib/components/card/CardDetailEventsCard.svelte";
  import CardDetailGachaCard from "$lib/components/card/CardDetailGachaCard.svelte";
  import CardDetailInfoCard from "$lib/components/card/CardDetailInfoCard.svelte";
  import CardDetailSkillCard from "$lib/components/card/CardDetailSkillCard.svelte";
  import CardDetailStatsCard from "$lib/components/card/CardDetailStatsCard.svelte";
  import EventDebugDialog from "$lib/components/shared/EventDebugDialog.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import {
    createI18nTranslator,
    resolveStreamingMessages,
    setI18nLocale,
    tCommon
  } from "$lib/i18n/runtime";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let translationRequestId = 0;
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, resolveStreamingMessages(data.i18nMessages))(key);

  let debugDialog: HTMLDialogElement | null = $state(null);
  let displayLocale = $state("");
  let activeAssetTab = $state<CardAssetTab>("normal");
  let homeLabel = $state(getInitialI18nText("home"));
  let cardListTitle = $state(getInitialI18nText("cardListTitle"));
  let pageTitlePrefix = $state(getInitialI18nText("pageTitle.cardPrefix"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let nameLabel = $state(getInitialI18nText("nameLabel"));
  let imageUnavailableLabel = $state(getInitialI18nText("imageUnavailable"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let cardImageAltSuffix = $state(getInitialI18nText("cardImageAltSuffix"));
  let noCardLabel = $state(getInitialI18nText("noCardData"));
  let debugCardJsonButtonLabel = $state(getInitialI18nText("debugCardJsonButton"));
  let debugCardJsonTitle = $state(getInitialI18nText("debugCardJsonTitle"));
  let internalResourceCodeLabel = $state(getInitialI18nText("internalResourceCodeLabel"));
  let normalLabel = $state(getInitialI18nText("cardAssetTabs.normal"));
  let trainedLabel = $state(getInitialI18nText("cardAssetTabs.trained"));
  let normalCutoutLabel = $state(getInitialI18nText("cardAssetTabs.normalCutout"));
  let trainedCutoutLabel = $state(getInitialI18nText("cardAssetTabs.trainedCutout"));
  let cardInfoTitle = $state(getInitialI18nText("cardInfoTitle"));
  let characterLabel = $state(getInitialI18nText("characterLabel"));
  let unitLabel = $state(getInitialI18nText("unitLabel"));
  let supportUnitLabel = $state(getInitialI18nText("supportUnitLabel"));
  let attrLabel = $state(getInitialI18nText("attrLabel"));
  let rarityLabel = $state(getInitialI18nText("rarityLabel"));
  let typeLabel = $state(getInitialI18nText("typeLabel"));
  let releaseAtLabel = $state(getInitialI18nText("releaseAtLabel"));
  let gachaPhraseLabel = $state(getInitialI18nText("gachaPhraseLabel"));
  let audioPlayLabel = $state(getInitialI18nText("audioPlayLabel"));
  let audioUnavailableLabel = $state(getInitialI18nText("audioUnavailableLabel"));
  let cardSkillTitle = $state(getInitialI18nText("cardSkillTitle"));
  let skillLevelLabel = $state(getInitialI18nText("skillLevelLabel"));
  let durationLabel = $state(getInitialI18nText("durationLabel"));
  let effectValueLabel = $state(getInitialI18nText("effectValueLabel"));
  let noSkillLabel = $state(getInitialI18nText("noSkillLabel"));
  let cardStatsTitle = $state(getInitialI18nText("cardStatsTitle"));
  let levelLabel = $state(getInitialI18nText("levelLabel"));
  let performanceLabel = $state(getInitialI18nText("performanceLabel"));
  let techniqueLabel = $state(getInitialI18nText("techniqueLabel"));
  let staminaLabel = $state(getInitialI18nText("staminaLabel"));
  let totalLabel = $state(getInitialI18nText("totalLabel"));
  let bonusSumLabel = $state(getInitialI18nText("bonusSumLabel"));
  let specialTrainingBonusLabel = $state(getInitialI18nText("specialTrainingBonusLabel"));
  let episodeBonusLabel = $state(getInitialI18nText("episodeBonusLabel"));
  let masterRankBonusLabel = $state(getInitialI18nText("masterRankBonusLabel"));
  let noStatsLabel = $state(getInitialI18nText("noStatsLabel"));
  let cardEpisodesTitle = $state(getInitialI18nText("cardEpisodesTitle"));
  let releaseConditionLabel = $state(getInitialI18nText("releaseConditionLabel"));
  let costsLabel = $state(getInitialI18nText("costsLabel"));
  let rewardsLabel = $state(getInitialI18nText("rewardsLabel"));
  let noEpisodesLabel = $state(getInitialI18nText("noEpisodesLabel"));
  let cardRelatedEventsTitle = $state(getInitialI18nText("cardRelatedEventsTitle"));
  let noRelatedEventsLabel = $state(getInitialI18nText("noRelatedEventsLabel"));
  let noRelatedGachaLabel = $state(getInitialI18nText("noRelatedGachaLabel"));
  let cardGachaBannersTitle = $state(getInitialI18nText("cardGachaBannersTitle"));
  let showAllGachaLabel = $state(getInitialI18nText("showAllGachaLabel"));
  let relatedEventBonusLabel = $state(getInitialI18nText("relatedEventBonusLabel"));
  let relatedEventStoryLabel = $state(getInitialI18nText("relatedEventStoryLabel"));

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    cardListTitle = translate("cardListTitle");
    pageTitlePrefix = translate("pageTitle.cardPrefix");
    idLabel = translate("idLabel");
    nameLabel = translate("nameLabel");
    imageUnavailableLabel = translate("imageUnavailable");
    closeLabel = translate("closeLabel");
    cardImageAltSuffix = translate("cardImageAltSuffix");
    noCardLabel = translate("noCardData");
    debugCardJsonButtonLabel = translate("debugCardJsonButton");
    debugCardJsonTitle = translate("debugCardJsonTitle");
    internalResourceCodeLabel = translate("internalResourceCodeLabel");
    normalLabel = translate("cardAssetTabs.normal");
    trainedLabel = translate("cardAssetTabs.trained");
    normalCutoutLabel = translate("cardAssetTabs.normalCutout");
    trainedCutoutLabel = translate("cardAssetTabs.trainedCutout");
    cardInfoTitle = translate("cardInfoTitle");
    characterLabel = translate("characterLabel");
    unitLabel = translate("unitLabel");
    supportUnitLabel = translate("supportUnitLabel");
    attrLabel = translate("attrLabel");
    rarityLabel = translate("rarityLabel");
    typeLabel = translate("typeLabel");
    releaseAtLabel = translate("releaseAtLabel");
    gachaPhraseLabel = translate("gachaPhraseLabel");
    audioPlayLabel = translate("audioPlayLabel");
    audioUnavailableLabel = translate("audioUnavailableLabel");
    cardSkillTitle = translate("cardSkillTitle");
    skillLevelLabel = translate("skillLevelLabel");
    durationLabel = translate("durationLabel");
    effectValueLabel = translate("effectValueLabel");
    noSkillLabel = translate("noSkillLabel");
    cardStatsTitle = translate("cardStatsTitle");
    levelLabel = translate("levelLabel");
    performanceLabel = translate("performanceLabel");
    techniqueLabel = translate("techniqueLabel");
    staminaLabel = translate("staminaLabel");
    totalLabel = translate("totalLabel");
    bonusSumLabel = translate("bonusSumLabel");
    specialTrainingBonusLabel = translate("specialTrainingBonusLabel");
    episodeBonusLabel = translate("episodeBonusLabel");
    masterRankBonusLabel = translate("masterRankBonusLabel");
    noStatsLabel = translate("noStatsLabel");
    cardEpisodesTitle = translate("cardEpisodesTitle");
    releaseConditionLabel = translate("releaseConditionLabel");
    costsLabel = translate("costsLabel");
    rewardsLabel = translate("rewardsLabel");
    noEpisodesLabel = translate("noEpisodesLabel");
    cardRelatedEventsTitle = translate("cardRelatedEventsTitle");
    noRelatedEventsLabel = translate("noRelatedEventsLabel");
    noRelatedGachaLabel = translate("noRelatedGachaLabel");
    cardGachaBannersTitle = translate("cardGachaBannersTitle");
    showAllGachaLabel = translate("showAllGachaLabel");
    relatedEventBonusLabel = translate("relatedEventBonusLabel");
    relatedEventStoryLabel = translate("relatedEventStoryLabel");
  };

  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    displayLocale = data.uiLocale;
    const translate = createI18nTranslator(data.uiLocale, resolveStreamingMessages(messagesOrPromise));
    applyTranslations(translate);
  });

  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    if (!browser) {
      return;
    }

    void refreshTranslations(data.uiLocale, messagesOrPromise, requestId);
  });

  const refreshTranslations = async (localeValue: string, messagesOrPromise: typeof data.i18nMessages, requestId: number): Promise<void> => {
    const messages = await messagesOrPromise;
    if (requestId !== translationRequestId) return;
    const locale = await setI18nLocale(localeValue, messages);
    if (requestId !== translationRequestId) return;
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
      ? data.cardUnavailableInCurrentRegionMessage
      : data.failedToLoadCardDataMessage;
  const getCardListHref = (): string => resolve("/cards/[region]", { region: data.region });
  const getBreadcrumbItems = (currentLabel: string) => [
    {
      label: homeLabel,
      href: resolve("/")
    },
    {
      label: cardListTitle,
      href: getCardListHref()
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
            href: resolve("/card/[region]/[id]", { region: regionOption, id: data.cardId }),
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
</script>

{#snippet statsCardSkeleton()}
  <article class="card content-card-shell shadow-sm" aria-busy="true">
    <div class="card-body gap-4 p-3 sm:p-5">
      <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
        <span class="size-4 animate-pulse rounded bg-base-300" aria-hidden="true"></span>
        <span>{cardStatsTitle}</span>
      </p>

      <div class="grid gap-3 lg:grid-cols-2 lg:items-start">
        <div class="space-y-3">
          <div class="content-card-inset rounded-xl p-3 sm:px-4">
            <div class="flex items-center justify-between gap-4">
              <div class="h-4 w-20 animate-pulse rounded bg-base-300"></div>
              <div class="h-8 w-20 animate-pulse rounded bg-base-300"></div>
            </div>
            <div class="mt-3 h-3 animate-pulse rounded-full bg-base-300"></div>
          </div>

          <div class="content-card-inset space-y-3 rounded-xl p-3 sm:px-4">
            <div class="flex items-center justify-between gap-3">
              <div class="h-4 w-32 animate-pulse rounded bg-base-300"></div>
              <div class="h-5 w-10 animate-pulse rounded-full bg-base-300"></div>
            </div>
            <div class="space-y-2">
              <div class="h-4 w-24 animate-pulse rounded bg-base-300"></div>
              <div class="flex gap-2">
                <div class="h-10 w-12 animate-pulse rounded-lg bg-base-300"></div>
                <div class="h-10 w-12 animate-pulse rounded-lg bg-base-300"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between gap-4">
                <div class="h-4 w-28 animate-pulse rounded bg-base-300"></div>
                <div class="h-8 w-16 animate-pulse rounded bg-base-300"></div>
              </div>
              <div class="mt-3 h-3 animate-pulse rounded-full bg-base-300"></div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="space-y-2">
            {#each [0, 1, 2] as panelKey (panelKey)}
              <div class="content-card-inset rounded-xl px-3 sm:px-4 py-2.5">
                <div class="flex items-center justify-between gap-4">
                  <div class="h-4 w-28 animate-pulse rounded bg-base-300"></div>
                  <div class="h-6 w-20 animate-pulse rounded bg-base-300"></div>
                </div>
              </div>
            {/each}
          </div>

          <div class="content-card-inset rounded-xl p-3 sm:px-4">
            <div class="flex items-center justify-between gap-4">
              <div class="h-4 w-24 animate-pulse rounded bg-base-300"></div>
              <div class="h-5 w-20 animate-pulse rounded bg-base-300"></div>
            </div>
            <div class="mt-3 space-y-2">
              <div class="h-3 w-full animate-pulse rounded bg-base-300"></div>
              <div class="h-3 w-5/6 animate-pulse rounded bg-base-300"></div>
              <div class="h-3 w-4/6 animate-pulse rounded bg-base-300"></div>
            </div>
          </div>

          <div class="pt-2">
            <div class="content-card-inset rounded-xl px-3 sm:px-4 py-2.5">
              <div class="flex items-center justify-between gap-4">
                <div class="h-4 w-20 animate-pulse rounded bg-base-300"></div>
                <div class="h-6 w-24 animate-pulse rounded bg-base-300"></div>
              </div>
              <div class="mt-2 h-2 animate-pulse rounded-full bg-base-300"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
{/snippet}

<svelte:head>
  {#await data.cardPayload}
    <title>{pageTitlePrefix} {data.cardId} - Sekai Viewer</title>
  {:then payload}
    <title>
      {payload.card
        ? `${payload.card.title} - Sekai Viewer`
        : `${pageTitlePrefix} ${data.cardId} - Sekai Viewer`}
    </title>
  {:catch}
    <title>{pageTitlePrefix} {data.cardId} - Sekai Viewer</title>
  {/await}
</svelte:head>

<section class="mx-auto flex w-full max-w-400 flex-col gap-4 px-2">
  {#await data.cardPayload}
    <PageHeader
      breadcrumbs={getBreadcrumbItems(`${pageTitlePrefix} ${data.cardId}`)}
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
        <div class="card-body gap-4 p-3 sm:p-5">
          <div class="h-9 w-full animate-pulse rounded-xl bg-base-300"></div>
          <div class="aspect-21/10 w-full animate-pulse rounded-[1.75rem] bg-base-300"></div>
        </div>
      </article>
      <article class="card content-card-shell overflow-hidden shadow-sm">
        <div class="card-body gap-3 p-3 sm:p-5">
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
      breadcrumbs={getBreadcrumbItems(payload.card?.title ?? `${pageTitlePrefix} ${data.cardId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        {#if dev && payload.debugCardJson}
          <button type="button" class="btn btn-outline btn-sm" onclick={openDebugDialog}>
            {debugCardJsonButtonLabel}
          </button>
        {/if}
        {#await data.availableRegions then availableRegions}
          <RegionBadgeSwitch options={getRegionBadgeOptions(getRegionOptions(availableRegions))} />
        {:catch}
          <RegionBadgeSwitch options={getCurrentRegionBadgeOption()} />
        {/await}
      {/snippet}
    </PageHeader>

    {#if payload.error}
      <div class="alert alert-error">{payload.error}</div>
    {/if}

    {#if payload.card}
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
      >
        <div class="flex flex-col gap-4">
          <CardDetailAssetCard
            card={payload.card}
            region={data.region}
            bind:activeTab={activeAssetTab}
            {normalLabel}
            {trainedLabel}
            {normalCutoutLabel}
            {trainedCutoutLabel}
            {imageUnavailableLabel}
            {cardImageAltSuffix}
            {closeLabel}
          />

          {#await data.unitProfiles then unitProfiles}
            <CardDetailInfoCard
              card={payload.card}
              {displayLocale}
            title={cardInfoTitle}
            {idLabel}
            {internalResourceCodeLabel}
            {nameLabel}
              {characterLabel}
              {unitLabel}
              {supportUnitLabel}
              {attrLabel}
              {rarityLabel}
              {typeLabel}
              {releaseAtLabel}
              {gachaPhraseLabel}
              {audioPlayLabel}
              {audioUnavailableLabel}
              {unitProfiles}
            />
          {:catch}
            <CardDetailInfoCard
              card={payload.card}
              {displayLocale}
            title={cardInfoTitle}
            {idLabel}
            {internalResourceCodeLabel}
            {nameLabel}
              {characterLabel}
              {unitLabel}
              {supportUnitLabel}
              {attrLabel}
              {rarityLabel}
              {typeLabel}
              {releaseAtLabel}
              {gachaPhraseLabel}
              {audioPlayLabel}
              {audioUnavailableLabel}
              unitProfiles={{}}
            />
          {/await}
        </div>

        <div class="flex min-w-0 flex-col gap-4">
          <CardDetailSkillCard
            skill={payload.card.skill}
            character={payload.card.character}
            title={cardSkillTitle}
            {skillLevelLabel}
            {durationLabel}
            {effectValueLabel}
            {noSkillLabel}
          />

          {#await Promise.all([data.episodes, data.params])}
		            {@render statsCardSkeleton()}
		          {:then [episodes, params]}
		            <CardDetailStatsCard
		              card={payload.card}
		              {params}
		              {episodes}
		              title={cardStatsTitle}
		              {levelLabel}
		              {performanceLabel}
		              {techniqueLabel}
		              {staminaLabel}
		              {totalLabel}
		              {bonusSumLabel}
		              {specialTrainingBonusLabel}
		              {episodeBonusLabel}
		              {masterRankBonusLabel}
		              {noStatsLabel}
		            />
		          {:catch}
		            <article class="card content-card-shell shadow-sm">
		              <div class="card-body gap-4 p-3 sm:p-5">
		                <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">{cardStatsTitle}</p>
		                <p class="text-sm opacity-60">{noStatsLabel}</p>
		              </div>
		            </article>
		          {/await}

          <div class="grid gap-4 lg:grid-cols-2 lg:items-start">
            {#await data.episodes then episodes}
              <CardDetailEpisodesCard
                {episodes}
                title={cardEpisodesTitle}
                {releaseConditionLabel}
                {costsLabel}
                {rewardsLabel}
                {noEpisodesLabel}
              />
            {:catch}
              <article class="card content-card-shell shadow-sm">
                <div class="card-body gap-4 p-3 sm:p-5">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">{cardEpisodesTitle}</p>
                  <p class="text-sm opacity-60">{noEpisodesLabel}</p>
                </div>
              </article>
            {/await}

            {#await data.relatedEvents then relatedEvents}
              <CardDetailEventsCard
                events={relatedEvents}
                region={data.region}
                uiLocale={displayLocale}
                title={cardRelatedEventsTitle}
                emptyLabel={noRelatedEventsLabel}
                bonusLabel={relatedEventBonusLabel}
                storyLabel={relatedEventStoryLabel}
              />
            {:catch}
              <article class="card content-card-shell shadow-sm">
                <div class="card-body gap-4 p-3 sm:p-5">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">{cardRelatedEventsTitle}</p>
                  <p class="text-sm opacity-60">{noRelatedEventsLabel}</p>
                </div>
              </article>
            {/await}

            {#await data.gachas then gachas}
              <CardDetailGachaCard
                {gachas}
                region={data.region}
                uiLocale={displayLocale}
                title={cardGachaBannersTitle}
                emptyLabel={noRelatedGachaLabel}
                showAllLabel={showAllGachaLabel}
              />
            {:catch}
              <article class="card content-card-shell shadow-sm">
                <div class="card-body gap-4 p-3 sm:p-5">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">{cardGachaBannersTitle}</p>
                  <p class="text-sm opacity-60">{noRelatedGachaLabel}</p>
                </div>
              </article>
            {/await}
          </div>
        </div>
      </div>
    {:else if !payload.error}
      {#await data.availableRegions}
        <div class="alert">
          <span class="loading loading-spinner loading-sm"></span>
          {noCardLabel}
        </div>
      {:then availableRegions}
        <div class="alert alert-error">{getUnavailableError(availableRegions)}</div>
      {:catch}
        <div class="alert alert-error">{noCardLabel}</div>
      {/await}
    {/if}

    {#if dev && payload.debugCardJson}
      <EventDebugDialog
        bind:dialog={debugDialog}
        title={debugCardJsonTitle}
        {closeLabel}
        json={payload.debugCardJson}
      />
    {/if}
  {:catch}
    <PageHeader
      breadcrumbs={getBreadcrumbItems(`${pageTitlePrefix} ${data.cardId}`)}
      breadcrumbClass="md:max-w-[68%]"
    />
    <div class="alert alert-error">{data.failedToLoadCardDataMessage}</div>
  {/await}
</section>
