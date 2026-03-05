<script lang="ts">
  import { getContentSiteCommonText, type SupportedRegion } from "@platform/i18n-dicts";
  import { getEventBannerAssetURL } from "$lib/assets";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { DEFAULT_UI_LOCALE } from "$lib/region";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const initialLocale = DEFAULT_UI_LOCALE;
  let displayLocale = $state<string>("en-US");
  let homeLabel = $state(getContentSiteCommonText(initialLocale, "home"));
  let startAtLabel = $state(getContentSiteCommonText(initialLocale, "startAt"));
  let endAtLabel = $state(getContentSiteCommonText(initialLocale, "endAt"));
  let idLabel = $state(getContentSiteCommonText(initialLocale, "idLabel"));
  let bannerAltSuffix = $state(getContentSiteCommonText(initialLocale, "bannerAltSuffix"));
  let noEventLabel = $state(getContentSiteCommonText(initialLocale, "noCurrentEventData"));
  let eventTitlePrefix = $state(getContentSiteCommonText(initialLocale, "pageTitle.eventPrefix"));

  $effect(() => {
    displayLocale = data.uiLocale;
    void refreshTranslations(data.uiLocale);
  });

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    homeLabel = tCommon(locale, "home");
    startAtLabel = tCommon(locale, "startAt");
    endAtLabel = tCommon(locale, "endAt");
    idLabel = tCommon(locale, "idLabel");
    bannerAltSuffix = tCommon(locale, "bannerAltSuffix");
    noEventLabel = tCommon(locale, "noCurrentEventData");
    eventTitlePrefix = tCommon(locale, "pageTitle.eventPrefix");
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

  const regionDisplayOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];
  const regionOptions = $derived<SupportedRegion[]>(
    regionDisplayOrder.filter(
      (regionOption) => data.availableRegions.includes(regionOption) || regionOption === data.region
    )
  );

  const toRegionHref = (targetRegion: SupportedRegion): string =>
    `/event/${encodeURIComponent(data.eventId)}?region=${encodeURIComponent(targetRegion)}`;
</script>

<svelte:head>
  <title>{data.event ? `${data.event.title} - Sekai Viewer` : `${eventTitlePrefix} ${data.eventId} - Sekai Viewer`}</title>
</svelte:head>

<section class="mb-4 flex items-center justify-between gap-3">
  <a class="btn btn-ghost btn-sm" href="/">← {homeLabel}</a>
  <div class="flex flex-wrap items-center justify-end gap-1.5">
    {#each regionOptions as regionOption (regionOption)}
      {#if regionOption === data.region}
        <span class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
          {regionOption.toUpperCase()}
        </span>
      {:else}
        <a
          href={toRegionHref(regionOption)}
          class="badge badge-primary badge-outline border-primary/55 bg-base-100/88 font-semibold"
        >
          {regionOption.toUpperCase()}
        </a>
      {/if}
    {/each}
  </div>
</section>

{#if data.error}
  <div class="alert alert-error mb-4">{data.error}</div>
{/if}

{#if data.event}
  <article class="card overflow-hidden bg-base-100 shadow-sm">
    {#if data.event.assetBundleName}
      <img
        src={getEventBannerAssetURL(data.event.assetBundleName, data.region)}
        alt={`${data.event.title} ${bannerAltSuffix}`}
        class="aspect-[61/26] w-full object-cover"
      />
    {/if}

    <div class="card-body gap-2">
      <h1 class="text-xl font-semibold leading-tight">{data.event.title}</h1>
      <p class="text-sm opacity-80">{idLabel}: {data.event.id}</p>
      <p class="text-sm">{startAtLabel}: {formatTime(data.event.startAt)}</p>
      <p class="text-sm">{endAtLabel}: {formatTime(data.event.endAt)}</p>
    </div>
  </article>
{:else if !data.error}
  <div class="alert">{noEventLabel}</div>
{/if}
