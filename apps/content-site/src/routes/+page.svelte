<script lang="ts">
  import {
    noEventTextByLocale,
    primarySecondaryLabelByLocale,
    regionLabels
  } from "@platform/i18n-dicts";
  import { getEventBannerAssetURL } from "$lib/assets";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { normalizeUiLocale } from "$lib/region";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";

  type CountdownValues = {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };

  let { data }: { data: PageData } = $props();
  let displayLocale = $state<string>("en-US");
  let gameContentRegionLabel = $state("Game Content Region");
  let primarySecondaryLabel = $state("Primary|Secondary");
  let interfaceLanguageLabel = $state("Interface Language");
  let startAtLabel = $state("Start");
  let endAtLabel = $state("End");
  let remainingLabel = $state("Remaining");
  let noEventLabel = $state("No current event data.");
  let nowMs = $state(Date.now());

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
    remainingLabel = tCommon("remaining", "Remaining");
    primarySecondaryLabel = primarySecondaryLabelByLocale[normalizeUiLocale(locale)];
    noEventLabel = noEventTextByLocale[normalizeUiLocale(locale)];
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

  const formatTime = (value: string | number | null): string => {
    const timestamp = toTimestampMs(value);
    if (!timestamp) {
      return "--";
    }

    return new Intl.DateTimeFormat(displayLocale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(timestamp);
  };

  const getRemaining = (value: string | number | null): CountdownValues => {
    const endAtMs = toTimestampMs(value);
    if (!endAtMs) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
    }

    const diff = Math.max(0, endAtMs - nowMs);
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds };
  };

  const countdownStyle = (value: number, digits = 2): string =>
    `--value:${value}; --digits:${digits};`;

  onMount(() => {
    const timer = window.setInterval(() => {
      nowMs = Date.now();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  });

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
    {#if card.event}
      <a
        id={`region-${card.region}`}
        href={toEventHref(card.event.id, card.region)}
        class="card group w-full bg-base-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md md:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]"
      >
        <div class="card-body">
          <div class="relative mb-3 aspect-[61/26] overflow-hidden rounded-xl border border-base-content/15 bg-base-200/50">
            {#if card.event.assetBundleName}
              <img
                src={getEventBannerAssetURL(card.event.assetBundleName, card.region)}
                alt={`${card.event.title} banner`}
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            {:else}
              <div class="flex h-full w-full items-center justify-center text-sm opacity-70">
                {card.label}
              </div>
            {/if}
            <span class="badge badge-primary absolute right-2 top-2 border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
              {card.region.toUpperCase()}
            </span>
          </div>

          <h3 class="text-base font-semibold leading-tight">{card.event.title}</h3>
          <p class="text-sm opacity-70">ID: {card.event.id}</p>
          <p class="text-sm">{startAtLabel}: {formatTime(card.event.startAt)}</p>
          <p class="text-sm">{endAtLabel}: {formatTime(card.event.endAt)}</p>

          <div class="mt-1 rounded-xl border border-base-content/12 bg-base-200/45 p-2.5">
            <p class="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] opacity-70">
              {remainingLabel}
            </p>
            <div class="grid grid-cols-4 gap-1.5">
              <div class="rounded-lg bg-base-100/92 px-1 py-1.5 text-center shadow-sm">
                <span class="countdown font-mono text-lg font-semibold">
                  <span style={countdownStyle(getRemaining(card.event.endAt).days)}>
                    {getRemaining(card.event.endAt).days}
                  </span>
                </span>
                <p class="text-[0.62rem] opacity-70">天</p>
              </div>
              <div class="rounded-lg bg-base-100/92 px-1 py-1.5 text-center shadow-sm">
                <span class="countdown font-mono text-lg font-semibold">
                  <span style={countdownStyle(getRemaining(card.event.endAt).hours)}>
                    {getRemaining(card.event.endAt).hours}
                  </span>
                </span>
                <p class="text-[0.62rem] opacity-70">时</p>
              </div>
              <div class="rounded-lg bg-base-100/92 px-1 py-1.5 text-center shadow-sm">
                <span class="countdown font-mono text-lg font-semibold">
                  <span style={countdownStyle(getRemaining(card.event.endAt).minutes)}>
                    {getRemaining(card.event.endAt).minutes}
                  </span>
                </span>
                <p class="text-[0.62rem] opacity-70">分</p>
              </div>
              <div class="rounded-lg bg-base-100/92 px-1 py-1.5 text-center shadow-sm">
                <span class="countdown font-mono text-lg font-semibold">
                  <span style={countdownStyle(getRemaining(card.event.endAt).seconds)}>
                    {getRemaining(card.event.endAt).seconds}
                  </span>
                </span>
                <p class="text-[0.62rem] opacity-70">秒</p>
              </div>
            </div>
          </div>
        </div>
      </a>
    {:else}
      <article id={`region-${card.region}`} class="card w-full bg-base-100 shadow-sm md:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
        <div class="card-body">
          <div class="relative mb-3 aspect-[61/26] overflow-hidden rounded-xl border border-base-content/15 bg-base-200/50">
            <div class="flex h-full w-full items-center justify-center text-sm opacity-70">{card.label}</div>
            <span class="badge badge-primary absolute right-2 top-2 border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
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
</section>
