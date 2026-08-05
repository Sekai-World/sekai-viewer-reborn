<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";
  import {
    DEFAULT_REGION,
    normalizeRegion,
    PREFERRED_REGION_CHANGE_EVENT,
    PREFERRED_REGION_STORAGE_KEY,
    persistPreferredRegion,
    resolvePreferredRegion
  } from "$lib/i18n/region";
  import {
    getCardThumbnailAssetURL,
    getMusicJacketAssetURL,
    getGachaBannerAssetURL,
    getGachaLogoAssetURL
  } from "$lib/assets";
  import CurrentEventCard from "$lib/components/event/CurrentEventCard.svelte";
  import RegionBadgeSwitch from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import {
    EVENT_CARD_BODY_CLASS,
    EVENT_CARD_MEDIA_CLASS,
    EVENT_CARD_SURFACE_CLASS
  } from "$lib/styles/event-card";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const getInitialMessages = (): Record<string, string> =>
    resolveStreamingMessages(data.i18nMessages, ["common", "home", "event", "error"]);
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, getInitialMessages())(key);
  let idLabel = $state(getInitialI18nText("idLabel"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  let latestDataLoadingEvents = $state(getInitialI18nText("latestData.loadingEvents"));
  let noEventLabel = $state(getInitialI18nText("noCurrentEventData"));
  let disclaimerText = $state(getInitialI18nText("disclaimer"));
  let mixedUnitLabel = $state(getInitialI18nText("mixedUnitLabel"));
  let footerBrandLabel = $state(getInitialI18nText("footer.brand"));
  let footerDescription = $state(getInitialI18nText("footer.description"));
  let versionInfoTitle = $state(getInitialI18nText("versionInfo.title"));
  let versionAppLabel = $state(getInitialI18nText("versionInfo.appLabel"));
  let versionDataLabel = $state(getInitialI18nText("versionInfo.dataLabel"));
  let versionAssetLabel = $state(getInitialI18nText("versionInfo.assetLabel"));
  let latestDataTitle = $state(getInitialI18nText("latestData.title"));
  let latestDataCardsLabel = $state(getInitialI18nText("latestData.cards"));
  let latestDataMusicsLabel = $state(getInitialI18nText("latestData.musics"));
  let latestDataGachasLabel = $state(getInitialI18nText("latestData.gachas"));
  let latestDataEventsLabel = $state(getInitialI18nText("latestData.events"));
  let latestDataNoData = $state(getInitialI18nText("latestData.noData"));
  let latestDataViewAll = $state(getInitialI18nText("latestData.viewAll"));
  let latestDataLoadFailed = $state(getInitialI18nText("latestData.loadFailed"));
  let directoryTitle = $state(getInitialI18nText("directory.title"));
  let directoryDescription = $state(getInitialI18nText("directory.description"));
  let gameContentRegionLabel = $state(getInitialI18nText("settings.gameContentRegion"));
  let gameContentRegionDescription = $state(
    getInitialI18nText("settings.gameContentRegionDescription")
  );
  let translationRequestId = 0;
  let currentMessages = $state<Record<string, string>>(getInitialMessages());
  let currentTranslate = $derived(createI18nTranslator(data.uiLocale, currentMessages));

  // ── Region state ───────────────────────────────────────────────────
  let selectedRegion = $state<SupportedRegion>(DEFAULT_REGION);

  const selectRegion = (r: SupportedRegion): void => {
    persistPreferredRegion(r);
  };

  onMount(() => {
    selectedRegion = resolvePreferredRegion();

    const handlePreferredRegionChange = (event: Event): void => {
      selectedRegion = normalizeRegion(
        (event as CustomEvent<SupportedRegion>).detail,
        DEFAULT_REGION
      );
    };
    const handlePreferredRegionStorageChange = (event: StorageEvent): void => {
      if (event.key === PREFERRED_REGION_STORAGE_KEY) {
        selectedRegion = normalizeRegion(event.newValue, DEFAULT_REGION);
      }
    };
    window.addEventListener(PREFERRED_REGION_CHANGE_EVENT, handlePreferredRegionChange);
    window.addEventListener("storage", handlePreferredRegionStorageChange);

    return () => {
      window.removeEventListener(PREFERRED_REGION_CHANGE_EVENT, handlePreferredRegionChange);
      window.removeEventListener("storage", handlePreferredRegionStorageChange);
    };
  });

  // ── i18n ───────────────────────────────────────────────────────────
  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    void refreshPageTranslations(data.uiLocale, messagesOrPromise, requestId);
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    idLabel = translate("idLabel");
    bannerAltSuffix = translate("bannerAltSuffix");
    latestDataLoadingEvents = translate("latestData.loadingEvents");
    noEventLabel = translate("noCurrentEventData");
    disclaimerText = translate("disclaimer");
    mixedUnitLabel = translate("mixedUnitLabel");
    footerBrandLabel = translate("footer.brand");
    footerDescription = translate("footer.description");
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
    directoryTitle = translate("directory.title");
    directoryDescription = translate("directory.description");
    gameContentRegionLabel = translate("settings.gameContentRegion");
    gameContentRegionDescription = translate("settings.gameContentRegionDescription");
  };

  const refreshPageTranslations = async (
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

    applyTranslations(createI18nTranslator(localeValue, messages));
    currentMessages = messages;
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
  const directoryItems = $derived([
    { key: "characters", href: `/characters/${selectedRegion}`, icon: "mdi:account-group" },
    { key: "cards", href: `/cards/${selectedRegion}`, icon: "mdi:cards-outline" },
    { key: "musics", href: `/musics/${selectedRegion}`, icon: "mdi:music-note-outline" },
    { key: "events", href: `/events/${selectedRegion}`, icon: "mdi:calendar-star" },
    { key: "gachas", href: `/gachas/${selectedRegion}`, icon: "mdi:gift-outline" },
    { key: "virtualLives", href: `/virtual-lives/${selectedRegion}`, icon: "mdi:account-voice" }
  ]);
</script>

<!-- ──── Region-switchable data area ────────────────────────────────── -->
<section role="group" use:swipeRegion>
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
  <section class="mx-auto mb-10 max-w-5xl" aria-labelledby="current-event-title">
    <div class="mb-3 flex items-center justify-between gap-3 px-1">
      <div class="flex items-center gap-2">
        <Icon icon="mdi:calendar-star" class="size-4 text-primary" aria-hidden="true" />
        <h2
          id="current-event-title"
          class="text-sm font-semibold tracking-wide text-(--archive-text-muted)"
        >
          {latestDataEventsLabel}
        </h2>
      </div>
      <a
        href="/events/{selectedRegion}"
        class="btn btn-xs btn-ghost gap-1 text-xs text-base-content/50 hover:text-primary"
      >
        {latestDataViewAll}
        <Icon icon="mdi:arrow-right" class="size-3" aria-hidden="true" />
      </a>
    </div>
    {#await currentEventPromise}
      <article class="card content-card-shell w-full shadow-sm">
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
          messages={currentMessages}
          translate={currentTranslate}
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
        <article class="card content-card-shell w-full shadow-sm">
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
      <article class="card content-card-shell w-full shadow-sm">
        <div class="card-body">
          <p class="text-sm text-error">{data.currentEventLoadFailedMessage}</p>
        </div>
      </article>
    {/await}
  </section>

  <section class="mb-8" aria-labelledby="latest-data-title">
    <div class="mb-5 border-b border-(--archive-border-subtle) pb-3">
      <h2
        id="latest-data-title"
        class="text-base font-semibold tracking-wide text-(--archive-text-strong)"
      >
        {latestDataTitle}
      </h2>
    </div>
    {#if latestDataPromise}
      {#await latestDataPromise}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <!-- skeleton: cards+musics col -->
          <div class="space-y-6">
            <div class="space-y-3">
              <div class="h-5 w-24 animate-pulse rounded bg-base-300"></div>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as skeleton (skeleton)}
                  <div class="aspect-square animate-pulse rounded-xl bg-base-300"></div>
                {/each}
              </div>
            </div>
            <div class="space-y-3">
              <div class="h-5 w-24 animate-pulse rounded bg-base-300"></div>
              <div class="grid gap-2">
                {#each [1, 2, 3] as skeleton (skeleton)}
                  <div class="h-16 animate-pulse rounded-xl bg-base-300"></div>
                {/each}
              </div>
            </div>
          </div>
          <div class="space-y-3 md:col-span-2 lg:col-span-1">
            <div class="h-5 w-24 animate-pulse rounded bg-base-300"></div>
            <div class="h-40 animate-pulse rounded-xl bg-base-300"></div>
          </div>

          <!-- skeleton: gachas col -->
          <div class="space-y-3">
            <div class="h-5 w-24 animate-pulse rounded bg-base-300"></div>
            <div class="space-y-3">
              {#each [1, 2] as skeleton (skeleton)}
                <div class="h-24 animate-pulse rounded-lg bg-base-300"></div>
              {/each}
            </div>
          </div>
        </div>
      {:then regionData}
        {#if regionData.cards.length === 0 && regionData.musics.length === 0 && regionData.gachas.length === 0}
          <p class="text-center text-sm text-base-content/60">{latestDataNoData}</p>
        {:else}
          <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <!-- Compact visual release records. -->
            <div class="space-y-6 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
              <div class="content-card-inset p-3 sm:p-4">
                <h3
                  class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70"
                >
                  <span class="flex items-center gap-2">
                    <Icon icon="mdi:cards-outline" class="size-4" aria-hidden="true" />
                    {latestDataCardsLabel}
                  </span>
                  <a
                    href="/cards/{regionData.region}"
                    class="btn btn-xs btn-ghost gap-1 text-xs text-base-content/50 hover:text-primary"
                  >
                    {latestDataViewAll}
                    <Icon icon="mdi:arrow-right" class="size-3" aria-hidden="true" />
                  </a>
                </h3>
                {#if regionData.cards.length > 0}
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {#each regionData.cards as card (card.id)}
                      <a
                        href="/card/{regionData.region}/{card.id}"
                        class="group block"
                        data-home-card-thumbnail
                      >
                        <CardThumbnail
                          src={card.assetBundleName
                            ? getCardThumbnailAssetURL(card.assetBundleName, false, "jp")
                            : null}
                          alt={card.prefix ?? card.id}
                          fallbackLabel={card.id}
                          fallbackSrc={card.assetBundleName
                            ? getCardThumbnailAssetURL(
                                card.assetBundleName,
                                false,
                                regionData.region
                              )
                            : null}
                          attr={card.attr}
                          rarityType={card.rarityType}
                          rarityCount={card.rarityCount}
                          showFrame={true}
                          showIcons={true}
                          maxSize={null}
                          containerClass="card-hover-lift relative aspect-square overflow-hidden rounded-xl bg-(--archive-surface-default)"
                          imageClass="size-full object-cover"
                        />
                      </a>
                    {/each}
                  </div>
                {:else}
                  <p class="text-xs text-base-content/50">{latestDataNoData}</p>
                {/if}
              </div>

              <div class="content-card-inset p-3 sm:p-4">
                <h3
                  class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70"
                >
                  <span class="flex items-center gap-2">
                    <Icon icon="mdi:music-note-eighth" class="size-4" aria-hidden="true" />
                    {latestDataMusicsLabel}
                  </span>
                  <a
                    href="/musics/{regionData.region}"
                    class="btn btn-xs btn-ghost gap-1 text-xs text-base-content/50 hover:text-primary"
                  >
                    {latestDataViewAll}
                    <Icon icon="mdi:arrow-right" class="size-3" aria-hidden="true" />
                  </a>
                </h3>
                {#if regionData.musics.length > 0}
                  <div class="grid gap-2">
                    {#each regionData.musics as music (music.id)}
                      <a
                        href="/music/{regionData.region}/{music.id}"
                        class="group card-hover-lift block overflow-hidden rounded-xl border border-(--archive-border-subtle) bg-(--archive-surface-default) shadow-sm"
                        data-home-music-tile
                      >
                        <div
                          class="relative size-16 shrink-0 overflow-hidden rounded-lg bg-base-200/60"
                        >
                          {#if music.assetBundleName}
                            <AssetImage
                              src={getMusicJacketAssetURL(music.assetBundleName, regionData.region)}
                              alt={music.title ?? music.id}
                              loadMode="visible"
                              imageClass="size-full object-cover"
                              buttonClass="block size-full"
                            />
                          {:else}
                            <div
                              class="flex size-full items-center justify-center bg-base-300/40 text-xs text-base-content/50"
                            >
                              {music.id}
                            </div>
                          {/if}
                        </div>
                        <div class="min-w-0">
                          <p class="line-clamp-2 text-sm/snug font-medium">
                            {music.title ?? music.id}
                          </p>
                          <p class="mt-1 truncate text-[10px] text-base-content/50">
                            {music.composer ?? music.id}
                          </p>
                        </div>
                      </a>
                    {/each}
                  </div>
                {:else}
                  <p class="text-xs text-base-content/50">{latestDataNoData}</p>
                {/if}
              </div>
            </div>

            <div class="content-card-inset p-3 sm:p-4">
              <h3
                class="mb-3 flex items-center justify-between text-sm font-semibold text-base-content/70"
              >
                <span class="flex items-center gap-2">
                  <Icon icon="mdi:gift-outline" class="size-4" aria-hidden="true" />
                  {latestDataGachasLabel}
                </span>
                <a
                  href="/gachas/{regionData.region}"
                  class="btn btn-xs btn-ghost gap-1 text-xs text-base-content/50 hover:text-primary"
                >
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
                        class="card-hover-lift block overflow-hidden rounded-lg border border-(--archive-border-subtle) bg-(--archive-surface-default) shadow-sm"
                      >
                        <div class="aspect-3/1 w-full bg-base-100 pt-2">
                          <AssetImage
                            src={getGachaBannerAssetURL(gacha.id, regionData.region)}
                            fallbackSrc={gacha.assetBundleName
                              ? getGachaLogoAssetURL(gacha.assetBundleName, regionData.region)
                              : undefined}
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
  </section>

  <section
    class="mx-auto mt-12 max-w-7xl border-t border-(--archive-border-subtle) pt-8"
    aria-labelledby="content-directory-title"
  >
    <div class="mb-5 max-w-2xl">
      <h2
        id="content-directory-title"
        class="text-xl/tight font-bold text-base-content sm:text-2xl"
      >
        {directoryTitle}
      </h2>
      <p class="mt-2 text-sm/6 text-base-content/60">{directoryDescription}</p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each directoryItems as item (item.key)}
        <a
          href={item.href}
          class="group card-hover-lift content-card-shell flex min-h-28 items-start gap-4 rounded-2xl p-4 shadow-sm hover:border-primary/35 sm:p-5"
        >
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-content"
            ><Icon icon={item.icon} class="size-6" aria-hidden="true" /></span
          >
          <span class="min-w-0 flex-1"
            ><span class="flex items-center justify-between gap-3 text-base font-semibold"
              ><span>{currentTranslate(`directory.${item.key}.title`)}</span><Icon
                icon="mdi:arrow-right"
                class="size-4 shrink-0 text-base-content/35 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary"
                aria-hidden="true"
              /></span
            ><span class="mt-1.5 block text-sm/5 text-base-content/60"
              >{currentTranslate(`directory.${item.key}.description`)}</span
            ></span
          >
        </a>
      {/each}
    </div>
  </section>
</section>

<!-- ──── Version Info (standalone, below data area) ─────────────────── -->
<section class="mt-10 border-t border-(--archive-border-subtle) pt-6">
  <h2 class="mb-3 text-sm font-semibold tracking-wide text-(--archive-text-muted)">
    {versionInfoTitle}
  </h2>
  <div class="content-card-shell mx-auto max-w-5xl overflow-x-auto rounded-xl">
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

<svelte:head>
  <title>Sekai Viewer</title>
</svelte:head>

<footer
  class="mx-auto mt-12 max-w-4xl border-t border-(--archive-border-subtle) px-4 py-7 text-center"
>
  <p class="text-xs font-semibold tracking-wide text-base-content/55">{footerBrandLabel}</p>
  <p class="mt-1 text-xs text-base-content/45">{footerDescription}</p>
  <p class="mx-auto mt-3 max-w-3xl text-[0.68rem] leading-relaxed text-base-content/35">
    {disclaimerText}
  </p>
</footer>
