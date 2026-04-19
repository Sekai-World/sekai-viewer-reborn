<script lang="ts">
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "@platform/i18n-dicts";
  import { getEventBannerAssetURL } from "$lib/assets";
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
    assetBundleName: string | null;
  };

  let {
    region,
    item,
    uiLocale,
    idLabel,
    bannerAltSuffix
  }: {
    region: SupportedRegion;
    item: EventListCardItem;
    uiLocale: string;
    idLabel: string;
    bannerAltSuffix: string;
  } = $props();
</script>

<EventCardFrame
  href={resolve("/event/[region]/[id]", { region, id: item.id })}
  frameClass={EVENT_LIST_CARD_FRAME_CLASS}
  useBody={false}
>
  <div class={EVENT_LIST_CARD_MEDIA_CLASS}>
    {#if item.assetBundleName}
      <img
        src={getEventBannerAssetURL(item.assetBundleName, region)}
        alt={`${item.title} ${bannerAltSuffix}`}
        loading="lazy"
        class={EVENT_LIST_CARD_IMAGE_CLASS}
      />
    {:else}
      <div class="flex h-full w-full items-center justify-center px-6 text-center text-sm opacity-70">
        {item.title}
      </div>
    {/if}

    <div class="absolute left-3 top-3">
      <span class="badge border-none bg-base-100/92 font-semibold text-base-content shadow-sm backdrop-blur-sm">
        {idLabel}: {item.id}
      </span>
    </div>

    {#if getEventTypeDisplay(item.eventType, uiLocale)}
      <div class="absolute right-3 top-3">
        <span class="badge border-none bg-base-100/92 font-semibold text-base-content shadow-sm backdrop-blur-sm">
          {getEventTypeDisplay(item.eventType, uiLocale)}
        </span>
      </div>
    {/if}
  </div>

  <div class="px-4 pb-4 pt-3">
    <h2 class={EVENT_LIST_CARD_TITLE_CLASS}>{item.title}</h2>
  </div>
</EventCardFrame>
