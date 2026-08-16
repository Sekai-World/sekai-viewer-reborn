<script lang="ts">
  import { BrandLockup } from "@platform/ui-shell";
  import type { PageData } from "./$types";
  import type { RegionCurrentEvent } from "./+page.server";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import type { TrackerSupportedRegion } from "$lib/regions";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common"]);
  let messages = $state(fallbackMessages);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));

  const regionName = (region: TrackerSupportedRegion): string => translate(`region.${region}`);
  const statusKey = (result: RegionCurrentEvent): string =>
    result.status === "available"
      ? "home.status.available"
      : result.status === "unavailable"
        ? "home.status.empty"
        : "home.status.failed";

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
</script>

<svelte:head><title>Sekai Viewer - Tools</title></svelte:head>

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

  <section class="region-grid" aria-labelledby="regions-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">{translate("home.liveEyebrow")}</p>
        <h2 id="regions-title">{translate("home.regionsTitle")}</h2>
      </div>
      <span class="live-mark"><span></span>{translate("home.live")}</span>
    </div>
    <div class="event-grid">
      {#each data.events as result (result.region)}
        <article class:has-event={result.status === "available"} class="event-card" aria-labelledby={`result-${result.region}`}>
          <div class="card-topline">
            <span class="region-tag">{regionName(result.region)}</span>
            <span class:status-ready={result.status === "available"} class="status-pill"><span aria-hidden="true"></span>{translate(statusKey(result))}</span>
          </div>
        {#if result.status === "available"}
          <div class="event-card-body">
            <h3 id={`result-${result.region}`}>{result.event.name}</h3>
            <p class="event-meta">{result.event.unit ?? translate("home.unitUnknown")} · {translate("home.eventId")} {result.event.id}</p>
            <p class="event-time">{formatDate(result.event.startAt)} — {formatDate(result.event.aggregateAt)}</p>
            <a class="tracker-link" href={`/tracker/${result.region}?eventId=${result.event.id}`}>{translate("home.openRegionalTracker")} <span aria-hidden="true">→</span></a>
          </div>
        {:else if result.status === "unavailable"}
          <div class="empty-card"><h3 id={`result-${result.region}`}>{translate("home.noEvent")}</h3><p>{translate("home.noEventDescription")}</p></div>
        {:else}
          <div class="empty-card"><h3 id={`result-${result.region}`}>{translate("home.failed")}</h3><p>{translate("home.failedDescription")}</p></div>
        {/if}
        </article>
      {/each}
    </div>
  </section>
</div>
