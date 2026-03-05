<script lang="ts">
  import { noEventTextByLocale } from "@platform/i18n-dicts";
  import { getEventBannerAssetURL } from "$lib/assets";
  import { setI18nLocale, tCommon } from "$lib/i18n";
  import { normalizeUiLocale } from "$lib/region";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let displayLocale = $state<string>("en-US");
  let homeLabel = $state("Home");
  let startAtLabel = $state("Start");
  let endAtLabel = $state("End");
  let noEventLabel = $state("No current event data.");

  $effect(() => {
    displayLocale = data.uiLocale;
    void refreshTranslations(data.uiLocale);
  });

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const locale = await setI18nLocale(localeValue);
    homeLabel = tCommon("home", "Home");
    startAtLabel = tCommon("startAt", "Start");
    endAtLabel = tCommon("endAt", "End");
    noEventLabel = noEventTextByLocale[normalizeUiLocale(locale)];
  };

  const formatTime = (value: string | number | null): string => {
    if (!value) {
      return "--";
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat(displayLocale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(parsedDate);
  };
</script>

<svelte:head>
  <title>{data.event ? `${data.event.title} - Sekai Viewer` : `Event ${data.eventId} - Sekai Viewer`}</title>
</svelte:head>

<section class="mb-4 flex items-center justify-between gap-3">
  <a class="btn btn-ghost btn-sm" href="/">← {homeLabel}</a>
  <span class="badge badge-primary badge-outline font-semibold">{data.region.toUpperCase()}</span>
</section>

{#if data.error}
  <div class="alert alert-error mb-4">{data.error}</div>
{/if}

{#if data.event}
  <article class="card overflow-hidden bg-base-100 shadow-sm">
    {#if data.event.assetBundleName}
      <img
        src={getEventBannerAssetURL(data.event.assetBundleName, data.region)}
        alt={`${data.event.title} banner`}
        class="aspect-[61/26] w-full object-cover"
      />
    {/if}

    <div class="card-body gap-2">
      <h1 class="text-xl font-semibold leading-tight">{data.event.title}</h1>
      <p class="text-sm opacity-80">ID: {data.event.id}</p>
      <p class="text-sm">{startAtLabel}: {formatTime(data.event.startAt)}</p>
      <p class="text-sm">{endAtLabel}: {formatTime(data.event.endAt)}</p>
    </div>
  </article>
{:else if !data.error}
  <div class="alert">{noEventLabel}</div>
{/if}
