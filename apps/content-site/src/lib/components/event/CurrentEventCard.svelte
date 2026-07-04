<script lang="ts">
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { getEventBannerAssetURL } from "$lib/assets/index";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import EventCardFrame from "$lib/components/shared/EventCardFrame.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import EventCountdownCard from "$lib/components/event/EventCountdownCard.svelte";
  import {
    CURRENT_EVENT_CARD_FRAME_CLASS,
    EVENT_CARD_IMAGE_CLASS,
    EVENT_CARD_MEDIA_CLASS
  } from "$lib/styles/event-card";
  import { formatUnitFallbackLabel } from "$lib/domain/unit-profile";

  type CurrentEventSummary = {
    id: string;
    title: string;
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
    idLabel,
    mixedUnitLabel,
    unitProfiles,
    bannerAltSuffix
  }: {
    region: SupportedRegion;
    regionLabel: string;
    event: CurrentEventSummary;
    uiLocale: string;
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
</script>

<EventCardFrame
  id={`region-${region}`}
  href={resolve("/event/[region]/[id]", { region, id: event.id })}
  frameClass={CURRENT_EVENT_CARD_FRAME_CLASS}
>
  <div class={EVENT_CARD_MEDIA_CLASS}>
    {#if event.assetBundleName}
      <EventAssetImage
        src={getEventBannerAssetURL(event.assetBundleName, region)}
        alt={`${event.title} ${bannerAltSuffix}`}
        imageClass={EVENT_CARD_IMAGE_CLASS}
        buttonClass="block w-full overflow-hidden"
      />
    {:else}
      <div class="flex size-full items-center justify-center text-sm opacity-70">
        {regionLabel}
      </div>
    {/if}

    <div class="absolute right-3 top-3 max-md:hidden">
      <span class="badge border-none bg-primary font-semibold text-primary-content shadow-sm">
        {region.toUpperCase()}
      </span>
    </div>
  </div>

  <h3 class="text-base/tight font-semibold">
    {event.title}
  </h3>
  <div class="flex items-center gap-2 text-sm">
    <p class="opacity-70">{idLabel}{event.id}</p>
    {#if displayUnit}
      <UnitIconBadge unit={event.unit!} fallbackLabel={displayUnit} />
    {/if}
  </div>

  <EventCountdownCard startAt={event.startAt} endAt={event.endAt} {uiLocale} class="mt-1" />
</EventCardFrame>
