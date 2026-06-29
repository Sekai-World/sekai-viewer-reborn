<script lang="ts">
  import Icon from "@iconify/svelte";
  import { createI18nTranslator, resolveStreamingMessages, setI18nLocale, tCommon } from "$lib/i18n/runtime";
  import { supportedRegions, type SupportedRegion } from "$lib/domain/regions";
  import CurrentEventCard from "$lib/components/event/CurrentEventCard.svelte";
  import RegionBadgeSwitch from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, resolveStreamingMessages(data.i18nMessages))(key);
  let idLabel = $state(getInitialI18nText("idLabel"));
  let bannerAltSuffix = $state(getInitialI18nText("bannerAltSuffix"));
  let noEventLabel = $state(getInitialI18nText("noCurrentEventData"));
  let disclaimerText = $state(getInitialI18nText("disclaimer"));
  let currentEventLabel = $state(getInitialI18nText("eventListCurrentEvent"));
  let mixedUnitLabel = $state(getInitialI18nText("mixedUnitLabel"));
  let versionInfoTitle = $state(getInitialI18nText("versionInfo.title"));
  let versionAppLabel = $state(getInitialI18nText("versionInfo.appLabel"));
  let versionDataLabel = $state(getInitialI18nText("versionInfo.dataLabel"));
  let versionAssetLabel = $state(getInitialI18nText("versionInfo.assetLabel"));

  const MOBILE_REGION_STORAGE_KEY = "home-mobile-region";
  let selectedRegion = $state<SupportedRegion>(supportedRegions[0]);
  let carouselEl: HTMLElement | undefined = $state();
  /** True while a programmatic (badge-click) scroll is in flight — suppresses IO updates. */
  let programmaticScrolling = false;

  $effect(() => {
    const saved = localStorage.getItem(MOBILE_REGION_STORAGE_KEY);
    if (saved && (supportedRegions as readonly string[]).includes(saved)) {
      selectedRegion = saved as SupportedRegion;
    }
  });

  const selectRegion = (r: SupportedRegion): void => {
    selectedRegion = r;
    localStorage.setItem(MOBILE_REGION_STORAGE_KEY, r);
    scrollToRegionCard(r);
  };

  const scrollToRegionCard = (region: SupportedRegion): void => {
    const cardEl = carouselEl?.querySelector(`[data-region="${region}"]`);
    if (cardEl && carouselEl) {
      programmaticScrolling = true;
      cardEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

      let debounceTimer: ReturnType<typeof setTimeout> | undefined;
      const clearScrollListeners = (): void => {
        programmaticScrolling = false;
        carouselEl!.removeEventListener("scrollend", onScrollEnd);
        carouselEl!.removeEventListener("scroll", onScrollDebounce);
        clearTimeout(debounceTimer);
      };
      const onScrollEnd = (): void => {
        clearScrollListeners();
      };
      const onScrollDebounce = (): void => {
        // While scrolling is still happening, keep postponing the unlock.
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(clearScrollListeners, 200);
      };
      // Primary: listen for scrollend (fires once when scroll completes)
      carouselEl.addEventListener("scrollend", onScrollEnd, { once: true });
      // Safety: if scrollend never fires, debounce on scroll activity and
      // unlock 200ms after the last scroll frame.
      carouselEl.addEventListener("scroll", onScrollDebounce, { passive: true });
    }
  };

  // Sync selectedRegion from scroll position via IntersectionObserver (mobile only)
  $effect(() => {
    const container = carouselEl;
    if (!container) {
      return;
    }

    // Only observe on mobile where the carousel is scrollable
    const isMobile = () => window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile()) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (programmaticScrolling) {
          return;
        }
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const region = entry.target.getAttribute("data-region");
            if (region && (supportedRegions as readonly string[]).includes(region)) {
              selectedRegion = region as SupportedRegion;
              localStorage.setItem(MOBILE_REGION_STORAGE_KEY, region);
            }
          }
        }
      },
      { root: container, threshold: 0.6 }
    );

    for (const child of container.children) {
      if (child.hasAttribute("data-region")) {
        observer.observe(child);
      }
    }

    return () => observer.disconnect();
  });

  // On initial load, scroll to the saved region (mobile only)
  let initialScrollDone = false;
  $effect(() => {
    const container = carouselEl;
    if (!container || initialScrollDone) {
      return;
    }

    if (!window.matchMedia("(max-width: 767px)").matches) {
      return;
    }

    const saved = localStorage.getItem(MOBILE_REGION_STORAGE_KEY);
    if (!saved || !(supportedRegions as readonly string[]).includes(saved)) {
      return;
    }

    // Wait for the card elements to be present in the DOM
    const rafId = requestAnimationFrame(() => {
      const cardEl = container.querySelector(`[data-region="${saved}"]`);
      if (cardEl) {
        initialScrollDone = true;
        cardEl.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
      }
    });

    return () => cancelAnimationFrame(rafId);
  });

  $effect(() => {
    const translate = createI18nTranslator(data.uiLocale, resolveStreamingMessages(data.i18nMessages));
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
    const locale = await setI18nLocale(localeValue, resolveStreamingMessages(data.i18nMessages));
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
    <Icon icon="mdi:information-outline" class="mt-0.5 size-4 shrink-0 text-info/80" />
    <p class="text-xs/relaxed">{disclaimerText}</p>
  </div>
</div>

<h2 class="mb-4 text-center text-base font-semibold tracking-wide text-base-content/70">
  {currentEventLabel}
</h2>

<div class="mb-6 flex flex-wrap justify-center gap-2 md:hidden">
  <RegionBadgeSwitch
    options={supportedRegions.map((r) =>
      r === selectedRegion
        ? {
            key: r,
            label: r.toUpperCase(),
            active: true
          }
        : {
            key: r,
            label: r.toUpperCase(),
            active: false,
            onclick: () => selectRegion(r)
          }
    )}
  />
</div>

<section
  bind:this={carouselEl}
  class="home-card-carousel flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-clip scroll-smooth px-4 md:snap-none md:flex-wrap md:justify-center md:overflow-visible md:scroll-smooth-none md:px-0"
>
  {#each supportedRegions as region, index (region)}
    <div
      data-region={region}
      class="w-[85vw] max-w-sm shrink-0 snap-center md:w-full md:max-w-none md:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-4rem)/5)]"
    >
      {#await data.cards[index]}
        <article id={`region-${region}`} class="hover-3d relative isolate w-full">
          <div class="card content-card-shell relative overflow-hidden shadow-[0_5px_14px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_18px_rgba(0,0,0,0.26),0_2px_8px_rgba(0,0,0,0.18)]">
            <div class="card-body relative z-10">
              <div class="mb-2 flex items-center justify-center p-[4%] md:mb-3">
                <div class="aspect-3/2 w-full max-w-full animate-pulse rounded-xl bg-base-300 md:w-3/4 md:min-w-[min(200px,100%)]"></div>
              </div>
              <div class="mb-1 h-4 w-3/4 animate-pulse rounded bg-base-300"></div>
              <div class="mb-1.5 flex items-center gap-2">
                <div class="h-3.5 w-16 animate-pulse rounded bg-base-300"></div>
                <div class="size-7 animate-pulse rounded-full bg-base-300"></div>
              </div>
              <div class="content-card-inset rounded-xl p-2.5">
                <div class="mb-2 h-2.5 w-20 animate-pulse rounded bg-base-300"></div>
                <div class="grid grid-cols-3 gap-1.5">
                  <div class="content-card-elevated rounded-lg px-1 py-1.5 text-center">
                    <div class="mx-auto h-5 w-6 animate-pulse rounded bg-base-300"></div>
                    <div class="mx-auto mt-0.5 h-2 w-6 animate-pulse rounded bg-base-300"></div>
                  </div>
                  <div class="content-card-elevated rounded-lg px-1 py-1.5 text-center">
                    <div class="mx-auto h-5 w-6 animate-pulse rounded bg-base-300"></div>
                    <div class="mx-auto mt-0.5 h-2 w-6 animate-pulse rounded bg-base-300"></div>
                  </div>
                  <div class="content-card-elevated rounded-lg px-1 py-1.5 text-center">
                    <div class="mx-auto h-5 w-6 animate-pulse rounded bg-base-300"></div>
                    <div class="mx-auto mt-0.5 h-2 w-6 animate-pulse rounded bg-base-300"></div>
                  </div>
                </div>
              </div>
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
