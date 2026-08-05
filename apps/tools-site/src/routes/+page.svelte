<script lang="ts">
  import type { PageData } from "./$types";
  import type { RegionCurrentEvent } from "./+page.server";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import { supportedRegions, type SupportedRegion } from "$lib/regions";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "comparison"]);
  let messages = $state(fallbackMessages);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));

  const regionName = (region: SupportedRegion): string => translate(`region.${region}`);
  const statusKey = (result: RegionCurrentEvent): string =>
    result.status === "available"
      ? "comparison.available"
      : result.status === "unavailable"
        ? "comparison.unavailable"
        : "comparison.requestFailed";

  $effect(() => {
    void Promise.resolve(data.i18nMessages).then((next) => {
      messages = { ...fallbackMessages, ...next };
    });
  });
</script>

<svelte:head><title>{translate("comparison.title")}</title></svelte:head>

<main class="archive-canvas">
  <section class="archive-panel" aria-labelledby="archive-title">
    <h1 id="archive-title">{translate("comparison.title")}</h1>
    <form class="archive-control" method="get" action="/">
      <label>
        {translate("comparison.primary")}
        <select name="primary" value={data.primaryRegion}>
          {#each supportedRegions as region (region)}
            <option value={region}>{regionName(region)}</option>
          {/each}
        </select>
      </label>
      <label>
        {translate("comparison.secondary")}
        <select name="secondary" value={data.secondaryRegion}>
          {#each supportedRegions as region (region)}
            <option value={region}>{regionName(region)}</option>
          {/each}
        </select>
      </label>
      <button type="submit">{translate("comparison.title")}</button>
    </form>
  </section>

  <section class="archive-results" aria-label={translate("comparison.title")}>
    {#each [data.comparison.primary, data.comparison.secondary] as result (result.region)}
      <article class="archive-result" aria-labelledby={`result-${result.region}`}>
        <h2 id={`result-${result.region}`}>{regionName(result.region)}</h2>
        {#if result.status === "available"}
          <p class="archive-status">{translate(statusKey(result))}</p>
          <div class="archive-event">
            <h3>{result.event.name}</h3>
            <data value={result.event.id}>{result.event.id}</data>
          </div>
        {:else if result.status === "unavailable"}
          <p class="archive-status">{translate("comparison.unavailable")}</p>
          <p>{translate("comparison.unavailableDescription")}</p>
        {:else}
          <p class="archive-status">{translate("comparison.requestFailed")}</p>
        {/if}
      </article>
    {:else}
      <p>{translate("comparison.empty")}</p>
    {/each}
  </section>
</main>
