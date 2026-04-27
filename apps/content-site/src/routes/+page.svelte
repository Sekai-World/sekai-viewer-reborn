<script lang="ts">
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

              {#if getDisplayDataVersion(card.versions) || getDisplayAssetVersion(card.region, card.versions)}
                <div class="mt-3 flex flex-wrap gap-2">
                  {#if getDisplayDataVersion(card.versions)}
                    <span class="badge badge-outline border-base-content/15 px-2.5 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em]">
                      DATA {getDisplayDataVersion(card.versions)}
                    </span>
                  {/if}
                  {#if getDisplayAssetVersion(card.region, card.versions)}
                    <span class="badge badge-outline border-base-content/15 px-2.5 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em]">
                      ASSET {getDisplayAssetVersion(card.region, card.versions)}
                    </span>
                  {/if}
                </div>
              {/if}
            </div>
          </article>
        </div>
      {/if}
    {/await}
  {/each}
</section>

<footer class="mt-10 border-t border-base-content/10 px-2 py-6 text-center text-xs leading-relaxed text-base-content/50">
  <p>{disclaimerText}</p>
</footer>
