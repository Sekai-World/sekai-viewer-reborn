<script lang="ts">
  import { getContentSiteCommonText, supportedRegions } from "@platform/i18n-dicts";
  import CurrentEventCard from "$lib/components/CurrentEventCard.svelte";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { DEFAULT_UI_LOCALE } from "$lib/region";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const initialLocale = DEFAULT_UI_LOCALE;
  let interfaceLanguageLabel = $state(
    getContentSiteCommonText(initialLocale, "settings.interfaceLanguage")
  );
  let idLabel = $state(getContentSiteCommonText(initialLocale, "idLabel"));
  let bannerAltSuffix = $state(getContentSiteCommonText(initialLocale, "bannerAltSuffix"));
  let noEventLabel = $state(getContentSiteCommonText(initialLocale, "noCurrentEventData"));

  $effect(() => {
    void refreshPageTranslations(data.uiLocale);
  });

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    interfaceLanguageLabel = tCommon(locale, "settings.interfaceLanguage");
    idLabel = tCommon(locale, "idLabel");
    bannerAltSuffix = tCommon(locale, "bannerAltSuffix");
    noEventLabel = tCommon(locale, "noCurrentEventData");
  };
</script>

<section class="mb-4 flex justify-center">
  <div class="flex flex-wrap justify-center gap-2">
    <p class="badge badge-outline px-4 py-3 text-sm">{interfaceLanguageLabel}: {data.uiLocale}</p>
  </div>
</section>

<section class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
  {#each supportedRegions as region, index (region)}
    {#await data.cards[index]}
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
    {:then card}
      {#if card.event}
        <CurrentEventCard
          region={card.region}
          regionLabel={card.label}
          event={card.event}
          uiLocale={data.uiLocale}
          {idLabel}
          {bannerAltSuffix}
        />
      {:else}
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
      {/if}
    {/await}
  {/each}
</section>
