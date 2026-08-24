<script lang="ts">
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { getEventBannerAssetURL } from "$lib/assets/index";
  import { formatDisplayDateTime, toTimestampMs } from "$lib/time/date-time";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import { getEventTypeDisplay } from "$lib/domain/event";
  import EventCardFrame from "$lib/components/shared/EventCardFrame.svelte";
  import { UnitIconBadge } from "@platform/ui-shell";
  import type { I18nTranslator } from "@platform/i18n-runtime";
  import {
    EVENT_LIST_CARD_FRAME_CLASS,
    EVENT_LIST_CARD_IMAGE_CLASS,
    EVENT_LIST_CARD_MEDIA_CLASS,
    EVENT_CARD_META_BADGE_CLASS,
    EVENT_LIST_CARD_TITLE_CLASS
  } from "$lib/styles/event-card";

  type EventListCardItem = {
    id: string;
    title: string;
    eventType: string | null;
    unit: string | null;
    assetBundleName: string | null;
    startAt: string | number | null;
    endAt: string | number | null;
  };

  let {
    region,
    item,
    ongoingEventIds,
    currentEventLabel,
    spoilerContentLabel,
    uiLocale,
    translate,
    idLabel,
    bannerAltSuffix
  }: {
    region: SupportedRegion;
    item: EventListCardItem;
    ongoingEventIds: Set<string>;
    currentEventLabel: string;
    spoilerContentLabel: string;
    uiLocale: string;
    translate: I18nTranslator;
    idLabel: string;
    bannerAltSuffix: string;
  } = $props();

  const isCurrentEvent = (): boolean => ongoingEventIds.has(item.id);
  const contentDisplaySettings = getContentDisplaySettings();
  const spoilerRevealAnimationMs = 180;
  let spoilerRevealed = $state(false);
  let spoilerRevealAnimating = $state(false);
  let lastSpoilerIdentity = $state("");
  let spoilerRevealTimeout: ReturnType<typeof setTimeout> | null = null;

  const hasSpoiler = (): boolean => {
    const startAtMs = toTimestampMs(item.startAt);
    return startAtMs !== null && startAtMs > Date.now();
  };

  const isSpoilerContentMosaicked = (): boolean =>
    hasSpoiler() && contentDisplaySettings.mosaickedSpoilerContent && !spoilerRevealed;

  const isSpoilerPlaceholderVisible = (): boolean =>
    hasSpoiler() &&
    contentDisplaySettings.mosaickedSpoilerContent &&
    (!spoilerRevealed || spoilerRevealAnimating);

  const formatEventDateTime = (value: string | number | null): string => {
    const timestampMs = toTimestampMs(value);
    return formatDisplayDateTime(timestampMs ?? value, uiLocale);
  };

  const getEventTimeRange = (): string =>
    `${formatEventDateTime(item.startAt)} - ${formatEventDateTime(item.endAt)}`;

  const clearSpoilerRevealTimeout = (): void => {
    if (spoilerRevealTimeout === null) {
      return;
    }

    clearTimeout(spoilerRevealTimeout);
    spoilerRevealTimeout = null;
  };

  $effect(() => {
    const nextSpoilerIdentity = `${region}:${item.id}`;
    if (lastSpoilerIdentity === nextSpoilerIdentity) {
      return;
    }

    clearSpoilerRevealTimeout();
    lastSpoilerIdentity = nextSpoilerIdentity;
    spoilerRevealed = false;
    spoilerRevealAnimating = false;

    return clearSpoilerRevealTimeout;
  });

  const handleCardClick = (event: MouseEvent): void => {
    if (!isSpoilerContentMosaicked()) {
      return;
    }

    event.preventDefault();
    spoilerRevealAnimating = true;
    clearSpoilerRevealTimeout();
    spoilerRevealTimeout = setTimeout(() => {
      spoilerRevealed = true;
      spoilerRevealAnimating = false;
      spoilerRevealTimeout = null;
    }, spoilerRevealAnimationMs);
  };
</script>

{#snippet mosaicOverlay()}
  <div
    class={`event-list-spoiler-mosaic-overlay flex size-full flex-col items-center justify-center gap-3 px-6 text-center backdrop-blur-2xl transition-opacity duration-180 ease-out ${spoilerRevealAnimating ? "opacity-0" : "opacity-100"}`}
  >
    <div
      class="flex size-9 items-center justify-center rounded-full border-2 border-error/70 text-2xl font-black leading-none text-error"
    >
      !
    </div>
    <span class="text-sm font-semibold tracking-[0.12em] text-error">{spoilerContentLabel}</span>
  </div>
{/snippet}

<EventCardFrame
  href={resolve("/event/[region]/[id]", { region, id: item.id })}
  frameClass={EVENT_LIST_CARD_FRAME_CLASS}
  useBody={false}
  overlay={isSpoilerPlaceholderVisible() ? mosaicOverlay : undefined}
  onclick={handleCardClick}
>
  {#if isSpoilerPlaceholderVisible()}
    <div class={EVENT_LIST_CARD_MEDIA_CLASS}>
      <div class="size-full rounded-xl bg-base-200/60"></div>
    </div>

    <div class="px-4 pb-4 pt-3">
      <div class="h-10 rounded-lg bg-base-200/60"></div>
    </div>
  {:else}
    <div class={EVENT_LIST_CARD_MEDIA_CLASS}>
      {#if isCurrentEvent()}
        <span
          class="badge absolute right-3 top-3 z-10 border-none bg-primary font-semibold text-primary-content shadow-sm"
        >
          {currentEventLabel}
        </span>
      {/if}
      {#if item.assetBundleName}
        <AssetImage
          src={getEventBannerAssetURL(item.assetBundleName, region)}
          alt={`${item.title} ${bannerAltSuffix}`}
          imageClass={EVENT_LIST_CARD_IMAGE_CLASS}
          buttonClass="block h-full w-full overflow-hidden"
          loadMode="visible"
        />
      {:else}
        <div class="flex size-full items-center justify-center px-6 text-center text-sm opacity-70">
          {item.title}
        </div>
      {/if}
    </div>

    <div class="flex flex-wrap items-center gap-1.5 px-4 pt-3">
      <span class={EVENT_CARD_META_BADGE_CLASS}>
        {idLabel}{item.id}
      </span>
      {#if getEventTypeDisplay(item.eventType, translate)}
        <span class={EVENT_CARD_META_BADGE_CLASS}>
          {getEventTypeDisplay(item.eventType, translate)}
        </span>
      {/if}
    </div>

    <div class="flex items-start gap-2 px-4 pb-4 pt-3">
      <div class="min-w-0 flex-1">
        <h2 class={EVENT_LIST_CARD_TITLE_CLASS}>{item.title}</h2>
        <p class="mt-1 text-xs/relaxed opacity-65">{getEventTimeRange()}</p>
      </div>
      {#if item.unit}
        <UnitIconBadge unit={item.unit} class="mt-0.5 shrink-0" />
      {/if}
    </div>
  {/if}
</EventCardFrame>
