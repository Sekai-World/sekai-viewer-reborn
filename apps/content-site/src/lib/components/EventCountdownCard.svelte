<script lang="ts">
  import { browser } from "$app/environment";
  import { getContentSiteCommonText } from "@platform/i18n-dicts";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { DEFAULT_UI_LOCALE } from "$lib/region";
  import { onMount } from "svelte";

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

  let {
    startAt,
    endAt,
    uiLocale,
    class: className = ""
  }: {
    startAt: string | number | null;
    endAt: string | number | null;
    uiLocale: string;
    class?: string;
  } = $props();

  const initialLocale = DEFAULT_UI_LOCALE;
  let startsInLabel = $state(getContentSiteCommonText(initialLocale, "countdownStartsIn"));
  let endsInLabel = $state(getContentSiteCommonText(initialLocale, "countdownEndsIn"));
  let eventEndedLabel = $state(getContentSiteCommonText(initialLocale, "eventEnded"));
  let dayLabel = $state(getContentSiteCommonText(initialLocale, "labels.timeUnit.day"));
  let hourLabel = $state(getContentSiteCommonText(initialLocale, "labels.timeUnit.hour"));
  let minuteLabel = $state(getContentSiteCommonText(initialLocale, "labels.timeUnit.minute"));
  let secondLabel = $state(getContentSiteCommonText(initialLocale, "labels.timeUnit.second"));
  let nowMs = $state(Date.now());

  $effect(() => {
    applyTranslations(uiLocale);
  });

  $effect(() => {
    if (!browser) {
      return;
    }

    void refreshTranslations(uiLocale);
  });

  const applyTranslations = (localeValue: string): void => {
    startsInLabel = tCommon(localeValue, "countdownStartsIn");
    endsInLabel = tCommon(localeValue, "countdownEndsIn");
    eventEndedLabel = tCommon(localeValue, "eventEnded");
    dayLabel = tCommon(localeValue, "labels.timeUnit.day");
    hourLabel = tCommon(localeValue, "labels.timeUnit.hour");
    minuteLabel = tCommon(localeValue, "labels.timeUnit.minute");
    secondLabel = tCommon(localeValue, "labels.timeUnit.second");
  };

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    applyTranslations(locale);
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

  const getCountdownState = (
    startAtValue: string | number | null,
    endAtValue: string | number | null
  ): CountdownState => {
    const startAtMs = toTimestampMs(startAtValue);
    const endAtMs = toTimestampMs(endAtValue);

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

  const getMinuteBarClass = (toneClass: string): string => {
    if (toneClass === "text-error") {
      return "bg-error/85";
    }

    if (toneClass === "text-warning") {
      return "bg-warning/90";
    }

    return "bg-primary/80";
  };

  const countdown = $derived(getCountdownState(startAt, endAt));

  onMount(() => {
    const tick = () => {
      nowMs = Date.now();
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  });
</script>

<div class={`content-card-inset rounded-xl p-2.5 ${className}`.trim()}>
  {#if countdown.mode === "ended"}
    <p class="text-sm font-semibold opacity-80">{countdown.label}</p>
  {:else}
    <p class={`mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${countdown.toneClass}`}>
      {countdown.label}
    </p>
    <div class={`grid gap-1.5 ${countdown.showSeconds ? "grid-cols-4" : "grid-cols-3"} ${countdown.toneClass}`}>
      <div class="content-card-elevated rounded-lg px-1 py-1.5 text-center shadow-sm">
        <span class="countdown font-mono text-lg font-semibold">
          <span style={countdownStyle(countdown.values.days)}>{countdown.values.days}</span>
        </span>
        <p class="text-[0.62rem] opacity-80">{dayLabel}</p>
      </div>
      <div class="content-card-elevated rounded-lg px-1 py-1.5 text-center shadow-sm">
        <span class="countdown font-mono text-lg font-semibold">
          <span style={countdownStyle(countdown.values.hours)}>{countdown.values.hours}</span>
        </span>
        <p class="text-[0.62rem] opacity-80">{hourLabel}</p>
      </div>
      <div class="content-card-elevated rounded-lg px-1 py-1.5 text-center shadow-sm">
        <span class="countdown font-mono text-lg font-semibold">
          <span style={countdownStyle(countdown.values.minutes)}>{countdown.values.minutes}</span>
        </span>
        <p class="text-[0.62rem] opacity-80">{minuteLabel}</p>
      </div>
      {#if countdown.showSeconds}
        <div class="content-card-elevated rounded-lg px-1 py-1.5 text-center shadow-sm">
          <span class="countdown font-mono text-lg font-semibold">
            <span style={countdownStyle(countdown.values.seconds)}>{countdown.values.seconds}</span>
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
