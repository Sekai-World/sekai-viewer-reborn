<script lang="ts">
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/regions";
  import { getEventBannerAssetURL } from "$lib/assets";
  import { toTimestampMs } from "$lib/date-time";
  import EventAssetImage from "$lib/components/EventAssetImage.svelte";
  import { getEventTypeDisplay } from "$lib/event";
  import EventCardFrame from "$lib/components/EventCardFrame.svelte";
  import {
    EVENT_LIST_CARD_FRAME_CLASS,
    EVENT_LIST_CARD_IMAGE_CLASS,
    EVENT_LIST_CARD_MEDIA_CLASS,
    EVENT_LIST_CARD_TITLE_CLASS
  } from "$lib/styles/event-card";

  type EventListCardItem = {
    id: string;
    title: string;
    eventType: string | null;
    unit: string | null;
    assetBundleName: string | null;
    startAt: string | number | null;
  };

  let {
    region,
    item,
    currentEventId,
    currentEventLabel,
    spoilerContentLabel,
    uiLocale,
    idLabel,
    bannerAltSuffix
  }: {
    region: SupportedRegion;
    item: EventListCardItem;
    currentEventId: string | null;
    currentEventLabel: string;
    spoilerContentLabel: string;
    uiLocale: string;
    idLabel: string;
    bannerAltSuffix: string;
  } = $props();

  const isCurrentEvent = (): boolean => currentEventId === item.id;
  let spoilerRevealed = $state(false);
  let lastSpoilerIdentity = $state("");

  const unitIconClassByUnit: Record<string, string> = {
    idol: "event-list-unit-idol",
    light_sound: "event-list-unit-light-sound",
    piapro: "event-list-unit-piapro",
    school_refusal: "event-list-unit-school-refusal",
    street: "event-list-unit-street",
    theme_park: "event-list-unit-theme-park"
  };

  const getUnitIconClass = (unit: string | null | undefined): string => {
    if (!unit) {
      return "";
    }

    return unitIconClassByUnit[unit] ?? "";
  };

  const hasSpoiler = (): boolean => {
    const startAtMs = toTimestampMs(item.startAt);
    return startAtMs !== null && startAtMs > Date.now();
  };

  const isSpoilerHidden = (): boolean => hasSpoiler() && !spoilerRevealed;

  $effect(() => {
    const nextSpoilerIdentity = `${region}:${item.id}`;
    if (lastSpoilerIdentity !== nextSpoilerIdentity) {
      lastSpoilerIdentity = nextSpoilerIdentity;
      spoilerRevealed = false;
    }
  });

  const handleCardClick = (event: MouseEvent): void => {
    if (!isSpoilerHidden()) {
      return;
    }

    event.preventDefault();
    spoilerRevealed = true;
  };
</script>

<EventCardFrame
  href={resolve("/event/[region]/[id]", { region, id: item.id })}
  frameClass={EVENT_LIST_CARD_FRAME_CLASS}
  useBody={false}
  onclick={handleCardClick}
>
  <div
    class={`transition-[filter,transform,opacity] duration-150 ease-out ${
      isSpoilerHidden() ? "scale-[1.01] blur-md" : ""
    }`}
  >
    <div class={`${EVENT_LIST_CARD_MEDIA_CLASS} ${getUnitIconClass(item.unit)}`}>
      {#if item.assetBundleName}
        <EventAssetImage
          src={getEventBannerAssetURL(item.assetBundleName, region)}
          alt={`${item.title} ${bannerAltSuffix}`}
          imageClass={EVENT_LIST_CARD_IMAGE_CLASS}
          buttonClass="block h-full w-full overflow-hidden"
        />
      {:else}
        <div
          class="flex h-full w-full items-center justify-center px-6 text-center text-sm opacity-70"
        >
          {item.title}
        </div>
      {/if}

      <div class="absolute left-3 top-3">
        <span
          class="badge border-none bg-base-100/94 font-semibold text-base-content shadow-sm"
        >
          {idLabel}{item.id}
        </span>
      </div>

      <div class="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        {#if getEventTypeDisplay(item.eventType, uiLocale)}
          <span
            class="badge border-none bg-base-100/94 font-semibold text-base-content shadow-sm"
          >
            {getEventTypeDisplay(item.eventType, uiLocale)}
          </span>
        {/if}
      </div>

      {#if isCurrentEvent()}
        <div class="absolute bottom-3 right-3">
          <span class="badge border-none bg-primary font-semibold text-primary-content shadow-sm">
            {currentEventLabel}
          </span>
        </div>
      {/if}
    </div>

    <div class="px-4 pb-4 pt-3">
      <h2 class={EVENT_LIST_CARD_TITLE_CLASS}>{item.title}</h2>
    </div>
  </div>

  {#if isSpoilerHidden()}
    <div
      class="event-list-spoiler-overlay absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center backdrop-blur-[4px]"
    >
      <div
        class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-error/70 text-2xl font-black leading-none text-error"
      >
        !
      </div>
      <span class="text-sm font-semibold tracking-[0.12em] text-error">{spoilerContentLabel}</span>
    </div>
  {/if}
</EventCardFrame>
