<script lang="ts">
  import {
    noEventTextByLocale,
    primarySecondaryLabelByLocale,
    regionLabels
  } from "@platform/i18n-dicts";
  import { getEventBannerAssetURL } from "$lib/assets";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { normalizeUiLocale } from "$lib/region";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let displayLocale = $state<string>("en-US");
  let gameContentRegionLabel = $state("Game Content Region");
  let primarySecondaryLabel = $state("Primary|Secondary");
  let interfaceLanguageLabel = $state("Interface Language");
  let startAtLabel = $state("Start");
  let endAtLabel = $state("End");
  let noEventLabel = $state("No current event data.");

  $effect(() => {
    displayLocale = data.uiLocale;
    void refreshPageTranslations(data.uiLocale);
  });

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    gameContentRegionLabel = tCommon("settings.gameContentRegion", "Game Content Region");
    interfaceLanguageLabel = tCommon("settings.interfaceLanguage", "Interface Language");
    startAtLabel = tCommon("startAt", "Start");
    endAtLabel = tCommon("endAt", "End");
    primarySecondaryLabel = primarySecondaryLabelByLocale[normalizeUiLocale(locale)];
    noEventLabel = noEventTextByLocale[normalizeUiLocale(locale)];
  };

  const formatTime = (value: string | number | null): string => {
    if (!value) {
      return "--";
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat(displayLocale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(parsedDate);
  };

  const toEventHref = (eventId: string, region: string): string =>
    `/event/${encodeURIComponent(eventId)}?region=${encodeURIComponent(region)}`;
</script>

<section class="mb-4 flex justify-center">
  <div class="flex flex-wrap justify-center gap-2">
    <p class="badge badge-outline px-4 py-3 text-sm">
      {gameContentRegionLabel} ({primarySecondaryLabel}): {regionLabels[data.primaryRegion]} | {regionLabels[data.secondaryRegion]}
    </p>
    <p class="badge badge-outline px-4 py-3 text-sm">{interfaceLanguageLabel}: {data.uiLocale}</p>
  </div>
</section>

<section class="flex flex-col gap-4 md:flex-row md:flex-wrap md:justify-center">
  {#each data.cards as card (card.region)}
    <article id={`region-${card.region}`} class="card w-full bg-base-100 shadow-sm md:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
      <div class="card-body">
        {#if card.event}
          <a
            href={toEventHref(card.event.id, card.region)}
            class="group relative mb-3 block overflow-hidden rounded-xl border border-base-content/15 bg-base-200/50"
          >
            {#if card.event.assetBundleName}
              <img
                src={getEventBannerAssetURL(card.event.assetBundleName, card.region)}
                alt={`${card.event.title} banner`}
                loading="lazy"
                class="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            {:else}
              <div class="flex h-32 items-center justify-center text-sm opacity-70">
                {card.label}
              </div>
            {/if}
            <span class="badge badge-primary badge-outline absolute right-2 top-2 font-semibold">
              {card.region.toUpperCase()}
            </span>
          </a>
        {:else}
          <div class="relative mb-3 overflow-hidden rounded-xl border border-base-content/15 bg-base-200/50">
            <div class="flex h-32 items-center justify-center text-sm opacity-70">{card.label}</div>
            <span class="badge badge-primary badge-outline absolute right-2 top-2 font-semibold">
              {card.region.toUpperCase()}
            </span>
          </div>
        {/if}

        {#if card.error}
          <p class="text-sm text-error">{card.error}</p>
        {:else if card.event}
          <h3 class="text-base font-semibold leading-tight">{card.event.title}</h3>
          <p class="text-sm opacity-70">ID: {card.event.id}</p>
          <p class="text-sm">{startAtLabel}: {formatTime(card.event.startAt)}</p>
          <p class="text-sm">{endAtLabel}: {formatTime(card.event.endAt)}</p>
          {#if card.event.assetBundleName}
            <p class="text-xs opacity-70">
              Asset:
              <a
                class="link link-hover break-all"
                href={getEventBannerAssetURL(card.event.assetBundleName, card.region)}
                target="_blank"
                rel="noreferrer"
              >
                {card.event.assetBundleName}
              </a>
            </p>
          {/if}
        {:else}
          <p class="text-sm opacity-70">{noEventLabel}</p>
        {/if}
      </div>
    </article>
  {/each}
</section>
