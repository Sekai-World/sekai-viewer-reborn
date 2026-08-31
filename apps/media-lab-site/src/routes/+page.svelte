<script lang="ts">
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import {
    useRegionSelection,
    supportedRegions,
    type SupportedRegion
  } from "$lib/region-selection.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const regionSelection = useRegionSelection();
  const regionLabels: Record<SupportedRegion, string> = {
    jp: "JP",
    en: "EN",
    tw: "TW",
    kr: "KR",
    cn: "CN"
  };

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));
</script>

<svelte:head>
  <title>{translate("home.title")}</title>
</svelte:head>

<section class="flex flex-col gap-4 md:flex-row md:flex-wrap md:justify-center">
  {#each supportedRegions as region (region)}
    <article
      id={`region-${region}`}
      class="card w-full bg-base-100 shadow-sm md:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]"
    >
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h2 class="card-title">{regionLabels[region]}</h2>
          <div class="flex gap-1">
            <span
              class={`badge ${regionSelection.primary === region ? "badge-primary" : "badge-ghost"}`}
            >
              {translate("home.primary")}
            </span>
            <span
              class={`badge ${regionSelection.secondary === region ? "badge-secondary" : "badge-ghost"}`}
            >
              {translate("home.secondary")}
            </span>
          </div>
        </div>
        <p class="text-sm opacity-70">{translate("home.placeholder")}</p>
      </div>
    </article>
  {/each}
</section>
