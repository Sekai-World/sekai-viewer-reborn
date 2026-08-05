<script lang="ts">
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { getEventBannerAssetURL } from "$lib/assets/index";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import EventCardFrame from "$lib/components/shared/EventCardFrame.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import EventCountdownCard from "$lib/components/event/EventCountdownCard.svelte";
  import { getEventTypeDisplay } from "$lib/domain/event";
  import {
    CURRENT_EVENT_CARD_FRAME_CLASS,
    EVENT_CARD_IMAGE_CLASS,
    EVENT_CARD_META_BADGE_CLASS,
    EVENT_CARD_MEDIA_CLASS
  } from "$lib/styles/event-card";
  import { formatUnitFallbackLabel } from "$lib/domain/unit-profile";
  import type { I18nMessages, I18nTranslator } from "@platform/i18n-runtime";

  type CurrentEventSummary = {
    id: string;
    title: string;
    eventType: string | null;
    unit: string | null;
    startAt: string | number | null;
    endAt: string | number | null;
    assetBundleName: string | null;
  };

  let {
    region,
    regionLabel,
    event,
    uiLocale,
    messages,
    translate,
    idLabel,
    mixedUnitLabel,
    unitProfiles,
    bannerAltSuffix
  }: {
    region: SupportedRegion;
    regionLabel: string;
    event: CurrentEventSummary;
    uiLocale: string;
    messages: I18nMessages;
    translate: I18nTranslator;
    idLabel: string;
    mixedUnitLabel: string;
    unitProfiles: Record<string, string>;
    bannerAltSuffix: string;
  } = $props();

  const getDisplayUnit = (unit: string | null | undefined): string | null => {
    if (!unit) {
      return null;
    }

    const normalizedUnit = unit.trim().toLowerCase();
    return normalizedUnit === "none" || normalizedUnit === "-"
      ? mixedUnitLabel
      : (unitProfiles[normalizedUnit] ?? formatUnitFallbackLabel(normalizedUnit));
  };

  const displayUnit = $derived(getDisplayUnit(event.unit));
  const displayEventType = $derived(getEventTypeDisplay(event.eventType, translate));
</script>

<EventCardFrame
  id={`region-${region}`}
  href={resolve("/event/[region]/[id]", { region, id: event.id })}
  frameClass={CURRENT_EVENT_CARD_FRAME_CLASS}
>
  <div
    class={`${EVENT_CARD_MEDIA_CLASS} lg:mx-auto lg:mb-4 lg:aspect-3/1 lg:w-[82%] lg:px-[6%] lg:py-[3%]`}
  >
    {#if event.assetBundleName}
      <AssetImage
        src={getEventBannerAssetURL(event.assetBundleName, region)}
        alt={`${event.title} ${bannerAltSuffix}`}
        imageClass={EVENT_CARD_IMAGE_CLASS}
        buttonClass="block h-full w-full overflow-hidden"
      />
    {:else}
      <div class="flex size-full items-center justify-center text-sm opacity-70">
        {regionLabel}
      </div>
    {/if}
  </div>

  <div class="flex min-w-0 items-start gap-2">
    <div class="min-w-0 flex-1">
      <div class="mb-2 flex flex-wrap items-center gap-1.5">
        <span class={EVENT_CARD_META_BADGE_CLASS}>{idLabel}{event.id}</span>
        {#if displayEventType}
          <span class={EVENT_CARD_META_BADGE_CLASS}>{displayEventType}</span>
        {/if}
      </div>
      <h3 class="text-base/tight font-semibold">{event.title}</h3>
    </div>
    {#if displayUnit}
      <UnitIconBadge unit={event.unit!} fallbackLabel={displayUnit} variant="sm" />
    {/if}
  </div>

  <EventCountdownCard
    startAt={event.startAt}
    endAt={event.endAt}
    {uiLocale}
    {messages}
    class="mt-0"
  />
</EventCardFrame>
