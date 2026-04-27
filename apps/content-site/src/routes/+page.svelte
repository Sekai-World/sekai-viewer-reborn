<script lang="ts">
  import Icon from "@iconify/svelte";
  import {
    getContentSiteCommonText,
    supportedRegions,
    type SupportedRegion
  } from "@platform/i18n-dicts";
  import CurrentEventCard from "$lib/components/CurrentEventCard.svelte";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { DEFAULT_UI_LOCALE } from "$lib/region";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const initialLocale = DEFAULT_UI_LOCALE;
  let idLabel = $state(getContentSiteCommonText(initialLocale, "idLabel"));
  let bannerAltSuffix = $state(getContentSiteCommonText(initialLocale, "bannerAltSuffix"));
  let noEventLabel = $state(getContentSiteCommonText(initialLocale, "noCurrentEventData"));
  let disclaimerText = $state(getContentSiteCommonText(initialLocale, "disclaimer"));
  let currentEventLabel = $state(getContentSiteCommonText(initialLocale, "eventListCurrentEvent"));
  let versionInfoTitle = $state(getContentSiteCommonText(initialLocale, "versionInfo.title"));
  let versionAppLabel = $state(getContentSiteCommonText(initialLocale, "versionInfo.appLabel"));
  let versionDataLabel = $state(getContentSiteCommonText(initialLocale, "versionInfo.dataLabel"));
  let versionAssetLabel = $state(getContentSiteCommonText(initialLocale, "versionInfo.assetLabel"));
  const homeCardItemClass =
    "w-full shrink-0 md:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2rem)/3)] 2xl:basis-[calc((100%-4rem)/5)]";

  $effect(() => {
    void refreshPageTranslations(data.uiLocale);
  });

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    idLabel = tCommon(locale, "idLabel");
    bannerAltSuffix = tCommon(locale, "bannerAltSuffix");
    noEventLabel = tCommon(locale, "noCurrentEventData");
    disclaimerText = tCommon(locale, "disclaimer");
    currentEventLabel = tCommon(locale, "eventListCurrentEvent");
    versionInfoTitle = tCommon(locale, "versionInfo.title");
    versionAppLabel = tCommon(locale, "versionInfo.appLabel");
    versionDataLabel = tCommon(locale, "versionInfo.dataLabel");
    versionAssetLabel = tCommon(locale, "versionInfo.assetLabel");
  };

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
</script>

<div class="-mt-6 mb-10 flex justify-center px-2">
  <div class="flex max-w-3xl gap-3 rounded-xl border border-info/25 bg-info/8 px-4 py-3 text-info-content/70">
    <Icon icon="mdi:information-outline" class="mt-0.5 h-4 w-4 shrink-0 text-info/80" />
    <p class="text-xs leading-relaxed">{disclaimerText}</p>
  </div>
</div>

<h2 class="mb-6 text-center text-base font-semibold tracking-wide text-base-content/70">{currentEventLabel}</h2>

<section class="flex flex-wrap justify-center gap-4">
  {#each supportedRegions as region, index (region)}
    {#await data.cards[index]}
      <div class={homeCardItemClass}>
        <article id={`region-${region}`} class="card content-card-shell w-full shadow-sm">
          <div class="card-body">
            <div class="mb-2 h-4 w-1/3 animate-pulse rounded bg-base-300 md:mb-3"></div>
              <div class="mb-1">
                <span class="badge homepage-region-badge font-semibold shadow-sm">
                  {region.toUpperCase()}
                </span>
              </div>
            <div class="space-y-2">
              <div class="h-4 w-full animate-pulse rounded bg-base-300"></div>
              <div class="h-4 w-2/3 animate-pulse rounded bg-base-300"></div>
            </div>
          </div>
        </article>
      </div>
    {:then card}
      {#if card.event}
        <div class={homeCardItemClass}>
          <CurrentEventCard
            region={card.region}
            regionLabel={card.label}
            event={card.event}
            versions={card.versions}
            uiLocale={data.uiLocale}
            {idLabel}
            {bannerAltSuffix}
          />
        </div>
      {:else}
        <div class={homeCardItemClass}>
          <article id={`region-${card.region}`} class="card content-card-shell w-full shadow-sm">
            <div class="card-body">
              <div class="mb-2 text-sm opacity-70 md:mb-3">{card.label}</div>
              <div class="mb-1">
                <span class="badge homepage-region-badge font-semibold shadow-sm">
                  {card.region.toUpperCase()}
                </span>
              </div>

              {#if card.error}
                <p class="text-sm text-error">{card.error}</p>
              {:else}
                <p class="text-sm opacity-70">{noEventLabel}</p>
              {/if}
            </div>
          </article>
        </div>
      {/if}
    {/await}
  {/each}
</section>

<section class="mt-10">
  <h2 class="mb-4 text-center text-base font-semibold tracking-wide text-base-content/70">{versionInfoTitle}</h2>
  <div class="overflow-x-auto rounded-xl border border-base-content/10">
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
              <td><span class="badge badge-sm homepage-region-badge font-semibold">{region.toUpperCase()}</span></td>
              <td><span class="inline-block h-3 w-16 animate-pulse rounded bg-base-300"></span></td>
              <td><span class="inline-block h-3 w-20 animate-pulse rounded bg-base-300"></span></td>
              <td><span class="inline-block h-3 w-20 animate-pulse rounded bg-base-300"></span></td>
            </tr>
          {:then card}
            <tr>
              <td><span class="badge badge-sm homepage-region-badge font-semibold">{card.region.toUpperCase()}</span></td>
              <td class="font-mono text-xs">{card.versions?.appVersion ?? "—"}</td>
              <td class="font-mono text-xs">{getDisplayDataVersion(card.versions) ?? "—"}</td>
              <td class="font-mono text-xs">{getDisplayAssetVersion(card.region, card.versions) ?? "—"}</td>
            </tr>
          {/await}
        {/each}
      </tbody>
    </table>
  </div>
</section>
