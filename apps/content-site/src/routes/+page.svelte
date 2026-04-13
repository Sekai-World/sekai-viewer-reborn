<script lang="ts">
  import { resolve } from "$app/paths";
  import { getContentSiteCommonText, supportedRegions } from "@platform/i18n-dicts";
  import { getEventBannerAssetURL } from "$lib/assets";
  import EventCountdownCard from "$lib/components/EventCountdownCard.svelte";
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
            <span class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
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
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a
          id={`region-${card.region}`}
          href={`${resolve("/event/[id]", { id: card.event.id })}?region=${encodeURIComponent(card.region)}`}
          class="card content-card-shell group w-full shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div class="card-body">
            <div class="mb-2 flex items-center justify-center md:mb-3">
              {#if card.event.assetBundleName}
                <img
                  src={getEventBannerAssetURL(card.event.assetBundleName, card.region)}
                  alt={`${card.event.title} ${bannerAltSuffix}`}
                  loading="lazy"
                  class="mx-auto h-auto w-full max-w-full object-contain md:w-3/4 md:min-w-[min(200px,100%)]"
                />
              {:else}
                <div class="flex h-full w-full items-center justify-center text-sm opacity-70">
                  {card.label}
                </div>
              {/if}
            </div>

            <h3 class="text-base font-semibold leading-tight">{card.event.title}</h3>
            <div class="flex items-center gap-2 text-sm opacity-70">
              <span class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
                {card.region.toUpperCase()}
              </span>
              <p>{idLabel}: {card.event.id}</p>
            </div>

            <EventCountdownCard
              startAt={card.event.startAt}
              endAt={card.event.endAt}
              uiLocale={data.uiLocale}
              class="mt-1"
            />
          </div>
        </a>
      {:else}
        <article id={`region-${card.region}`} class="card content-card-shell w-full shadow-sm">
          <div class="card-body">
            <div class="mb-2 text-sm opacity-70 md:mb-3">{card.label}</div>
            <div class="mb-1">
              <span class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
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
