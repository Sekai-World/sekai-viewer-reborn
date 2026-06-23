<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import CardDetailAssetCard, {
    type CardAssetTab
  } from "$lib/components/card/CardDetailAssetCard.svelte";
  import CardDetailEpisodesCard from "$lib/components/card/CardDetailEpisodesCard.svelte";
  import CardDetailInfoCard from "$lib/components/card/CardDetailInfoCard.svelte";
  import CardDetailSkillCard from "$lib/components/card/CardDetailSkillCard.svelte";
  import CardDetailStatsCard from "$lib/components/card/CardDetailStatsCard.svelte";
  import EventDebugDialog from "$lib/components/shared/EventDebugDialog.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import { createI18nTranslator, setI18nLocale, tCommon } from "$lib/i18n";
  import type { SupportedRegion } from "$lib/regions";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, data.i18nMessages)(key);

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
  let cardSkillTitle = $state(getInitialI18nText("cardSkillTitle"));
  let skillNameLabel = $state(getInitialI18nText("skillNameLabel"));
  let skillDescriptionLabel = $state(getInitialI18nText("skillDescriptionLabel"));
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
    cardSkillTitle = translate("cardSkillTitle");
    skillNameLabel = translate("skillNameLabel");
    skillDescriptionLabel = translate("skillDescriptionLabel");
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
  };

  $effect(() => {
    displayLocale = data.uiLocale;
    const translate = createI18nTranslator(data.uiLocale, data.i18nMessages);
    applyTranslations(translate);
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    void refreshTranslations(data.uiLocale);
  });

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, data.i18nMessages);
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

<svelte:head>
  {#await data.cardPayload}
    <title>{pageTitlePrefix} {data.cardId} - Sekai Viewer</title>
  {:then payload}
    <title>
      {payload.card
        ? `${payload.card.title} - Sekai Viewer`
        : `${pageTitlePrefix} ${data.cardId} - Sekai Viewer`}
    </title>
  {/await}
</svelte:head>

<section class="mx-auto flex w-full max-w-400 flex-col gap-4 px-4">
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
        <div class="card-body gap-4 p-5">
          <div class="h-9 w-full animate-pulse rounded-xl bg-base-300"></div>
          <div class="aspect-[21/10] w-full animate-pulse rounded-[1.75rem] bg-base-300"></div>
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
              {nameLabel}
              {characterLabel}
              {unitLabel}
              {supportUnitLabel}
              {attrLabel}
              {rarityLabel}
              {typeLabel}
              {releaseAtLabel}
              {unitProfiles}
            />
          {/await}
        </div>

        <div class="flex min-w-0 flex-col gap-4">
          <CardDetailSkillCard
            skill={payload.card.skill}
            title={cardSkillTitle}
            {skillNameLabel}
            {skillDescriptionLabel}
            {skillLevelLabel}
            {durationLabel}
            {effectValueLabel}
            {noSkillLabel}
          />

          {#await data.episodes then episodes}
            {#await data.params then params}
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
            {/await}

            <CardDetailEpisodesCard
              {episodes}
              title={cardEpisodesTitle}
              {releaseConditionLabel}
              {costsLabel}
              {rewardsLabel}
              {noEpisodesLabel}
            />
          {/await}
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
  {/await}
</section>
