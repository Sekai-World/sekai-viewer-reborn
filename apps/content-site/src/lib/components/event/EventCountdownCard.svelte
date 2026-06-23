<script lang="ts">
  import { browser } from "$app/environment";
  import { toTimestampMs } from "$lib/date-time";
  import { setI18nLocale, tCommon } from "$lib/i18n";
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
  };

  let {
    startAt,
    endAt,
    uiLocale,
    forceShowSeconds = false,
    showProgress = true,
    class: className = ""
  }: {
    startAt: string | number | null;
    endAt: string | number | null;
    uiLocale: string;
    forceShowSeconds?: boolean;
    showProgress?: boolean;
    class?: string;
  } = $props();

  const getInitialLabel = (key: string): string => tCommon(uiLocale, key);
  let startsInLabel = $state(getInitialLabel("countdownStartsIn"));
  let endsInLabel = $state(getInitialLabel("countdownEndsIn"));
  let eventEndedLabel = $state(getInitialLabel("eventEnded"));
  let dayLabel = $state(getInitialLabel("labels.timeUnit.day"));
  let hourLabel = $state(getInitialLabel("labels.timeUnit.hour"));
  let minuteLabel = $state(getInitialLabel("labels.timeUnit.minute"));
  let secondLabel = $state(getInitialLabel("labels.timeUnit.second"));
  let nowMs = $state(Date.now());
  let progressNowMs = $state(Date.now());
  let mounted = $state(false);
  let progressAnimationFrameId = 0;
  let progressClockBaseMs = 0;
  let progressClockBaseFrame = 0;
  let lastRenderedSecond = -1;

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

  const isCountdownActiveAt = (
    startAtValue: string | number | null,
    endAtValue: string | number | null,
    timestampMs: number
  ): boolean => {
    const startAtMs = toTimestampMs(startAtValue);
    const endAtMs = toTimestampMs(endAtValue);

    if (startAtMs !== null && timestampMs < startAtMs) {
      return true;
    }

    if (endAtMs !== null && timestampMs < endAtMs) {
      return true;
    }

    return false;
  };

  const getMinuteProgressAt = (
    startAtValue: string | number | null,
    endAtValue: string | number | null,
    timestampMs: number
  ): number => {
    const startAtMs = toTimestampMs(startAtValue);
    const endAtMs = toTimestampMs(endAtValue);

    if (startAtMs !== null && timestampMs < startAtMs) {
      return getMinuteProgressPercent(startAtMs - timestampMs);
    }

    if (endAtMs !== null && timestampMs < endAtMs) {
      return getMinuteProgressPercent(endAtMs - timestampMs);
    }

    return 0;
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
        showSeconds: forceShowSeconds || diffMs < 24 * 60 * 60 * 1000
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
        showSeconds: forceShowSeconds || endDiff < 24 * 60 * 60 * 1000
      };
    }

    return {
      mode: "ended",
      label: eventEndedLabel,
      values: emptyCountdownValues(),
      toneClass: "text-base-content",
      showSeconds: false
    };
  };

  const countdownStyle = (value: number, digits = 2): string =>
    `--value:${value}; --digits:${digits};`;

  const getMinuteBarClass = (toneClass: string): string => {
    if (toneClass === "text-error") {
      return "bg-error/85";
    }

    if (toneClass.startsWith("text-warning")) {
      return "bg-warning/80";
    }

    return "bg-primary/80";
  };

  const countdown = $derived(getCountdownState(startAt, endAt));
  const minuteProgress = $derived(getMinuteProgressAt(startAt, endAt, progressNowMs));

  const syncProgressClockBase = (timestampMs = Date.now(), frameTime = 0): void => {
    progressClockBaseMs = timestampMs;
    progressClockBaseFrame = frameTime;
  };

  const getProgressTimestampMs = (frameTime: number): number => {
    if (progressClockBaseMs === 0) {
      syncProgressClockBase(Date.now(), frameTime);
    }

    return progressClockBaseMs + Math.max(0, frameTime - progressClockBaseFrame);
  };

  const stopProgressLoop = (): void => {
    if (progressAnimationFrameId) {
      window.cancelAnimationFrame(progressAnimationFrameId);
      progressAnimationFrameId = 0;
    }

    progressClockBaseMs = 0;
    progressClockBaseFrame = 0;
  };

  const syncCountdownClock = (timestampMs = Date.now(), frameTime = 0): void => {
    syncProgressClockBase(timestampMs, frameTime);
    const nextSecond = Math.floor(timestampMs / 1000);

    progressNowMs = timestampMs;

    if (nextSecond !== lastRenderedSecond) {
      lastRenderedSecond = nextSecond;
      nowMs = timestampMs;
    }
  };

  const startProgressLoop = (): void => {
    if (!mounted || progressAnimationFrameId) {
      return;
    }

    const tick = (frameTime: number): void => {
      if (!mounted) {
        stopProgressLoop();
        return;
      }

      let timestampMs = getProgressTimestampMs(frameTime);
      progressNowMs = timestampMs;

      const nextSecond = Math.floor(timestampMs / 1000);
      if (nextSecond !== lastRenderedSecond) {
        timestampMs = Date.now();
        syncCountdownClock(timestampMs, frameTime);
      }

      if (!isCountdownActiveAt(startAt, endAt, timestampMs)) {
        syncCountdownClock(timestampMs, frameTime);
        stopProgressLoop();
        return;
      }

      progressAnimationFrameId = window.requestAnimationFrame(tick);
    };

    progressAnimationFrameId = window.requestAnimationFrame(tick);
  };

  $effect(() => {
    if (!mounted) {
      return;
    }

    const timestampMs = Date.now();
    syncCountdownClock(timestampMs);

    if (isCountdownActiveAt(startAt, endAt, timestampMs)) {
      startProgressLoop();
    } else {
      stopProgressLoop();
    }

    return () => {
      stopProgressLoop();
    };
  });

  onMount(() => {
    mounted = true;
    syncCountdownClock();

    return () => {
      stopProgressLoop();
      mounted = false;
    };
  });
</script>

<div class={`content-card-inset rounded-xl p-2.5 ${className}`.trim()}>
  {#if countdown.mode === "ended"}
    <p class="text-sm font-semibold opacity-80">{countdown.label}</p>
  {:else}
    <p
      class={`mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${countdown.toneClass}`}
    >
      {countdown.label}
    </p>
    <div
      class={`grid gap-1.5 ${countdown.showSeconds ? "grid-cols-4" : "grid-cols-3"} ${countdown.toneClass}`}
    >
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
    {#if showProgress}
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-base-content/14">
        <div
          class={`h-full origin-right transition-[width] duration-100 ease-linear ${getMinuteBarClass(countdown.toneClass)}`}
          style={`width:${minuteProgress}%; margin-left:auto;`}
        ></div>
      </div>
    {/if}
  {/if}
</div>
