<script lang="ts">
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/i18n-data";
  import { getEventBannerAssetURL } from "$lib/assets";
  import EventCardFrame from "$lib/components/EventCardFrame.svelte";
  import EventCountdownCard from "$lib/components/EventCountdownCard.svelte";
  import {
    CURRENT_EVENT_CARD_FRAME_CLASS,
    EVENT_CARD_IMAGE_CLASS,
    EVENT_CARD_MEDIA_CLASS
  } from "$lib/styles/event-card";

  type CurrentEventSummary = {
    id: string;
    title: string;
    startAt: string | number | null;
    endAt: string | number | null;
    assetBundleName: string | null;
  };

  let {
    region,
    regionLabel,
    event,
    uiLocale,
    idLabel,
    bannerAltSuffix
  }: {
    region: SupportedRegion;
    regionLabel: string;
    event: CurrentEventSummary;
    uiLocale: string;
    idLabel: string;
    bannerAltSuffix: string;
  } = $props();
</script>

<EventCardFrame
  id={`region-${region}`}
  href={resolve("/event/[region]/[id]", { region, id: event.id })}
  frameClass={CURRENT_EVENT_CARD_FRAME_CLASS}
>
  <div class={EVENT_CARD_MEDIA_CLASS}>
    {#if event.assetBundleName}
      <img
        src={getEventBannerAssetURL(event.assetBundleName, region)}
        alt={`${event.title} ${bannerAltSuffix}`}
        loading="lazy"
        class={EVENT_CARD_IMAGE_CLASS}
      />
    {:else}
      <div class="flex h-full w-full items-center justify-center text-sm opacity-70">
        {regionLabel}
      </div>
    {/if}

    <div class="absolute right-3 top-3 max-md:hidden">
      <span class="badge border-none bg-primary font-semibold text-primary-content shadow-sm">
        {region.toUpperCase()}
      </span>
    </div>
  </div>

  <h3 class="text-base font-semibold leading-tight">
    {event.title}
  </h3>
  <div class="flex items-center gap-2 text-sm opacity-70">
    <p>{idLabel}{event.id}</p>
  </div>

  <EventCountdownCard
    startAt={event.startAt}
    endAt={event.endAt}
    {uiLocale}
    class="mt-1"
  />
</EventCardFrame>
