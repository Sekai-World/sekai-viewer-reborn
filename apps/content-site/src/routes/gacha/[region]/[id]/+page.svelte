<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import GachaDetailAssetCard, {
    type GachaAssetTab
  } from "$lib/components/gacha/GachaDetailAssetCard.svelte";
  import GachaDetailBehaviorCard from "$lib/components/gacha/GachaDetailBehaviorCard.svelte";
  import GachaDetailCountdownCard from "$lib/components/gacha/GachaDetailCountdownCard.svelte";
  import GachaDetailInfoCard from "$lib/components/gacha/GachaDetailInfoCard.svelte";
  import GachaDetailPickupCard from "$lib/components/gacha/GachaDetailPickupCard.svelte";
  import GachaDetailRarityRateCard from "$lib/components/gacha/GachaDetailRarityRateCard.svelte";
  import GachaSimulatorCard from "$lib/components/gacha/GachaSimulatorCard.svelte";
  import Icon from "@iconify/svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import { createI18nTranslator, setI18nLocale, tCommon } from "$lib/i18n/runtime";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, data.i18nMessages)(key);

  let displayLocale = $state("");
  let activeAssetTab = $state<GachaAssetTab>("logo");

  let homeLabel = $state(getInitialI18nText("home"));
  let gachaListTitle = $state(getInitialI18nText("gachaListTitle"));
  let pageTitlePrefix = $state(getInitialI18nText("pageTitle.gachaPrefix"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let nameLabel = $state(getInitialI18nText("nameLabel"));
  let startAtLabel = $state(getInitialI18nText("startAt"));
  let endAtLabel = $state(getInitialI18nText("endAt"));
  let gachaTypeLabel = $state(getInitialI18nText("gachaTypeLabel"));
  let costLabel = $state(getInitialI18nText("costLabel"));
  let noGachaDataLabel = $state(getInitialI18nText("noGachaData"));
  let imageUnavailableLabel = $state(getInitialI18nText("imageUnavailable"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let gachaInfoTitle = $state(getInitialI18nText("gachaInfoTitle"));
  let gachaCountdownTitle = $state(getInitialI18nText("gachaCountdownTitle"));
  let logoLabel = $state(getInitialI18nText("gachaAssetTabs.logo"));
  let bannerLabel = $state(getInitialI18nText("gachaAssetTabs.banner"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  let pickupTitle = $state(getInitialI18nText("gachaPickupTitle"));
  let gachaPickupWeight = $state(getInitialI18nText("gachaPickupWeight"));
  let gachaNoPickups = $state(getInitialI18nText("gachaNoPickups"));
  let cardImageAltSuffix = $state(getInitialI18nText("cardImageAltSuffix"));
  let gachaSummaryLabel = $state(getInitialI18nText("gachaSummary"));
  let gachaRarityRateTitle = $state(getInitialI18nText("gachaRarityRateTitle"));
  let gachaNoRarityRates = $state(getInitialI18nText("gachaNoRarityRates"));
  let gachaBehaviorTitle = $state(getInitialI18nText("gachaBehaviorTitle"));
  let gachaNoBehaviors = $state(getInitialI18nText("gachaNoBehaviors"));
  let gachaBehaviorSpinCount = $state(getInitialI18nText("gachaBehaviorSpinCount"));
  let gachaBehaviorCost = $state(getInitialI18nText("gachaBehaviorCost"));
  let gachaBehaviorLimit = $state(getInitialI18nText("gachaBehaviorLimit"));
  let gachaDescriptionLabel = $state(getInitialI18nText("gachaDescription"));
  let gachaDescriptionShowMore = $state(getInitialI18nText("gachaDescriptionShowMore"));
  let gachaDescriptionShowLess = $state(getInitialI18nText("gachaDescriptionShowLess"));

  // Simulator i18n labels
  let simulatorTitle = $state(getInitialI18nText("simulatorTitle"));
  let simulatorPull1 = $state(getInitialI18nText("simulatorPull1"));
  let simulatorPull10 = $state(getInitialI18nText("simulatorPull10"));
  let simulatorReset = $state(getInitialI18nText("simulatorReset"));
  let simulatorTotalPulls = $state(getInitialI18nText("simulatorTotalPulls"));
  let simulatorResults = $state(getInitialI18nText("simulatorResults"));
  let simulatorNoPool = $state(getInitialI18nText("simulatorNoPool"));
  let simulatorEmpty = $state(getInitialI18nText("simulatorEmpty"));
  let simulatorNew = $state(getInitialI18nText("simulatorNew"));
  let simulatorStatsTitle = $state(getInitialI18nText("simulatorStatsTitle"));
  let simulatorRarityStats = $state(getInitialI18nText("simulatorRarityStats"));
  let simulatorCountStats = $state(getInitialI18nText("simulatorCountStats"));
  let simulatorRateStats = $state(getInitialI18nText("simulatorRateStats"));
  let simulatorDisclaimer = $state(getInitialI18nText("simulatorDisclaimer"));

  const DESCRIPTION_COLLAPSED_LENGTH = 150;
  let descriptionExpanded = $state(false);

  const buildGachaTypeMap = (translate: (key: string) => string): Record<string, string> => ({
    normal: translate("gachaType.normal"),
    ceil: translate("gachaType.ceil"),
    beginner: translate("gachaType.beginner"),
    limited: translate("gachaType.limited"),
    birthday: translate("gachaType.birthday"),
    colorful_festival: translate("gachaType.colorful_festival"),
    gift: translate("gachaType.gift")
  });
  let gachaTypeMap = $state(buildGachaTypeMap(getInitialI18nText));

  const buildLotteryTypeMap = (translate: (key: string) => string): Record<string, string> => ({
    normal: translate("lotteryType.normal"),
    categorized_wish: translate("lotteryType.categorized_wish")
  });
  let lotteryTypeMap = $state(buildLotteryTypeMap(getInitialI18nText));

  const buildBehaviorTypeMap = (translate: (key: string) => string): Record<string, string> => ({
    normal: translate("behaviorType.normal"),
    once_a_day: translate("behaviorType.once_a_day"),
    once_a_week: translate("behaviorType.once_a_week"),
    over_rarity_3_once: translate("behaviorType.over_rarity_3_once"),
    over_rarity_4_once: translate("behaviorType.over_rarity_4_once")
  });
  let behaviorTypeMap = $state(buildBehaviorTypeMap(getInitialI18nText));

  const buildSpinnableTypeMap = (translate: (key: string) => string): Record<string, string> => ({
    any: translate("spinnableType.any"),
    colorful_pass: translate("spinnableType.colorful_pass")
  });
  let spinnableTypeMap = $state(buildSpinnableTypeMap(getInitialI18nText));

  const buildResourceCategoryMap = (translate: (key: string) => string): Record<string, string> => ({
    consume_resource: translate("resourceCategory.consume_resource"),
    free_resource: translate("resourceCategory.free_resource")
  });
  let resourceCategoryMap = $state(buildResourceCategoryMap(getInitialI18nText));

  const buildCostResourceTypeMap = (translate: (key: string) => string): Record<string, string> => ({
    jewel: translate("costResourceType.jewel"),
    paid_jewel: translate("costResourceType.paid_jewel"),
    gacha_ticket: translate("costResourceType.gacha_ticket")
  });
  let costResourceTypeMap = $state(buildCostResourceTypeMap(getInitialI18nText));

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    gachaListTitle = translate("gachaListTitle");
    pageTitlePrefix = translate("pageTitle.gachaPrefix");
    idLabel = translate("idLabel");
    nameLabel = translate("nameLabel");
    startAtLabel = translate("startAt");
    endAtLabel = translate("endAt");
    gachaTypeLabel = translate("gachaTypeLabel");
    costLabel = translate("costLabel");
    noGachaDataLabel = translate("noGachaData");
    imageUnavailableLabel = translate("imageUnavailable");
    closeLabel = translate("closeLabel");
    gachaInfoTitle = translate("gachaInfoTitle");
    gachaCountdownTitle = translate("gachaCountdownTitle");
    logoLabel = translate("gachaAssetTabs.logo");
    bannerLabel = translate("gachaAssetTabs.banner");
    bannerAltSuffix = translate("bannerAltSuffix");
    pickupTitle = translate("gachaPickupTitle");
    gachaPickupWeight = translate("gachaPickupWeight");
    gachaNoPickups = translate("gachaNoPickups");
    cardImageAltSuffix = translate("cardImageAltSuffix");
    gachaSummaryLabel = translate("gachaSummary");
    gachaRarityRateTitle = translate("gachaRarityRateTitle");
    gachaNoRarityRates = translate("gachaNoRarityRates");
    gachaBehaviorTitle = translate("gachaBehaviorTitle");
    gachaNoBehaviors = translate("gachaNoBehaviors");
    gachaBehaviorSpinCount = translate("gachaBehaviorSpinCount");
    gachaBehaviorCost = translate("gachaBehaviorCost");
    gachaBehaviorLimit = translate("gachaBehaviorLimit");
    gachaDescriptionLabel = translate("gachaDescription");
    gachaDescriptionShowMore = translate("gachaDescriptionShowMore");
    gachaDescriptionShowLess = translate("gachaDescriptionShowLess");
    simulatorTitle = translate("simulatorTitle");
    simulatorPull1 = translate("simulatorPull1");
    simulatorPull10 = translate("simulatorPull10");
    simulatorReset = translate("simulatorReset");
    simulatorTotalPulls = translate("simulatorTotalPulls");
    simulatorResults = translate("simulatorResults");
    simulatorNoPool = translate("simulatorNoPool");
    simulatorEmpty = translate("simulatorEmpty");
    simulatorNew = translate("simulatorNew");
    simulatorStatsTitle = translate("simulatorStatsTitle");
    simulatorRarityStats = translate("simulatorRarityStats");
    simulatorCountStats = translate("simulatorCountStats");
    simulatorRateStats = translate("simulatorRateStats");
    simulatorDisclaimer = translate("simulatorDisclaimer");
    gachaTypeMap = buildGachaTypeMap(translate);
    lotteryTypeMap = buildLotteryTypeMap(translate);
    behaviorTypeMap = buildBehaviorTypeMap(translate);
    spinnableTypeMap = buildSpinnableTypeMap(translate);
    resourceCategoryMap = buildResourceCategoryMap(translate);
    costResourceTypeMap = buildCostResourceTypeMap(translate);
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

  const regionDisplayOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];
  const getRegionOptions = (availableRegions: SupportedRegion[]): SupportedRegion[] =>
    regionDisplayOrder.filter(
      (regionOption) => availableRegions.includes(regionOption) || regionOption === data.region
    );
  const hasAlternativeRegion = (availableRegions: SupportedRegion[]): boolean =>
    availableRegions.some((regionOption) => regionOption !== data.region);
  const getGachaListHref = (): string => resolve("/gachas/[region]", { region: data.region });
  const getBreadcrumbItems = (currentLabel: string) => [
    { label: homeLabel, href: resolve("/") },
    { label: gachaListTitle, href: getGachaListHref() },
    { label: currentLabel }
  ];
  const getRegionBadgeOptions = (regionOptions: SupportedRegion[]): RegionBadgeOption[] =>
    regionOptions.map((regionOption) =>
      regionOption === data.region
        ? { key: regionOption, label: regionOption.toUpperCase(), active: true }
        : {
            key: regionOption,
            label: regionOption.toUpperCase(),
            href: resolve("/gacha/[region]/[id]", { region: regionOption, id: data.gachaId }),
            active: false
          }
    );
  const getCurrentRegionBadgeOption = (): RegionBadgeOption[] => [
    { key: data.region, label: data.region.toUpperCase(), active: true }
  ];
</script>

<svelte:head>
  {#await data.gachaPayload}
    <title>{pageTitlePrefix} {data.gachaId} - Sekai Viewer</title>
  {:then payload}
    <title>
      {payload.gacha
        ? `${payload.gacha.name ?? `${pageTitlePrefix} ${data.gachaId}`} - Sekai Viewer`
        : `${pageTitlePrefix} ${data.gachaId} - Sekai Viewer`}
    </title>
  {/await}
</svelte:head>

<section class="mx-auto flex w-full max-w-400 flex-col gap-4 px-2">
  {#await data.gachaPayload}
    <PageHeader
      breadcrumbs={getBreadcrumbItems(`${pageTitlePrefix} ${data.gachaId}`)}
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
          <div
            class="aspect-16/7 w-full animate-pulse rounded-[1.75rem] bg-base-300"
          ></div>
        </div>
      </article>
      <article class="card content-card-shell shadow-sm">
        <div class="card-body gap-3 p-3 sm:p-5">
          <div class="h-5 w-1/3 animate-pulse rounded bg-base-300"></div>
          <div class="grid gap-3">
            <div class="h-16 animate-pulse rounded-xl bg-base-300"></div>
            <div class="h-16 animate-pulse rounded-xl bg-base-300"></div>
            <div class="h-16 animate-pulse rounded-xl bg-base-300"></div>
            <div class="h-16 animate-pulse rounded-xl bg-base-300"></div>
          </div>
        </div>
      </article>
    </div>
  {:then payload}
    <PageHeader
      breadcrumbs={getBreadcrumbItems(
        payload.gacha?.name ?? `${pageTitlePrefix} ${data.gachaId}`
      )}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        {#await data.availableRegions then availableRegions}
          <RegionBadgeSwitch options={getRegionBadgeOptions(getRegionOptions(availableRegions))} />
        {/await}
      {/snippet}
    </PageHeader>

    {#if payload.error}
      <div class="alert alert-error">{payload.error}</div>
    {/if}

    {#if payload.gacha}
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
      >
        <div class="flex flex-col gap-4">
          <GachaDetailAssetCard
            gacha={payload.gacha}
            region={data.region}
            bind:activeTab={activeAssetTab}
            logoLabel={logoLabel}
            bannerLabel={bannerLabel}
            bannerAltSuffix={bannerAltSuffix}
            imageUnavailableLabel={imageUnavailableLabel}
            closeLabel={closeLabel}
          />

          <GachaDetailInfoCard
            gacha={payload.gacha}
            uiLocale={displayLocale || data.uiLocale}
            title={gachaInfoTitle}
            {idLabel}
            {nameLabel}
            {gachaTypeLabel}
            {gachaTypeMap}
            {startAtLabel}
            {endAtLabel}
            {costLabel}
            {noGachaDataLabel}
          />

          <GachaDetailCountdownCard
            gacha={payload.gacha}
            uiLocale={displayLocale || data.uiLocale}
            title={gachaCountdownTitle}
          />

          {#if payload.gacha.summary}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-3 p-3 sm:p-5">
                <p
                  class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                >
                  <Icon
                    icon="mdi:text-short"
                    class="size-4 shrink-0 translate-y-[0.5px]"
                    aria-hidden="true"
                  />
                  <span>{gachaSummaryLabel}</span>
                </p>
                <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
                  <p class="text-sm/7 opacity-90">{payload.gacha.summary}</p>
                </div>
              </div>
            </article>
          {/if}
        </div>

        <div class="flex flex-col gap-4">
          <GachaDetailPickupCard
            pickupCards={payload.pickupCards}
            region={data.region}
            title={pickupTitle}
            weightLabel={gachaPickupWeight}
            noPickupsLabel={gachaNoPickups}
            cardAltSuffix={cardImageAltSuffix}
          />

          {#if payload.gacha.gachaCardRarityRates}
            <GachaDetailRarityRateCard
              rates={payload.gacha.gachaCardRarityRates}
              title={gachaRarityRateTitle}
              noRatesLabel={gachaNoRarityRates}
              {lotteryTypeMap}
            />
          {/if}

          {#if payload.gacha.gachaBehaviors}
            <GachaDetailBehaviorCard
              behaviors={payload.gacha.gachaBehaviors}
              title={gachaBehaviorTitle}
              noBehaviorsLabel={gachaNoBehaviors}
              spinCountLabel={gachaBehaviorSpinCount}
              costLabel={gachaBehaviorCost}
              limitLabel={gachaBehaviorLimit}
              region={data.region}
              {behaviorTypeMap}
              {spinnableTypeMap}
              {resourceCategoryMap}
              {costResourceTypeMap}
            />
          {/if}

          <GachaSimulatorCard
            gachaId={data.gachaId}
            region={data.region}
            title={simulatorTitle}
            pull1Label={simulatorPull1}
            pull10Label={simulatorPull10}
            resetLabel={simulatorReset}
            totalPullsLabel={simulatorTotalPulls}
            resultsLabel={simulatorResults}
            noPoolLabel={simulatorNoPool}
            emptyLabel={simulatorEmpty}
            newLabel={simulatorNew}
            statsTitle={simulatorStatsTitle}
            rarityStatsLabel={simulatorRarityStats}
            countStatsLabel={simulatorCountStats}
            rateStatsLabel={simulatorRateStats}
            disclaimerLabel={simulatorDisclaimer}
            cardAltSuffix={cardImageAltSuffix}
          />

          {#if payload.gacha.gachaInformation?.description}
            {@const desc = payload.gacha.gachaInformation.description}
            {@const needsTruncation = desc.length > DESCRIPTION_COLLAPSED_LENGTH}
            {@const displayDesc = (!needsTruncation || descriptionExpanded) ? desc : desc.slice(0, DESCRIPTION_COLLAPSED_LENGTH) + "…"}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-3 p-3 sm:p-5">
                <p
                  class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                >
                  <Icon
                    icon="mdi:text-box-outline"
                    class="size-4 shrink-0 translate-y-[0.5px]"
                    aria-hidden="true"
                  />
                  <span>{gachaDescriptionLabel}</span>
                </p>
                <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
                  <p class="text-sm/7 whitespace-pre-line opacity-90">{displayDesc}</p>
                  {#if needsTruncation}
                    <button
                      onclick={() => descriptionExpanded = !descriptionExpanded}
                      class="btn btn-ghost btn-sm mt-1.5 gap-1 px-2 text-xs"
                    >
                      <Icon
                        icon={descriptionExpanded ? "mdi:chevron-up" : "mdi:chevron-down"}
                        class="size-3.5"
                        aria-hidden="true"
                      />
                      {descriptionExpanded ? gachaDescriptionShowLess : gachaDescriptionShowMore}
                    </button>
                  {/if}
                </div>
              </div>
            </article>
          {/if}
        </div>
      </div>
    {:else if !payload.error}
      {#await data.availableRegions}
        <div class="alert">
          <span class="loading loading-spinner loading-sm"></span>{noGachaDataLabel}
        </div>
      {:then availableRegions}
        {#if hasAlternativeRegion(availableRegions)}
          <div class="alert alert-warning">
            <span>{data.gachaUnavailableInCurrentRegionMessage}</span>
          </div>
        {:else}
          <div class="alert alert-warning">
            <span>{data.failedToLoadGachaDataMessage}</span>
          </div>
        {/if}
      {/await}
    {/if}
  {/await}
</section>
