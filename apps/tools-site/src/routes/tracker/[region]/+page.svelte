<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "comparison", "tracker"]);
  let messages = $state(fallbackMessages);
  let eventId = $state("");
  let isRefreshing = $state(false);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const trackerPath = $derived(resolve("/tracker/[region]", { region: data.region }));
  const isInvalidSelection = $derived(data.selectionStatus === "invalid-event-id");

  const formatNumber = (value: number | null): string =>
    value === null ? translate("tracker.unavailable") : new Intl.NumberFormat(data.uiLocale).format(value);
  const formatTimestamp = (value: string | null | undefined): string => {
    if (!value) return translate("tracker.unavailable");
    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime())
      ? translate("tracker.unavailable")
      : new Intl.DateTimeFormat(data.uiLocale, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
  };
  const interpolate = (key: string, values: Record<string, string | number>): string =>
    Object.entries(values).reduce(
      (message, [name, value]) => message.replace(`{${name}}`, String(value)),
      translate(key)
    );
  const refresh = async (): Promise<void> => {
    isRefreshing = true;
    try {
      await invalidateAll();
    } finally {
      isRefreshing = false;
    }
  };

  $effect(() => {
    void Promise.resolve(data.i18nMessages).then((next) => {
      messages = { ...fallbackMessages, ...next };
    });
  });
</script>

<svelte:head>
  <title>{translate("tracker.title")}</title>
</svelte:head>

<div class="archive-canvas tracker-canvas">
  <section class="archive-panel tracker-hero" aria-labelledby="tracker-title">
    <div class="tracker-heading">
      <p class="tracker-kicker">{interpolate("tracker.currentRegion", { region: translate(`region.${data.region}`) })}</p>
      <h1 id="tracker-title">{translate("tracker.title")}</h1>
      {#if !isInvalidSelection}
        <p class="tracker-lede">
          {data.selection.mode === "live"
            ? translate("tracker.status.live")
            : interpolate("tracker.status.history", { eventId: data.selection.eventId ?? translate("tracker.unavailable") })}
        </p>
      {/if}
    </div>

    <div class="tracker-status-row" aria-live="polite">
      {#if isRefreshing}
        <span class="badge badge-primary gap-2"><span class="loading loading-spinner loading-xs"></span>{translate("tracker.loading")}</span>
      {:else if isInvalidSelection}
        <span class="badge badge-warning">{translate("tracker.historical")}</span>
      {:else if data.status === "available"}
        <span class="badge badge-success">{translate("tracker.status.available")}</span>
      {:else}
        <span class="badge badge-error">{translate("tracker.title")}</span>
      {/if}
      {#if !isInvalidSelection}
        <span class="tracker-loaded">{interpolate("tracker.loadedAt", { time: formatTimestamp(data.loadedAt) })}</span>
      {/if}
      <button
        class="btn btn-square btn-sm tracker-refresh"
        type="button"
        onclick={refresh}
        disabled={isRefreshing}
        aria-label={isRefreshing ? translate("tracker.refreshing") : translate("tracker.refresh")}
        title={isRefreshing ? translate("tracker.refreshing") : translate("tracker.refresh")}
      >
        {#if isRefreshing}<span class="loading loading-spinner loading-sm"></span>{:else}<span aria-hidden="true">↻</span>{/if}
      </button>
    </div>
  </section>

  <section class="archive-panel tracker-selection" aria-labelledby="tracker-selection-title">
    <div>
      <h2 id="tracker-selection-title">{translate("tracker.selectEvent")}</h2>
      <p>{translate("tracker.eventIdHint")}</p>
    </div>
    <div class="tracker-actions">
      <a class="btn btn-primary" href={trackerPath}>{translate("tracker.useLive")}</a>
      <form class="tracker-id-form" method="get" action={trackerPath}>
        <label for="tracker-event-id">{translate("tracker.eventId")}</label>
        <div>
          <input id="tracker-event-id" class="input input-bordered" name="eventId" type="number" min="1" step="1" bind:value={eventId} required />
          <button class="btn btn-outline" type="submit">{translate("tracker.showEvent")}</button>
        </div>
      </form>
    </div>
    {#if isInvalidSelection}
      <p class="tracker-inline-error" role="alert">{translate("tracker.eventIdInvalid")}</p>
    {/if}
  </section>

  <section class="archive-result tracker-results" aria-labelledby="tracker-results-title">
    <div class="tracker-results-heading">
      <div>
        <p class="tracker-kicker">{data.selection.mode === "live" ? translate("tracker.live") : translate("tracker.historical")}</p>
        <h2 id="tracker-results-title">{translate("tracker.title")}</h2>
      </div>
    </div>

    {#if !isInvalidSelection && data.status === "available" && data.rankings.length > 0}
      <div class="tracker-table-wrap">
        <table class="table tracker-table">
          <thead><tr><th scope="col">{translate("tracker.rank")}</th><th scope="col">{translate("tracker.player")}</th><th scope="col">{translate("tracker.score")}</th><th scope="col">{translate("tracker.capturedAt")}</th></tr></thead>
          <tbody>
            {#each data.rankings as ranking (`${ranking.rank ?? ""}-${ranking.userId ?? ranking.score ?? ""}`)}
              <tr><td>{formatNumber(ranking.rank)}</td><td>{ranking.userName ?? ranking.userId ?? translate("tracker.unavailable")}</td><td>{formatNumber(ranking.score)}</td><td>{formatTimestamp(ranking.timestamp)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if isInvalidSelection}
      <p class="tracker-empty" role="status">{translate("tracker.eventIdInvalid")}</p>
    {:else if data.status === "sdk-error"}
      <p class="tracker-empty" role="alert">{translate("tracker.error.sdk")}</p>
    {:else if data.status === "network-error"}
      <p class="tracker-empty" role="alert">{translate("tracker.error.network")}</p>
    {:else if data.status === "invalid-data"}
      <p class="tracker-empty" role="alert">{translate("tracker.error.invalidData")}</p>
    {:else}
      <p class="tracker-empty" role="status">{translate("tracker.empty")}</p>
    {/if}
  </section>
</div>

<style>
  .tracker-canvas { max-width: 76rem; margin: 0 auto; padding: clamp(1rem, 3vw, 2rem); gap: 1rem; }
  .tracker-hero { display: grid; gap: 1.25rem; border-top: 3px solid var(--color-primary); }
  .tracker-heading h1, .tracker-selection h2, .tracker-results h2 { font-weight: 800; letter-spacing: -0.03em; }
  .tracker-kicker { color: var(--color-primary); font-size: .75rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .tracker-lede, .tracker-selection p, .tracker-loaded { color: color-mix(in srgb, var(--color-base-content) 68%, transparent); }
  .tracker-status-row { display: flex; flex-wrap: wrap; align-items: center; gap: .65rem; }
  .tracker-refresh { margin-left: auto; min-width: 2.75rem; min-height: 2.75rem; font-size: 1.5rem; line-height: 1; }
  .tracker-selection { display: grid; gap: 1rem; }
  .tracker-actions { display: grid; gap: .75rem; }
  .tracker-id-form { display: grid; gap: .35rem; }
  .tracker-id-form > div { display: flex; gap: .5rem; }
  .tracker-id-form input { min-width: 0; width: 100%; }
  .tracker-inline-error { color: var(--color-error); font-weight: 600; }
  .tracker-results { display: grid; gap: 1rem; }
  .tracker-table-wrap { overflow-x: auto; border: 1px solid color-mix(in srgb, var(--color-base-content) 12%, transparent); border-radius: var(--radius-box); }
  .tracker-table { min-width: 38rem; }
  .tracker-table tbody tr { transition: background-color 180ms ease; }
  .tracker-table tbody tr:hover { background: color-mix(in srgb, var(--color-primary) 7%, transparent); }
  .tracker-empty { padding: 2rem 1rem; border: 1px dashed color-mix(in srgb, var(--color-base-content) 22%, transparent); color: color-mix(in srgb, var(--color-base-content) 72%, transparent); text-align: center; }
  @media (min-width: 48rem) { .tracker-hero { grid-template-columns: minmax(0, 1fr) auto; align-items: end; } .tracker-selection { grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr); align-items: end; } .tracker-actions { grid-template-columns: auto minmax(18rem, 1fr); align-items: end; } }
  @media (prefers-reduced-motion: reduce) { .tracker-table tbody tr { transition: none; } }
</style>
