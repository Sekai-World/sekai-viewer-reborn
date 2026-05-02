<script lang="ts">
  import Icon from "@iconify/svelte";
  import { createCommonTranslator, setI18nLocale, tCommon } from "$lib/i18n";
  import { supportedRegions, type SupportedRegion } from "$lib/regions";
  import CurrentEventCard from "$lib/components/CurrentEventCard.svelte";
  import RegionBadgeSwitch from "$lib/components/RegionBadgeSwitch.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const getInitialCommonText = (key: string): string =>
    createCommonTranslator(data.uiLocale, data.commonMessages)(key);
  let idLabel = $state(getInitialCommonText("idLabel"));
  let bannerAltSuffix = $state(getInitialCommonText("bannerAltSuffix"));
  let noEventLabel = $state(getInitialCommonText("noCurrentEventData"));
  let disclaimerText = $state(getInitialCommonText("disclaimer"));
  let currentEventLabel = $state(getInitialCommonText("eventListCurrentEvent"));
  let mixedUnitLabel = $state(getInitialCommonText("mixedUnitLabel"));
  let versionInfoTitle = $state(getInitialCommonText("versionInfo.title"));
  let versionAppLabel = $state(getInitialCommonText("versionInfo.appLabel"));
  let versionDataLabel = $state(getInitialCommonText("versionInfo.dataLabel"));
  let versionAssetLabel = $state(getInitialCommonText("versionInfo.assetLabel"));
  const homeCardItemClass =
    "w-full shrink-0 md:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-4rem)/5)]";

  const MOBILE_REGION_STORAGE_KEY = "home-mobile-region";
  let selectedRegion = $state<SupportedRegion>(supportedRegions[0]);

  $effect(() => {
    const saved = localStorage.getItem(MOBILE_REGION_STORAGE_KEY);
    if (saved && (supportedRegions as readonly string[]).includes(saved)) {
      selectedRegion = saved as SupportedRegion;
    }
  });

  const selectRegion = (r: SupportedRegion): void => {
    selectedRegion = r;
    localStorage.setItem(MOBILE_REGION_STORAGE_KEY, r);
  };

  $effect(() => {
    const translate = createCommonTranslator(data.uiLocale, data.commonMessages);
    applyTranslations(translate);
    void refreshPageTranslations(data.uiLocale);
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    idLabel = translate("idLabel");
    bannerAltSuffix = translate("bannerAltSuffix");
    noEventLabel = translate("noCurrentEventData");
    disclaimerText = translate("disclaimer");
    currentEventLabel = translate("eventListCurrentEvent");
    mixedUnitLabel = translate("mixedUnitLabel");
    versionInfoTitle = translate("versionInfo.title");
    versionAppLabel = translate("versionInfo.appLabel");
    versionDataLabel = translate("versionInfo.dataLabel");
    versionAssetLabel = translate("versionInfo.assetLabel");
  };

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue, data.commonMessages);
    applyTranslations((key) => tCommon(locale, key));
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
  <div
    class="flex max-w-3xl gap-3 rounded-xl border border-info/25 bg-info/8 px-4 py-3 text-base-content/70"
  >
    <Icon icon="mdi:information-outline" class="mt-0.5 h-4 w-4 shrink-0 text-info/80" />
    <p class="text-xs leading-relaxed">{disclaimerText}</p>
  </div>
</div>

<h2 class="mb-4 text-center text-base font-semibold tracking-wide text-base-content/70">
  {currentEventLabel}
</h2>

<div class="mb-6 flex flex-wrap justify-center gap-2 md:hidden">
  <RegionBadgeSwitch
    options={supportedRegions.map((r) => ({
      key: r,
      label: r.toUpperCase(),
      active: r === selectedRegion,
      onclick: r !== selectedRegion ? () => selectRegion(r) : undefined
    }))}
  />
</div>

<section class="flex flex-wrap justify-center gap-4">
  {#each supportedRegions as region, index (region)}
    <div class="{homeCardItemClass} {region !== selectedRegion ? 'max-md:hidden' : ''}">
      {#await data.cards[index]}
        <article id={`region-${region}`} class="card content-card-shell w-full shadow-sm">
          <div class="card-body">
            <div class="mb-2 h-4 w-1/3 animate-pulse rounded bg-base-300 md:mb-3"></div>
            <div class="mb-1 max-md:hidden">
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
            {mixedUnitLabel}
            {bannerAltSuffix}
          />
        {:else}
          <article id={`region-${card.region}`} class="card content-card-shell w-full shadow-sm">
            <div class="card-body">
              <div class="mb-2 text-sm opacity-70 md:mb-3">{card.label}</div>
              <div class="mb-1 max-md:hidden">
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
    </div>
  {/each}
</section>

<section class="mt-10">
  <h2 class="mb-4 text-center text-base font-semibold tracking-wide text-base-content/70">
    {versionInfoTitle}
  </h2>
  <div class="mx-auto max-w-3xl overflow-x-auto rounded-xl border border-base-content/10">
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
                ><span class="badge badge-sm homepage-region-badge font-semibold"
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
                ><span class="badge badge-sm homepage-region-badge font-semibold"
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
