<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/domain/regions";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import MusicDetailInfoCard from "$lib/components/music/MusicDetailInfoCard.svelte";
  import MusicPreviewCard from "$lib/components/music/MusicPreviewCard.svelte";
  import MusicJacketHero from "$lib/components/music/MusicJacketHero.svelte";
  import { createI18nTranslator, setI18nLocale, tCommon } from "$lib/i18n/runtime";
  import {
    formatUnitFallbackLabel,
    unitCodeByMusicTag
  } from "$lib/domain/unit-profile";
  import { getMusicJacketAssetURL } from "$lib/assets/index";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, data.i18nMessages)(key);

  let displayLocale = $state<string>("");

  let homeLabel = $state(getInitialI18nText("home"));
  let musicListTitle = $state(getInitialI18nText("musicListTitle"));
  let idLabel = $state(getInitialI18nText("idLabel"));
  let nameLabel = $state(getInitialI18nText("nameLabel"));
  let musicTitlePrefix = $state(getInitialI18nText("pageTitle.musicPrefix"));
  let musicDetailInfoTitle = $state(getInitialI18nText("musicDetailInfoTitle"));
  let composerLabel = $state(getInitialI18nText("musicDetailComposerLabel"));
  let arrangerLabel = $state(getInitialI18nText("musicDetailArrangerLabel"));
  let lyricistLabel = $state(getInitialI18nText("musicDetailLyricistLabel"));
  let difficultyLabel = $state(getInitialI18nText("musicDetailDifficultyLabel"));
  let levelLabel = $state(getInitialI18nText("musicDetailLevelLabel"));
  let noteCountLabel = $state(getInitialI18nText("musicDetailNoteCountLabel"));
  let categoryLabel = $state(getInitialI18nText("musicDetailCategoryLabel"));
  let tagLabel = $state(getInitialI18nText("musicDetailTagLabel"));
  let publishedAtLabel = $state(getInitialI18nText("musicDetailPublishedAtLabel"));
  let vocalLabel = $state(getInitialI18nText("musicDetailVocalLabel"));
  let vocalTypeLabel = $state(getInitialI18nText("musicDetailVocalTypeLabel"));
  let vocalCharacterLabel = $state(getInitialI18nText("musicDetailVocalCharacterLabel"));
  let noVocals = $state(getInitialI18nText("musicDetailNoVocals"));
  let noDifficulties = $state(getInitialI18nText("musicDetailNoDifficulties"));
  let jacketAltSuffix = $state(getInitialI18nText("musicJacketAltSuffix"));
  let imageUnavailableLabel = $state(getInitialI18nText("imageUnavailable"));
  let closeLabel = $state(getInitialI18nText("closeLabel"));
  let noMusicLabel = $state(getInitialI18nText("failedToLoadMusicData"));
  let musicPreviewShortLabel = $state(getInitialI18nText("musicPreviewShortLabel"));
  let musicPreviewLongLabel = $state(getInitialI18nText("musicPreviewLongLabel"));
  let musicPreviewNoPreviewAvailable = $state(getInitialI18nText("musicPreviewNoPreviewAvailable"));
  let musicPreviewPlayLabel = $state(getInitialI18nText("musicPreviewPlayLabel"));
  let musicPreviewPauseLabel = $state(getInitialI18nText("musicPreviewPauseLabel"));
  let audioDownloadLabel = $state(getInitialI18nText("audioDownloadLabel"));
  let audioDownloadCloseLabel = $state(getInitialI18nText("audioDownloadCloseLabel"));
  let audioVolumeLabel = $state(getInitialI18nText("audioVolumeLabel"));
  let audioSeekLabel = $state(getInitialI18nText("audioSeekLabel"));
  let audioUnavailableLabel = $state(getInitialI18nText("audioUnavailableLabel"));
  let audioDownloadProgressMessages = $state({
    preparing: getInitialI18nText("audioDownloadStages.preparing"),
    fetchingAudio: getInitialI18nText("audioDownloadStages.fetchingAudio"),
    fetchingCover: getInitialI18nText("audioDownloadStages.fetchingCover"),
    writingMetadata: getInitialI18nText("audioDownloadStages.writingMetadata"),
    finalizing: getInitialI18nText("audioDownloadStages.finalizing"),
    ready: getInitialI18nText("audioDownloadStages.ready"),
    failed: getInitialI18nText("audioDownloadStages.failed"),
    cancelled: getInitialI18nText("audioDownloadStages.cancelled")
  });

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

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    musicListTitle = translate("musicListTitle");
    idLabel = translate("idLabel");
    nameLabel = translate("nameLabel");
    musicTitlePrefix = translate("pageTitle.musicPrefix");
    musicDetailInfoTitle = translate("musicDetailInfoTitle");
    composerLabel = translate("musicDetailComposerLabel");
    arrangerLabel = translate("musicDetailArrangerLabel");
    lyricistLabel = translate("musicDetailLyricistLabel");
    difficultyLabel = translate("musicDetailDifficultyLabel");
    levelLabel = translate("musicDetailLevelLabel");
    noteCountLabel = translate("musicDetailNoteCountLabel");
    categoryLabel = translate("musicDetailCategoryLabel");
    tagLabel = translate("musicDetailTagLabel");
    publishedAtLabel = translate("musicDetailPublishedAtLabel");
    vocalLabel = translate("musicDetailVocalLabel");
    vocalTypeLabel = translate("musicDetailVocalTypeLabel");
    vocalCharacterLabel = translate("musicDetailVocalCharacterLabel");
    noVocals = translate("musicDetailNoVocals");
    noDifficulties = translate("musicDetailNoDifficulties");
    jacketAltSuffix = translate("musicJacketAltSuffix");
    imageUnavailableLabel = translate("imageUnavailable");
    closeLabel = translate("closeLabel");
    noMusicLabel = translate("failedToLoadMusicData");
    musicPreviewShortLabel = translate("musicPreviewShortLabel");
    musicPreviewLongLabel = translate("musicPreviewLongLabel");
    musicPreviewNoPreviewAvailable = translate("musicPreviewNoPreviewAvailable");
    musicPreviewPlayLabel = translate("musicPreviewPlayLabel");
    musicPreviewPauseLabel = translate("musicPreviewPauseLabel");
    audioDownloadLabel = translate("audioDownloadLabel");
    audioDownloadCloseLabel = translate("audioDownloadCloseLabel");
    audioVolumeLabel = translate("audioVolumeLabel");
    audioSeekLabel = translate("audioSeekLabel");
    audioUnavailableLabel = translate("audioUnavailableLabel");
    audioDownloadProgressMessages = {
      preparing: translate("audioDownloadStages.preparing"),
      fetchingAudio: translate("audioDownloadStages.fetchingAudio"),
      fetchingCover: translate("audioDownloadStages.fetchingCover"),
      writingMetadata: translate("audioDownloadStages.writingMetadata"),
      finalizing: translate("audioDownloadStages.finalizing"),
      ready: translate("audioDownloadStages.ready"),
      failed: translate("audioDownloadStages.failed"),
      cancelled: translate("audioDownloadStages.cancelled")
    };
  };

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, data.i18nMessages);
    applyTranslations((key) => tCommon(locale, key));
  };

  const getCategoryLabel = (category: string): string =>
    tCommon(data.uiLocale, `musicListCategory.${category}`, category);

  const getTagLabel = (value: string): string =>
    unitCodeByMusicTag[value]
      ? (data.unitProfiles[unitCodeByMusicTag[value]] ??
        formatUnitFallbackLabel(unitCodeByMusicTag[value]))
      : tCommon(data.uiLocale, `musicListTag.${value}`, value);

  const getDifficultyLabel = (difficulty: string): string =>
    tCommon(data.uiLocale, `musicDifficulty.${difficulty}`, difficulty);

  const regionDisplayOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];

  const getRegionOptions = (availableRegions: SupportedRegion[]): SupportedRegion[] =>
    regionDisplayOrder.filter(
      (regionOption) => availableRegions.includes(regionOption) || regionOption === data.region
    );

  const getMusicListHref = (): string => resolve("/musics/[region]", { region: data.region });

  const getMusicBreadcrumbItems = (currentLabel: string) => [
    { label: homeLabel, href: resolve("/") },
    { label: musicListTitle, href: getMusicListHref() },
    { label: currentLabel }
  ];

  const getRegionBadgeOptions = (regionOptions: SupportedRegion[]): RegionBadgeOption[] =>
    regionOptions.map((regionOption) =>
      regionOption === data.region
        ? { key: regionOption, label: regionOption.toUpperCase(), active: true }
        : {
            key: regionOption,
            label: regionOption.toUpperCase(),
            href: resolve("/musics/[region]/[id]", { region: regionOption, id: data.musicId }),
            active: false
          }
    );

  const getCurrentRegionBadgeOption = (): RegionBadgeOption[] => [
    { key: data.region, label: data.region.toUpperCase(), active: true }
  ];

  const hasAlternativeRegion = (availableRegions: SupportedRegion[]): boolean =>
    availableRegions.some((regionOption) => regionOption !== data.region);

  const getUnavailableError = (availableRegions: SupportedRegion[]): string =>
    hasAlternativeRegion(availableRegions)
      ? data.musicUnavailableInCurrentRegionMessage ?? noMusicLabel
      : data.failedToLoadMusicDataMessage ?? noMusicLabel;
</script>

<svelte:head>
  {#await data.musicPayload}
    <title>{musicTitlePrefix} {data.musicId} - Sekai Viewer</title>
  {:then payload}
    <title>
      {payload.music
        ? `${payload.music.title} - Sekai Viewer`
        : `${musicTitlePrefix} ${data.musicId} - Sekai Viewer`}
    </title>
  {:catch}
    <title>{musicTitlePrefix} {data.musicId} - Sekai Viewer</title>
  {/await}
</svelte:head>

<section class="mx-auto flex w-full max-w-400 flex-col gap-4 px-4">
  {#await data.musicPayload}
    <PageHeader
      breadcrumbs={getMusicBreadcrumbItems(`${musicTitlePrefix} ${data.musicId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}
        <RegionBadgeSwitch options={getCurrentRegionBadgeOption()} />
      {/snippet}
    </PageHeader>

    <div class="aspect-square w-full animate-pulse rounded-2xl bg-base-300"></div>

    <div
      class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
    >
      <article class="card content-card-shell overflow-hidden shadow-sm">
        <div class="card-body gap-4 p-5">
          <div class="h-9 w-full animate-pulse rounded-xl bg-base-300"></div>
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
          </div>
        </div>
      </article>
    </div>
  {:then payload}
    <PageHeader
      breadcrumbs={getMusicBreadcrumbItems(
        payload.music?.title ?? `${musicTitlePrefix} ${data.musicId}`
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

    {#if payload.music}
      <MusicJacketHero
        music={payload.music}
        region={data.region}
        {jacketAltSuffix}
        {imageUnavailableLabel}
        {closeLabel}
      />
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
      >
        <div class="flex flex-col gap-4">
          <MusicDetailInfoCard
            music={payload.music}
            {displayLocale}
            title={musicDetailInfoTitle}
            {idLabel}
            {nameLabel}
            {composerLabel}
            {arrangerLabel}
            {lyricistLabel}
            {difficultyLabel}
            {levelLabel}
            {noteCountLabel}
            {categoryLabel}
            {tagLabel}
            {publishedAtLabel}
            {noDifficulties}
            {getCategoryLabel}
            {getTagLabel}
            {getDifficultyLabel}
          />
          <MusicPreviewCard
            vocals={payload.music.vocals}
            region={data.region}
            musicId={data.musicId}
            title={payload.music.title}
            jacketUrl={payload.music.assetBundleName ? getMusicJacketAssetURL(payload.music.assetBundleName, data.region) : undefined}
            artist={payload.music.composer ?? undefined}
            fillerSec={payload.music.fillerSec}
            vocalLabel={vocalLabel}
            vocalTypeLabel={vocalTypeLabel}
            vocalCharacterLabel={vocalCharacterLabel}
            noVocalsLabel={noVocals}
            shortPreviewLabel={musicPreviewShortLabel}
            longPreviewLabel={musicPreviewLongLabel}
            noPreviewAvailableLabel={musicPreviewNoPreviewAvailable}
            downloadProgressMessages={audioDownloadProgressMessages}
            playLabel={musicPreviewPlayLabel}
            pauseLabel={musicPreviewPauseLabel}
            downloadLabel={audioDownloadLabel}
            downloadCloseLabel={audioDownloadCloseLabel}
            volumeLabel={audioVolumeLabel}
            seekLabel={audioSeekLabel}
            unavailableLabel={audioUnavailableLabel}
          />
        </div>
      </div>
    {:else if !payload.error}
      {#await data.availableRegions}
        <div class="alert">
          <span class="loading loading-spinner loading-sm"></span>
          {noMusicLabel}
        </div>
      {:then availableRegions}
        <div class="alert alert-error">{getUnavailableError(availableRegions)}</div>
      {/await}
    {/if}
  {/await}
</section>
