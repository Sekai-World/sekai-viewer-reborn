<script lang="ts">
  import { BrandLockup } from "@platform/ui-shell";
  import { UnitIconBadge } from "@platform/ui-shell";
  import AssetImage from "@platform/ui-shell/asset-image";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { RegionCurrentEvent } from "./+page.server";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import { trackerSupportedRegions, type TrackerSupportedRegion } from "$lib/regions";
  import { getEventBannerAssetURL } from "$lib/event-assets";
  import { getTrackerCountdown } from "$lib/tracker-countdown";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "tracker"]);
  let messages = $state(fallbackMessages);
  let events = $state<RegionCurrentEvent[] | null>(null);
  let now = $state(Date.now());
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));

  const regionName = (region: TrackerSupportedRegion): string => translate(`region.${region}`);
  const statusKey = (result: RegionCurrentEvent): string =>
    result.status === "available"
      ? "home.status.available"
      : result.status === "unavailable"
        ? "home.status.empty"
        : "home.status.failed";
  const isEventsLoading = $derived(events === null);
  const unitLabel = (unit: string): string =>
    unit.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
  const getCountdown = (event: Extract<RegionCurrentEvent, { status: "available" }>['event']) =>
    getTrackerCountdown({
      startAt: event.startAt,
      aggregateAt: event.aggregateAt,
      closedAt: event.closedAt,
      now
    });
  const formatCountdown = (event: Extract<RegionCurrentEvent, { status: "available" }>['event']): string => {
    const countdown = getCountdown(event);
    if (!countdown) return translate("home.countdownEnded");
    const values = countdown.values;
    const time = `${values.days}${translate("home.timeUnit.day")} ${String(values.hours).padStart(2, "0")}${translate("home.timeUnit.hour")} ${String(values.minutes).padStart(2, "0")}${translate("home.timeUnit.minute")} ${String(values.seconds).padStart(2, "0")}${translate("home.timeUnit.second")}`;
    return countdown.mode === "ends"
      ? `${translate("home.countdownEndsIn")} ${time}`
      : `${translate("home.countdownStartsIn")} ${time}`;
  };
  const bannerUrl = (result: Extract<RegionCurrentEvent, { status: "available" }>): string | null =>
    !result.event.assetBundleName ? null : getEventBannerAssetURL(result.event.assetBundleName, result.region);

  const formatDate = (value: string | number | null): string => {
    if (value === null) return translate("home.dateUnavailable");
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? translate("home.dateUnavailable")
      : new Intl.DateTimeFormat(data.uiLocale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC"
        }).format(date);
  };

  $effect(() => {
    void Promise.resolve(data.i18nMessages).then((next) => {
      messages = { ...fallbackMessages, ...next };
    });
  });
  onMount(() => {
    const clock = window.setInterval(() => (now = Date.now()), 1_000);
    return () => window.clearInterval(clock);
  });
  $effect(() => {
    let cancelled = false;
    events = null;
    const streamedEvents = data.events as unknown as Promise<RegionCurrentEvent[]>;
    void streamedEvents.then(
      (next) => {
        if (!cancelled) events = next;
      },
      () => {
        if (!cancelled) {
          events = trackerSupportedRegions.map((region) => ({ region, status: "failed", event: null }));
        }
      }
    );
    return () => (cancelled = true);
  });
</script>

<svelte:head><title>Sekai Viewer Tools</title></svelte:head>

<div class="tools-home">
  <div class="tools-home-lockup"><BrandLockup /></div>

  <section class="tools-hero" aria-labelledby="home-title">
    <p class="eyebrow">{translate("home.eyebrow")}</p>
    <div class="hero-copy">
      <div>
        <h1 id="home-title">{translate("home.title")}</h1>
        <p>{translate("home.description")}</p>
      </div>
      <a class="hero-action" href="/tracker/jp">
        <span>{translate("home.openTracker")}</span><span aria-hidden="true">↗</span>
      </a>
    </div>
  </section>

  <section
    class="region-grid"
    aria-label={translate("home.regionsTitle")}
    role={isEventsLoading ? "status" : undefined}
    aria-live={isEventsLoading ? "polite" : undefined}
    aria-busy={isEventsLoading}
  >
    <div class="section-heading">
      <div>
        <p class="eyebrow">{translate("home.liveEyebrow")}</p>
      </div>
      <span class="live-mark"><span></span>{translate("home.live")}</span>
    </div>
    <div class="event-grid">
      {#if isEventsLoading}
        {#each trackerSupportedRegions as region (region)}
          <article class="event-card event-card-skeleton" aria-hidden="true">
            <div class="card-topline">
              <span class="skeleton h-5 w-24"></span><span class="skeleton h-4 w-16 rounded-full"></span>
            </div>
            <div class="event-banner skeleton"></div>
            <div class="event-card-body gap-3">
              <span class="skeleton h-6 w-4/5"></span><span class="skeleton h-4 w-3/5"></span><span class="skeleton h-4 w-full"></span><span class="skeleton mt-auto h-5 w-28"></span>
            </div>
          </article>
        {/each}
        <span class="sr-only">{translate("home.eventsLoading")}</span>
      {:else}
      {#each events as result (result.region)}
        {#if result.status === "available"}
          {@const source = bannerUrl(result)}
          <a
            class="event-card event-card-link has-event"
            href={`/tracker/${result.region}?eventId=${result.event.id}`}
            aria-label={`${regionName(result.region)}: ${result.event.name} — ${translate("home.openRegionalTracker")}`}
          >
            <div class="card-topline">
              <span class="region-tag">{regionName(result.region)}</span>
              <span class="status-pill status-ready"><span aria-hidden="true"></span>{translate(statusKey(result))}</span>
            </div>
            <div class="event-banner">
              {#if source}
                <AssetImage src={source} alt={`${result.event.name} ${translate("home.bannerAltSuffix")}`} imageClass="h-full w-full object-contain" buttonClass="block size-full overflow-hidden" fallbackLabel={translate("home.bannerUnavailable")} />
              {:else}
                <div class="event-banner-fallback" aria-hidden="true"></div>
              {/if}
            </div>
            <div class="event-card-body">
              <h3 id={`result-${result.region}`}>{result.event.name}</h3>
              <div class="event-meta">
                {#if result.event.unit}
                  <UnitIconBadge
                    unit={result.event.unit}
                    fallbackLabel={unitLabel(result.event.unit)}
                    variant="sm"
                  />
                {:else}
                  <span>{translate("home.unitUnknown")}</span>
                {/if}
                <span>· {translate("home.eventId")} {result.event.id}</span>
              </div>
              <p class="event-time">{formatDate(result.event.startAt)} — {formatDate(result.event.aggregateAt ?? result.event.closedAt)}</p>
              <p class="event-countdown" aria-live="off">{formatCountdown(result.event)}</p>
              <span class="tracker-link">{translate("home.openRegionalTracker")} <span class="tracker-link-arrow" aria-hidden="true">→</span></span>
            </div>
          </a>
        {:else}
        <article class="event-card" aria-labelledby={`result-${result.region}`}>
          <div class="card-topline">
            <span class="region-tag">{regionName(result.region)}</span>
            <span class="status-pill"><span aria-hidden="true"></span>{translate(statusKey(result))}</span>
          </div>
        {#if result.status === "unavailable"}
          <div class="empty-card"><h3 id={`result-${result.region}`}>{translate("home.noEvent")}</h3><p>{translate("home.noEventDescription")}</p></div>
        {:else}
          <div class="empty-card"><h3 id={`result-${result.region}`}>{translate("home.failed")}</h3><p>{translate("home.failedDescription")}</p></div>
        {/if}
        </article>
        {/if}
      {/each}
      {/if}
    </div>
  </section>
</div>
