<script lang="ts">
  import Icon from "@iconify/svelte";
  import { createI18nTranslator, setI18nLocale, tCommon } from "$lib/i18n/runtime";
  import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";
  import {
    getCardThumbnailAssetURL,
    getMusicJacketAssetURL,
    getGachaBannerAssetURL
  } from "$lib/assets";
  import CurrentEventCard from "$lib/components/event/CurrentEventCard.svelte";
  import RegionBadgeSwitch from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, data.i18nMessages)(key);
  let idLabel = $state(getInitialI18nText("idLabel"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  let noEventLabel = $state(getInitialI18nText("noCurrentEventData"));
  let disclaimerText = $state(getInitialI18nText("disclaimer"));
  let latestDataEventsLabel = $state(getInitialI18nText("latestData.events"));
  let mixedUnitLabel = $state(getInitialI18nText("mixedUnitLabel"));
  let versionInfoTitle = $state(getInitialI18nText("versionInfo.title"));
  let versionAppLabel = $state(getInitialI18nText("versionInfo.appLabel"));
  let versionDataLabel = $state(getInitialI18nText("versionInfo.dataLabel"));
  let versionAssetLabel = $state(getInitialI18nText("versionInfo.assetLabel"));
  let latestDataTitle = $state(getInitialI18nText("latestData.title"));
  let latestDataCardsLabel = $state(getInitialI18nText("latestData.cards"));
  let latestDataMusicsLabel = $state(getInitialI18nText("latestData.musics"));
  let latestDataGachasLabel = $state(getInitialI18nText("latestData.gachas"));
  let latestDataNoData = $state(getInitialI18nText("latestData.noData"));
  let latestDataViewAll = $state(getInitialI18nText("latestData.viewAll"));
  let latestDataLoadFailed = $state(getInitialI18nText("latestData.loadFailed"));
  let swipeHint = $state(getInitialI18nText("swipeHint"));

  // ── Region state ───────────────────────────────────────────────────
  const REGION_STORAGE_KEY = "home-region";

  const getSavedRegion = (): SupportedRegion => {
    if (typeof localStorage === "undefined") return supportedRegions[0];
    const saved = localStorage.getItem(REGION_STORAGE_KEY);
    if (saved && (supportedRegions as readonly string[]).includes(saved)) {
      return saved as SupportedRegion;
    }
    return supportedRegions[0];
  };

  let selectedRegion = $state<SupportedRegion>(getSavedRegion());

  const selectRegion = (r: SupportedRegion): void => {
    selectedRegion = r;
    localStorage.setItem(REGION_STORAGE_KEY, r);
  };

  // ── Swipe detection for region switching ───────────────────────────
  const SWIPE_THRESHOLD = 50;
  let touchStartX = 0;
  let touchStartY = 0;

  const onTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  };

  const onTouchEnd = (e: TouchEvent): void => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = Math.abs(touch.clientY - touchStartY);

    if (Math.abs(dx) < SWIPE_THRESHOLD || dy > Math.abs(dx)) {
      return;
    }

    const currentIndex = supportedRegions.indexOf(selectedRegion);
    if (dx < 0) {
      if (currentIndex < supportedRegions.length - 1) {
        selectRegion(supportedRegions[currentIndex + 1]);
      }
    } else {
      if (currentIndex > 0) {
        selectRegion(supportedRegions[currentIndex - 1]);
      }
    }
  };

  // ── i18n ───────────────────────────────────────────────────────────
  $effect(() => {
    const translate = createI18nTranslator(data.uiLocale, data.i18nMessages);
    applyTranslations(translate);
    void refreshPageTranslations(data.uiLocale);
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    idLabel = translate("idLabel");
    bannerAltSuffix = translate("bannerAltSuffix");
    noEventLabel = translate("noCurrentEventData");
    disclaimerText = translate("disclaimer");
    mixedUnitLabel = translate("mixedUnitLabel");
    versionInfoTitle = translate("versionInfo.title");
    versionAppLabel = translate("versionInfo.appLabel");
    versionDataLabel = translate("versionInfo.dataLabel");
    versionAssetLabel = translate("versionInfo.assetLabel");
    latestDataTitle = translate("latestData.title");
    latestDataCardsLabel = translate("latestData.cards");
    latestDataMusicsLabel = translate("latestData.musics");
    latestDataGachasLabel = translate("latestData.gachas");
    latestDataEventsLabel = translate("latestData.events");
    latestDataNoData = translate("latestData.noData");
    latestDataViewAll = translate("latestData.viewAll");
    latestDataLoadFailed = translate("latestData.loadFailed");
    swipeHint = translate("swipeHint");
  };

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, data.i18nMessages);
    applyTranslations((key) => tCommon(locale, key));
  };

  // ── Helpers ────────────────────────────────────────────────────────
  const isNuverseRegion = (region: SupportedRegion): boolean =>
    region === "tw" || region === "kr" || region === "cn";

  const getDisplayAssetVersion = (
    region: SupportedRegion,
    versions: { assetVersion: string | null; cdnVersion?: string | null } | null | undefined
  ): string | null => {
    if (!versions?.assetVersion) {
      return null;
    }

    if (isNuverseRegion(region) && versions.cdnVersion) {
      return `${versions.assetVersion} - ${versions.cdnVersion}`;
    }

    return versions.assetVersion;
  };

  const getDisplayDataVersion = (
    versions: { dataVersion: string | null } | null | undefined
  ): string | null => {
    return versions?.dataVersion ?? null;
  };

  // ── Derived data for selected region ───────────────────────────────
  const regionIndex = $derived(supportedRegions.indexOf(selectedRegion));
  const latestDataPromise = $derived(data.latestData[regionIndex]);
  const currentEventPromise = $derived(data.cards[regionIndex]);
</script>

<div class="-mt-6 mb-10 flex justify-center px-2">
  <div
    class="flex max-w-3xl gap-3 rounded-xl border border-info/25 bg-info/8 px-4 py-3 text-base-content/70"
  >
    <Icon icon="mdi:information-outline" class="mt-0.5 size-4 shrink-0 text-info/80" />
    <p class="text-xs/relaxed">{disclaimerText}</p>
  </div>
</div>

<!-- ──── Region-switchable data area ────────────────────────────────── -->
<section
  role="group"
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}
>
  <!-- Region selector (shared for both sections) -->
  <div class="mb-6 flex flex-wrap justify-center gap-2">
    <RegionBadgeSwitch
      options={supportedRegions.map((r) =>
        r === selectedRegion
          ? { key: r, label: r.toUpperCase(), active: true }
          : { key: r, label: r.toUpperCase(), active: false, onclick: () => selectRegion(r) }
      )}
    />
  </div>
  <!-- Swipe hint (mobile only) -->
  <p class="md:hidden mb-4 flex items-center justify-center gap-1.5 text-xs text-base-content/50">
    <Icon icon="mdi:gesture-swipe-horizontal" class="size-4" />
    {swipeHint}
  </p>

  <!-- Latest Data section (unified: grid + current event as sub-block) -->
  <section class="mb-8">
    <h2 class="mb-5 text-center text-base font-semibold tracking-wide text-base-content/70">
      {latestDataTitle}
    </h2>
    {#if latestDataPromise}
      {#await latestDataPromise}
<div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-3">
	          {#each [1, 2, 3] as _}
	            <div class="space-y-3">
	              <div class="h-5 w-24 animate-pulse rounded bg-base-300"></div>
	              <div class="grid grid-cols-3 gap-3 lg:grid-cols-4">
	                {#each [1, 2, 3, 4] as __}
	                  <div class="aspect-square animate-pulse rounded-xl bg-base-300"></div>
	                {/each}
	              </div>
	            </div>
	          {/each}
	        </div>
      {:then regionData}
        {#if regionData.cards.length === 0 && regionData.musics.length === 0 && regionData.gachas.length === 0}
          <p class="text-center text-sm text-base-content/60">{latestDataNoData}</p>
        {:else}
          <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <h3 class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70">
                <span class="flex items-center gap-2">
                  <Icon icon="mdi:cards-outline" class="size-4" aria-hidden="true" />
                  {latestDataCardsLabel}
                </span>
                <a href="/cards/{regionData.region}" class="btn btn-xs btn-ghost gap-1 text-xs text-base-content/50 hover:text-primary">
                  {latestDataViewAll}
                  <Icon icon="mdi:arrow-right" class="size-3" aria-hidden="true" />
                </a>
              </h3>
              {#if regionData.cards.length > 0}
	                <div class="grid grid-cols-3 gap-3 lg:grid-cols-4">
                  {#each regionData.cards as card (card.id)}
                    <a
                      href="/card/{regionData.region}/{card.id}"
                      class="group/card block"
                    >
                      <CardThumbnail
                        src={card.assetBundleName ? getCardThumbnailAssetURL(card.assetBundleName, false, "jp") : null}
                        alt={card.prefix ?? card.id}
                        fallbackLabel={card.id}
                        fallbackSrc={card.assetBundleName ? getCardThumbnailAssetURL(card.assetBundleName, false, regionData.region) : null}
                        attr={card.attr}
                        rarityType={card.rarityType}
                        rarityCount={card.rarityCount}
                        showFrame={true}
                        showIcons={true}
                        maxSize={null}
                        containerClass="relative overflow-hidden rounded-xl bg-base-200 aspect-square"
                        imageClass="size-full object-cover transition-transform duration-200 group-hover/card:scale-105"
                      />
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-base-content/50">{latestDataNoData}</p>
              {/if}
            </div>

            <div>
              <h3 class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70">
                <span class="flex items-center gap-2">
                  <Icon icon="mdi:music-note-eighth" class="size-4" aria-hidden="true" />
                  {latestDataMusicsLabel}
                </span>
                <a href="/musics/{regionData.region}" class="btn btn-xs btn-ghost gap-1 text-xs text-base-content/50 hover:text-primary">
                  {latestDataViewAll}
                  <Icon icon="mdi:arrow-right" class="size-3" aria-hidden="true" />
                </a>
              </h3>
              {#if regionData.musics.length > 0}
	                <div class="grid grid-cols-3 gap-3 lg:grid-cols-4">
                  {#each regionData.musics as music (music.id)}
                    <a
                      href="/music/{regionData.region}/{music.id}"
                      class="group/music block overflow-hidden rounded-xl border border-base-content/10 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div class="relative aspect-square overflow-hidden">
                        {#if music.assetBundleName}
                          <EventAssetImage
                            src={getMusicJacketAssetURL(music.assetBundleName)}
                            alt={music.title ?? music.id}
                            loadMode="visible"
                            imageClass="size-full object-cover transition-transform duration-200 group-hover/music:scale-105"
                            buttonClass="block size-full"
                          />
                        {:else}
                          <div class="flex size-full items-center justify-center bg-base-300/40 text-xs text-base-content/50">
                            {music.id}
                          </div>
                        {/if}
                      </div>
                      <div class="px-2 py-2">
                        <p class="line-clamp-2 text-xs font-medium leading-snug">{music.title ?? music.id}</p>
                        {#if music.composer}
                          <p class="mt-0.5 truncate text-[10px] text-base-content/50">{music.composer}</p>
                        {/if}
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-base-content/50">{latestDataNoData}</p>
              {/if}
            </div>

            <div>
              <h3 class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70">
                <span class="flex items-center gap-2">
                  <Icon icon="mdi:gift-outline" class="size-4" aria-hidden="true" />
                  {latestDataGachasLabel}
                </span>
                <a href="/gachas/{regionData.region}" class="btn btn-xs btn-ghost gap-1 text-xs text-base-content/50 hover:text-primary">
                  {latestDataViewAll}
                  <Icon icon="mdi:arrow-right" class="size-3" aria-hidden="true" />
                </a>
              </h3>
              {#if regionData.gachas.length > 0}
                <ul class="space-y-3">
                  {#each regionData.gachas as gacha (gacha.id)}
                    <li>
                      <a
                        href="/gacha/{regionData.region}/{gacha.id}"
                        class="block overflow-hidden rounded-lg border border-base-content/8 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div class="aspect-[3/1] w-full bg-base-200 pt-2">
                          <EventAssetImage
                            src={getGachaBannerAssetURL(gacha.id, "jp")}
                            alt={gacha.name ?? gacha.id}
                            loadMode="visible"
                            imageClass="size-full object-contain"
                            buttonClass="block size-full"
                          />
                        </div>
                        <div class="px-3 py-2">
                          <p class="truncate text-sm font-medium">{gacha.name ?? gacha.id}</p>
                        </div>
                      </a>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="text-xs text-base-content/50">{latestDataNoData}</p>
              {/if}
            </div>
          </div>
        {/if}
      {:catch _}
        <p class="text-center text-sm text-error">{latestDataLoadFailed}</p>
      {/await}
    {/if}

    <!-- Events sub-block (inside Latest Data section) -->
    <div class="mx-auto mt-8 max-w-7xl">
      <h3 class="mb-4 flex items-center justify-between text-sm font-semibold text-base-content/70">
        <span class="flex items-center gap-2">
          <Icon icon="mdi:calendar-clock" class="size-4" aria-hidden="true" />
          {latestDataEventsLabel}
        </span>
        <a href="/events/{selectedRegion}" class="btn btn-xs btn-ghost gap-1 text-xs text-base-content/50 hover:text-primary">
          {latestDataViewAll}
          <Icon icon="mdi:arrow-right" class="size-3" aria-hidden="true" />
        </a>
      </h3>
      {#await currentEventPromise}
        <article class="card content-card-shell mx-auto max-w-sm w-full shadow-sm">
          <div class="card-body">
            <div class="mb-2 h-4 w-1/3 animate-pulse rounded bg-base-300 md:mb-3"></div>
            <div class="space-y-2">
              <div class="h-4 w-full animate-pulse rounded bg-base-300"></div>
              <div class="h-4 w-2/3 animate-pulse rounded bg-base-300"></div>
            </div>
          </div>
        </article>
      {:then card}
        {#if card.event}
          <CurrentEventCard
            region={card.region}
            regionLabel={card.label}
            event={card.event}
            uiLocale={data.uiLocale}
            {idLabel}
            {mixedUnitLabel}
            unitProfiles={card.unitProfiles}
            {bannerAltSuffix}
          />
        {:else}
          <article class="card content-card-shell mx-auto max-w-sm w-full shadow-sm">
            <div class="card-body">
              <div class="mb-2 text-sm opacity-70 md:mb-3">{card.label}</div>
              {#if card.error}
                <p class="text-sm text-error">{card.error}</p>
              {:else}
                <p class="text-sm opacity-70">{noEventLabel}</p>
              {/if}
            </div>
          </article>
        {/if}
      {:catch _}
        <article class="card content-card-shell mx-auto max-w-sm w-full shadow-sm">
          <div class="card-body">
            <p class="text-sm text-error">{noEventLabel}</p>
          </div>
        </article>
      {/await}
    </div>
  </section>
</section>

<!-- ──── Version Info (standalone, below data area) ─────────────────── -->
<section class="mt-10">
  <h2 class="mb-4 text-center text-base font-semibold tracking-wide text-base-content/70">
    {versionInfoTitle}
  </h2>
  <div class="mx-auto max-w-5xl overflow-x-auto rounded-xl border border-base-content/10">
    <table class="table table-sm w-full">
      <thead>
        <tr class="text-xs uppercase tracking-wider text-base-content/50">
          <th></th>
          <th>{versionAppLabel}</th>
          <th>{versionDataLabel}</th>
          <th>{versionAssetLabel}</th>
        </tr>
      </thead>
      <tbody>
        {#each supportedRegions as region, index (region)}
          {#await data.cards[index]}
            <tr>
              <td
                ><span
                  class="badge badge-sm homepage-region-badge version-region-badge font-semibold"
                  >{region.toUpperCase()}</span
                ></td
              >
              <td><span class="inline-block h-3 w-16 animate-pulse rounded bg-base-300"></span></td>
              <td><span class="inline-block h-3 w-20 animate-pulse rounded bg-base-300"></span></td>
              <td><span class="inline-block h-3 w-20 animate-pulse rounded bg-base-300"></span></td>
            </tr>
          {:then card}
            <tr>
              <td
                ><span
                  class="badge badge-sm homepage-region-badge version-region-badge font-semibold"
                  >{card.region.toUpperCase()}</span
                ></td
              >
              <td class="font-mono text-xs">{card.versions?.appVersion ?? "—"}</td>
              <td class="font-mono text-xs">{getDisplayDataVersion(card.versions) ?? "—"}</td>
              <td class="font-mono text-xs"
                >{getDisplayAssetVersion(card.region, card.versions) ?? "—"}</td
              >
            </tr>
          {/await}
        {/each}
      </tbody>
     </table>
   </div>
</section>
