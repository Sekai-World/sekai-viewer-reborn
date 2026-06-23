<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/regions";
  import { getEventBannerAssetURL } from "$lib/assets";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import EventCardFrame from "$lib/components/shared/EventCardFrame.svelte";
  import EventCountdownCard from "$lib/components/event/EventCountdownCard.svelte";
  import {
    CURRENT_EVENT_CARD_FRAME_CLASS,
    EVENT_CARD_IMAGE_CLASS,
    EVENT_CARD_MEDIA_CLASS
  } from "$lib/styles/event-card";
  import { formatUnitFallbackLabel } from "$lib/unit-profile";

  type CurrentEventSummary = {
    id: string;
    title: string;
    unit: string | null;
    startAt: string | number | null;
    endAt: string | number | null;
    assetBundleName: string | null;
  };

  const unitIconSlugs = new Set([
    "idol",
    "light_sound",
    "piapro",
    "school_refusal",
    "street",
    "theme_park"
  ]);

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

  const getUnitIconUrl = (unit: string | null | undefined): string | null => {
    if (!unit) {
      return null;
    }

    const slug = unit.trim().toLowerCase();
    return unitIconSlugs.has(slug) ? asset(`/icons/icon_${slug}.png`) : null;
  };

  const getDisplayUnit = (unit: string | null | undefined): string | null => {
    if (!unit) {
      return null;
    }

    const normalizedUnit = unit.trim().toLowerCase();
    return normalizedUnit === "none" || normalizedUnit === "-"
      ? mixedUnitLabel
      : (unitProfiles[normalizedUnit] ?? formatUnitFallbackLabel(normalizedUnit));
  };

  const unitIconUrl = $derived(getUnitIconUrl(event.unit));
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
      <span
        class="{unitIconUrl
          ? 'unit-icon-frame size-8 border-base-content/15'
          : 'h-7 min-w-7 border-base-content/15 px-1'} inline-flex items-center justify-center rounded-full border text-[0.65rem] font-semibold leading-none"
      >
        {#if unitIconUrl}
          <img
            src={unitIconUrl}
            alt=""
            aria-hidden="true"
            class="size-9 max-w-none shrink-0 object-contain"
            loading="lazy"
            decoding="async"
          />
        {:else}
          <span class="opacity-70">{displayUnit}</span>
        {/if}
      </span>
    {/if}
  </div>

  <EventCountdownCard startAt={event.startAt} endAt={event.endAt} {uiLocale} class="mt-1" />
</EventCardFrame>
