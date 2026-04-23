<script lang="ts">
  import { resolve } from "$app/paths";
  import type { SupportedRegion } from "@platform/i18n-dicts";
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

  type RegionVersions = {
    dataVersion: string | null;
    assetVersion: string | null;
    cdnVersion: string | null;
  };

  let {
    region,
    regionLabel,
    event,
    versions = null,
    uiLocale,
    idLabel,
    bannerAltSuffix
  }: {
    region: SupportedRegion;
    regionLabel: string;
    event: CurrentEventSummary;
    versions?: RegionVersions | null;
    uiLocale: string;
    idLabel: string;
    bannerAltSuffix: string;
  } = $props();

  const isNuverseRegion = (regionValue: SupportedRegion): boolean =>
    regionValue === "tw" || regionValue === "kr" || regionValue === "cn";

  const getDisplayAssetVersion = (
    regionValue: SupportedRegion,
    versionsValue: RegionVersions | null
  ): string | null => {
    if (!versionsValue?.assetVersion) {
      return null;
    }

    if (isNuverseRegion(regionValue) && versionsValue.cdnVersion) {
      return `${versionsValue.assetVersion} - ${versionsValue.cdnVersion}`;
    }

    return versionsValue.assetVersion;
  };

  const displayDataVersion = $derived(versions?.dataVersion ?? null);
  const displayAssetVersion = $derived(getDisplayAssetVersion(region, versions));
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

    <div class="absolute right-3 top-3">
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

  {#if displayDataVersion || displayAssetVersion}
    <div class="mt-3 flex flex-wrap gap-2">
      {#if displayDataVersion}
        <span class="badge badge-outline border-base-content/15 px-2.5 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em]">
          DATA {displayDataVersion}
        </span>
      {/if}
      {#if displayAssetVersion}
        <span class="badge badge-outline border-base-content/15 px-2.5 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em]">
          ASSET {displayAssetVersion}
        </span>
      {/if}
    </div>
  {/if}
</EventCardFrame>
