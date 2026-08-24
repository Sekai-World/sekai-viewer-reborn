<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import { swipeRegion } from "$lib/actions/swipe-region";
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
  import DetailPageSkeleton from "$lib/components/shared/DetailPageSkeleton.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const getInitialMessages = (): Record<string, string> =>
    resolveStreamingMessages(data.i18nMessages, ["common", "gacha", "error"]);
  let translationRequestId = 0;
  let currentMessages = $state<Record<string, string>>(getInitialMessages());

  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, getInitialMessages())(key);

  const buildRarityLabelMap = (translate: (key: string) => string): Record<string, string> => ({
    rarity_1: translate("gachaRarity1"),
    rarity_2: translate("gachaRarity2"),
    rarity_3: translate("gachaRarity3"),
    rarity_4: translate("gachaRarity4"),
    rarity_birthday: translate("gachaRarityBirthday"),
    rarity_4_birthday: translate("gachaRarityBirthday")
  });

  let displayLocale = $state("");
  let activeAssetTab = $state<GachaAssetTab>("logo");

  let homeLabel = $state(getInitialI18nText("home"));
  let gachaListTitle = $state(getInitialI18nText("navigation.gachas"));
  let pageTitlePrefix = $state(getInitialI18nText("pageTitle.gachaPrefix"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let nameLabel = $state(getInitialI18nText("nameLabel"));
  let startAtLabel = $state(getInitialI18nText("startAt"));
  let endAtLabel = $state(getInitialI18nText("endAt"));
  let gachaTypeLabel = $state(getInitialI18nText("gachaTypeLabel"));
  let noGachaDataLabel = $state(getInitialI18nText("noGachaData"));
  let imageUnavailableLabel = $state(getInitialI18nText("imageUnavailable"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let gachaInfoTitle = $state(getInitialI18nText("gachaInfoTitle"));
  let internalResourceCodeLabel = $state(getInitialI18nText("internalResourceCodeLabel"));
  let gachaCountdownTitle = $state(getInitialI18nText("gachaCountdownTitle"));
  let logoLabel = $state(getInitialI18nText("gachaAssetTabs.logo"));
  let bannerLabel = $state(getInitialI18nText("assetTab.banner"));
  let backgroundLabel = $state(getInitialI18nText("assetTab.background"));
  let backgroundUnavailableLabel = $state(getInitialI18nText("gachaBackgroundUnavailable"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  let pickupTitle = $state(getInitialI18nText("gachaPickupTitle"));
  let gachaPickupWeight = $state(getInitialI18nText("gachaPickupWeight"));
  let gachaNoPickups = $state(getInitialI18nText("gachaNoPickups"));
  let cardImageAltSuffix = $state(getInitialI18nText("cardImageAltSuffix"));
  let gachaSummaryLabel = $state(getInitialI18nText("gachaSummary"));
  let gachaRarityRateTitle = $state(getInitialI18nText("gachaRarityRateTitle"));
  let gachaNoRarityRates = $state(getInitialI18nText("gachaNoRarityRates"));
  let probabilityOpenLabel = $state(getInitialI18nText("gachaProbabilityOpen"));
  let probabilityTitle = $state(getInitialI18nText("gachaProbabilityTitle"));
  let probabilityCloseLabel = $state(getInitialI18nText("gachaProbabilityClose"));
  let probabilityInfoLabel = $state(getInitialI18nText("gachaProbabilityInfoLabel"));
  let probabilityDisclaimer = $state(getInitialI18nText("gachaProbabilityDisclaimer"));
  let probabilityNormalLabel = $state(getInitialI18nText("gachaProbabilityNormal"));
  let probabilityWishLabel = $state(getInitialI18nText("gachaProbabilityWish"));
  let probabilityUnavailableLabel = $state(getInitialI18nText("gachaProbabilityUnavailable"));
  let probabilityLoadingLabel = $state(getInitialI18nText("gachaProbabilityLoading"));
  let probabilityLoadFailedLabel = $state(getInitialI18nText("gachaProbabilityLoadFailed"));
  let probabilityRetryLabel = $state(getInitialI18nText("listRetry"));
  let probabilityConditionalLabel = $state(getInitialI18nText("gachaProbabilityConditional"));
  let probabilityCardIdLabel = $state(getInitialI18nText("gachaProbabilityCardId"));
  let probabilityDiagnosticLabels = $state<Record<string, string>>({});
  let rarityLabels = $state(buildRarityLabelMap(getInitialI18nText));
  let rarityUnknownLabel = $state(getInitialI18nText("gachaRarityUnknown"));
  let rarityRateChoiceNote = $state(getInitialI18nText("gachaRarityRateChoiceNote"));
  let gachaBehaviorTitle = $state(getInitialI18nText("gachaBehaviorTitle"));
  let gachaNoBehaviors = $state(getInitialI18nText("gachaNoBehaviors"));
  let gachaBehaviorSpinCount = $state(getInitialI18nText("gachaBehaviorSpinCount"));
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
    categorized_wish: translate("lotteryType.categorized_wish"),
    rate_choice_first: translate("lotteryType.rate_choice_first"),
    rate_choice_second: translate("lotteryType.rate_choice_second"),
    rate_choice: translate("lotteryType.rate_choice"),
    unknown: translate("lotteryType.unknown")
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

  const buildResourceCategoryMap = (
    translate: (key: string) => string
  ): Record<string, string> => ({
    consume_resource: translate("resourceCategory.consume_resource"),
    free_resource: translate("resourceCategory.free_resource")
  });
  let resourceCategoryMap = $state(buildResourceCategoryMap(getInitialI18nText));

  const buildCostResourceTypeMap = (
    translate: (key: string) => string
  ): Record<string, string> => ({
    jewel: translate("costResourceType.jewel"),
    paid_jewel: translate("costResourceType.paid_jewel"),
    gacha_ticket: translate("costResourceType.gacha_ticket")
  });
  let costResourceTypeMap = $state(buildCostResourceTypeMap(getInitialI18nText));

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    gachaListTitle = translate("navigation.gachas");
    pageTitlePrefix = translate("pageTitle.gachaPrefix");
    idLabel = translate("idLabel");
    nameLabel = translate("nameLabel");
    startAtLabel = translate("startAt");
    endAtLabel = translate("endAt");
    gachaTypeLabel = translate("gachaTypeLabel");
    noGachaDataLabel = translate("noGachaData");
    imageUnavailableLabel = translate("imageUnavailable");
    closeLabel = translate("closeLabel");
    gachaInfoTitle = translate("gachaInfoTitle");
    internalResourceCodeLabel = translate("internalResourceCodeLabel");
    gachaCountdownTitle = translate("gachaCountdownTitle");
    logoLabel = translate("gachaAssetTabs.logo");
    bannerLabel = translate("assetTab.banner");
    backgroundLabel = translate("assetTab.background");
    backgroundUnavailableLabel = translate("gachaBackgroundUnavailable");
    bannerAltSuffix = translate("bannerAltSuffix");
    pickupTitle = translate("gachaPickupTitle");
    gachaPickupWeight = translate("gachaPickupWeight");
    gachaNoPickups = translate("gachaNoPickups");
    cardImageAltSuffix = translate("cardImageAltSuffix");
    gachaSummaryLabel = translate("gachaSummary");
    gachaRarityRateTitle = translate("gachaRarityRateTitle");
    gachaNoRarityRates = translate("gachaNoRarityRates");
    probabilityOpenLabel = translate("gachaProbabilityOpen");
    probabilityTitle = translate("gachaProbabilityTitle");
    probabilityCloseLabel = translate("gachaProbabilityClose");
    probabilityInfoLabel = translate("gachaProbabilityInfoLabel");
    probabilityDisclaimer = translate("gachaProbabilityDisclaimer");
    probabilityNormalLabel = translate("gachaProbabilityNormal");
    probabilityWishLabel = translate("gachaProbabilityWish");
    probabilityUnavailableLabel = translate("gachaProbabilityUnavailable");
    probabilityLoadingLabel = translate("gachaProbabilityLoading");
    probabilityLoadFailedLabel = translate("gachaProbabilityLoadFailed");
    probabilityRetryLabel = translate("listRetry");
    probabilityConditionalLabel = translate("gachaProbabilityConditional");
    probabilityCardIdLabel = translate("gachaProbabilityCardId");
    probabilityDiagnosticLabels = Object.fromEntries(
      [
        "missing-card-id",
        "missing-card-rarity",
        "unsupported-lottery-type",
        "unmatched-card-semantics",
        "invalid-weight",
        "invalid-rate",
        "rate-conflict",
        "empty-pool",
        "incomplete-metadata",
        "invalid-rate-choice"
      ].map((key) => [key, translate(`gachaProbabilityDiagnostic.${key}`)])
    );
    rarityLabels = buildRarityLabelMap(translate);
    rarityUnknownLabel = translate("gachaRarityUnknown");
    rarityRateChoiceNote = translate("gachaRarityRateChoiceNote");
    gachaBehaviorTitle = translate("gachaBehaviorTitle");
    gachaNoBehaviors = translate("gachaNoBehaviors");
    gachaBehaviorSpinCount = translate("gachaBehaviorSpinCount");
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
    const translate = createI18nTranslator(data.uiLocale, currentMessages);
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

  const refreshTranslations = async (
    localeValue: string,
    messagesOrPromise: typeof data.i18nMessages,
    requestId: number
  ): Promise<void> => {
    let messages: Record<string, string>;
    try {
      messages = await messagesOrPromise;
    } catch {
      return;
    }
    if (requestId !== translationRequestId) return;
    const locale = localeValue;
    applyTranslations(createI18nTranslator(locale, messages));
    currentMessages = messages;
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

<section use:swipeRegion class="content-page-shell gap-4 px-2">
  {#await data.gachaPayload}
    <PageHeader
      breadcrumbs={getBreadcrumbItems(`${pageTitlePrefix} ${data.gachaId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        <RegionBadgeSwitch options={getCurrentRegionBadgeOption()} />
      {/snippet}
    </PageHeader>

    <DetailPageSkeleton kind="gacha" />
  {:then payload}
    <PageHeader
      breadcrumbs={getBreadcrumbItems(payload.gacha?.name ?? `${pageTitlePrefix} ${data.gachaId}`)}
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
        class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)]"
      >
        <div class="flex flex-col gap-4">
          <GachaDetailAssetCard
            gacha={payload.gacha}
            region={data.region}
            bind:activeTab={activeAssetTab}
            {logoLabel}
            {bannerLabel}
            {backgroundLabel}
            {backgroundUnavailableLabel}
            {bannerAltSuffix}
            {imageUnavailableLabel}
            {closeLabel}
          />

          <GachaDetailInfoCard
            gacha={payload.gacha}
            uiLocale={displayLocale || data.uiLocale}
            title={gachaInfoTitle}
            {idLabel}
            {internalResourceCodeLabel}
            {nameLabel}
            {gachaTypeLabel}
            {gachaTypeMap}
            {startAtLabel}
            {endAtLabel}
            {noGachaDataLabel}
          />

          <GachaDetailCountdownCard
            messages={currentMessages}
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
                <div class="content-card-inset rounded-xl p-3 sm:px-4">
                  <p class="text-sm/7 opacity-90">{payload.gacha.summary}</p>
                </div>
              </div>
            </article>
          {/if}
        </div>

        <div class="flex flex-col gap-4">
          <div class="grid min-w-0 gap-4 xl:grid-cols-2">
            <div class="min-w-0">
              <GachaDetailPickupCard
                pickupCards={payload.pickupCards}
                region={data.region}
                title={pickupTitle}
                weightLabel={gachaPickupWeight}
                noPickupsLabel={gachaNoPickups}
                cardAltSuffix={cardImageAltSuffix}
              />
            </div>

            {#if payload.gacha.gachaCardRarityRates}
              <div class="min-w-0">
                <GachaDetailRarityRateCard
                  rates={payload.gacha.gachaCardRarityRates}
                  title={gachaRarityRateTitle}
                  noRatesLabel={gachaNoRarityRates}
                  {lotteryTypeMap}
                  {rarityUnknownLabel}
                  rateChoiceExplanation={rarityRateChoiceNote}
                  region={data.region}
                  gachaId={data.gachaId}
                  {probabilityOpenLabel}
                  {probabilityTitle}
                  {probabilityCloseLabel}
                  {probabilityInfoLabel}
                  {probabilityDisclaimer}
                  {probabilityNormalLabel}
                  {probabilityWishLabel}
                  {probabilityUnavailableLabel}
                  {probabilityLoadingLabel}
                  {probabilityLoadFailedLabel}
                  {probabilityRetryLabel}
                  {probabilityConditionalLabel}
                  cardIdLabel={probabilityCardIdLabel}
                  diagnosticLabels={probabilityDiagnosticLabels}
                  {rarityLabels}
                  cardAltSuffix={cardImageAltSuffix}
                />
              </div>
            {/if}
          </div>

          {#if payload.gacha.gachaBehaviors}
            <GachaDetailBehaviorCard
              behaviors={payload.gacha.gachaBehaviors}
              title={gachaBehaviorTitle}
              noBehaviorsLabel={gachaNoBehaviors}
              spinCountLabel={gachaBehaviorSpinCount}
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
            {@const displayDesc =
              !needsTruncation || descriptionExpanded
                ? desc
                : desc.slice(0, DESCRIPTION_COLLAPSED_LENGTH) + "…"}
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
                <div class="content-card-inset rounded-xl p-3 sm:px-4">
                  <p class="text-sm/7 whitespace-pre-line opacity-90">{displayDesc}</p>
                  {#if needsTruncation}
                    <button
                      onclick={() => (descriptionExpanded = !descriptionExpanded)}
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
