<script lang="ts">
  import { resolve } from "$app/paths";
  import { getContentSiteCommonText, regionLabels, supportedRegions } from "@platform/i18n-dicts";
  import { getEventBannerAssetURL } from "$lib/assets";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { DEFAULT_UI_LOCALE } from "$lib/region";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  type CountdownValues = {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };

  type CountdownMode = "untilStart" | "untilEnd" | "ended";

  type CountdownState = {
    mode: CountdownMode;
    label: string;
    values: CountdownValues;
    toneClass: string;
    showSeconds: boolean;
    minuteProgress: number;
  };

  let { data }: { data: PageData } = $props();
  const initialLocale = DEFAULT_UI_LOCALE;
  let gameContentRegionLabel = $state(
    getContentSiteCommonText(initialLocale, "settings.gameContentRegion")
  );
  let primarySecondaryLabel = $state(
    getContentSiteCommonText(initialLocale, "labels.primarySecondary")
  );
  let interfaceLanguageLabel = $state(
    getContentSiteCommonText(initialLocale, "settings.interfaceLanguage")
  );
  let startsInLabel = $state(getContentSiteCommonText(initialLocale, "countdownStartsIn"));
  let endsInLabel = $state(getContentSiteCommonText(initialLocale, "countdownEndsIn"));
  let eventEndedLabel = $state(getContentSiteCommonText(initialLocale, "eventEnded"));
  let idLabel = $state(getContentSiteCommonText(initialLocale, "idLabel"));
  let bannerAltSuffix = $state(getContentSiteCommonText(initialLocale, "bannerAltSuffix"));
  let noEventLabel = $state(getContentSiteCommonText(initialLocale, "noCurrentEventData"));
  let dayLabel = $state(getContentSiteCommonText(initialLocale, "labels.timeUnit.day"));
  let hourLabel = $state(getContentSiteCommonText(initialLocale, "labels.timeUnit.hour"));
  let minuteLabel = $state(getContentSiteCommonText(initialLocale, "labels.timeUnit.minute"));
  let secondLabel = $state(getContentSiteCommonText(initialLocale, "labels.timeUnit.second"));
  let nowMs = $state(Date.now());

  $effect(() => {
    void refreshPageTranslations(data.uiLocale);
  });

  const refreshPageTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    gameContentRegionLabel = tCommon(locale, "settings.gameContentRegion");
    interfaceLanguageLabel = tCommon(locale, "settings.interfaceLanguage");
    startsInLabel = tCommon(locale, "countdownStartsIn");
    endsInLabel = tCommon(locale, "countdownEndsIn");
    eventEndedLabel = tCommon(locale, "eventEnded");
    idLabel = tCommon(locale, "idLabel");
    bannerAltSuffix = tCommon(locale, "bannerAltSuffix");
    primarySecondaryLabel = tCommon(locale, "labels.primarySecondary");
    noEventLabel = tCommon(locale, "noCurrentEventData");
    dayLabel = tCommon(locale, "labels.timeUnit.day");
    hourLabel = tCommon(locale, "labels.timeUnit.hour");
    minuteLabel = tCommon(locale, "labels.timeUnit.minute");
    secondLabel = tCommon(locale, "labels.timeUnit.second");
  };

  const toTimestampMs = (value: string | number | null): number | null => {
    if (value === null) {
      return null;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return null;
      }

      return value > 1e12 ? value : value * 1000;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (/^\d+$/.test(normalized)) {
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) {
        return null;
      }

      return parsed > 1e12 ? parsed : parsed * 1000;
    }

    const dateValue = new Date(normalized).getTime();
    return Number.isNaN(dateValue) ? null : dateValue;
  };

  const toCountdownValues = (diffMs: number): CountdownValues => {
    const diff = Math.max(0, diffMs);
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds };
  };

  const emptyCountdownValues = (): CountdownValues => ({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const getCountdownState = (
    startAt: string | number | null,
    endAt: string | number | null
  ): CountdownState => {
    const startAtMs = toTimestampMs(startAt);
    const endAtMs = toTimestampMs(endAt);

    if (startAtMs !== null && nowMs < startAtMs) {
      const diffMs = startAtMs - nowMs;
      return {
        mode: "untilStart",
        label: startsInLabel,
        values: toCountdownValues(diffMs),
        toneClass: "text-base-content",
        showSeconds: diffMs < 24 * 60 * 60 * 1000,
        minuteProgress: getMinuteProgressPercent(diffMs)
      };
    }

    if (endAtMs !== null && nowMs < endAtMs) {
      const endDiff = endAtMs - nowMs;
      const toneClass =
        endDiff < 6 * 60 * 60 * 1000
          ? "text-error"
          : endDiff < 24 * 60 * 60 * 1000
            ? "text-warning"
            : "text-base-content";

      return {
        mode: "untilEnd",
        label: endsInLabel,
        values: toCountdownValues(endDiff),
        toneClass,
        showSeconds: endDiff < 24 * 60 * 60 * 1000,
        minuteProgress: getMinuteProgressPercent(endDiff)
      };
    }

    return {
      mode: "ended",
      label: eventEndedLabel,
      values: emptyCountdownValues(),
      toneClass: "text-base-content",
      showSeconds: false,
      minuteProgress: 0
    };
  };

  const countdownStyle = (value: number, digits = 2): string =>
    `--value:${value}; --digits:${digits};`;

  const getMinuteProgressPercent = (diffMs: number): number => {
    if (diffMs <= 0) {
      return 0;
    }

    const minuteRemainder = diffMs % 60000;
    if (minuteRemainder === 0) {
      return 100;
    }

    return (minuteRemainder / 60000) * 100;
  };

  const getMinuteBarClass = (toneClass: string): string => {
    if (toneClass === "text-error") {
      return "bg-error/85";
    }

    if (toneClass === "text-warning") {
      return "bg-warning/90";
    }

    return "bg-primary/80";
  };

  onMount(() => {
    let rafId = 0;
    const tick = () => {
      nowMs = Date.now();
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  });

</script>

<section class="mb-4 flex justify-center">
  <div class="flex flex-wrap justify-center gap-2">
    <p class="badge badge-outline px-4 py-3 text-sm">
      {gameContentRegionLabel} ({primarySecondaryLabel}): {regionLabels[data.primaryRegion]} | {regionLabels[data.secondaryRegion]}
    </p>
    <p class="badge badge-outline px-4 py-3 text-sm">{interfaceLanguageLabel}: {data.uiLocale}</p>
  </div>
</section>

<section class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
  {#await data.cards}
    {#each supportedRegions as region (region)}
      <article
        id={`region-${region}`}
        class="card w-full bg-base-100 shadow-sm"
      >
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
    {/each}
  {:then cards}
    {#each cards as card (card.region)}
      {#if card.event}
        {@const countdown = getCountdownState(card.event.startAt, card.event.endAt)}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a
          id={`region-${card.region}`}
          href={`${resolve("/event/[id]", { id: card.event.id })}?region=${encodeURIComponent(card.region)}`}
          class="card group w-full bg-base-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
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

            <div class="mt-1 rounded-xl border border-base-content/12 bg-base-200/45 p-2.5">
              {#if countdown.mode === "ended"}
                <p class="text-sm font-semibold opacity-80">{countdown.label}</p>
              {:else}
                <p class={`mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${countdown.toneClass}`}>
                  {countdown.label}
                </p>
                <div class={`grid gap-1.5 ${countdown.showSeconds ? "grid-cols-4" : "grid-cols-3"} ${countdown.toneClass}`}>
                  <div class="rounded-lg bg-base-100/92 px-1 py-1.5 text-center shadow-sm">
                    <span class="countdown font-mono text-lg font-semibold">
                      <span style={countdownStyle(countdown.values.days)}>{countdown.values.days}</span>
                    </span>
                    <p class="text-[0.62rem] opacity-80">{dayLabel}</p>
                  </div>
                  <div class="rounded-lg bg-base-100/92 px-1 py-1.5 text-center shadow-sm">
                    <span class="countdown font-mono text-lg font-semibold">
                      <span style={countdownStyle(countdown.values.hours)}>{countdown.values.hours}</span>
                    </span>
                    <p class="text-[0.62rem] opacity-80">{hourLabel}</p>
                  </div>
                  <div class="rounded-lg bg-base-100/92 px-1 py-1.5 text-center shadow-sm">
                    <span class="countdown font-mono text-lg font-semibold">
                      <span style={countdownStyle(countdown.values.minutes)}>
                        {countdown.values.minutes}
                      </span>
                    </span>
                    <p class="text-[0.62rem] opacity-80">{minuteLabel}</p>
                  </div>
                  {#if countdown.showSeconds}
                    <div class="rounded-lg bg-base-100/92 px-1 py-1.5 text-center shadow-sm">
                      <span class="countdown font-mono text-lg font-semibold">
                        <span style={countdownStyle(countdown.values.seconds)}>
                          {countdown.values.seconds}
                        </span>
                      </span>
                      <p class="text-[0.62rem] opacity-80">{secondLabel}</p>
                    </div>
                  {/if}
                </div>
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-base-content/14">
                  <div
                    class={`h-full origin-right ${getMinuteBarClass(countdown.toneClass)}`}
                    style={`width:${countdown.minuteProgress}%; margin-left:auto;`}
                  ></div>
                </div>
              {/if}
            </div>
          </div>
        </a>
      {:else}
        <article
          id={`region-${card.region}`}
          class="card w-full bg-base-100 shadow-sm"
        >
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
    {/each}
  {/await}
</section>
