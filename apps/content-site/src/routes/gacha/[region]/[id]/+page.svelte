<script lang="ts">
  import { resolve } from "$app/paths";
  import { getCardThumbnailAssetURL } from "$lib/assets/index";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, { type RegionBadgeOption } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import { formatDisplayDateTime } from "$lib/time/date-time";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const translate = (key: string): string => createI18nTranslator(data.uiLocale, data.i18nMessages)(key);
  const labels = $derived.by(() => ({
    home: translate("home"),
    gachaListTitle: translate("gachaListTitle"),
    pageTitlePrefix: translate("pageTitle.gachaPrefix"),
    idLabel: translate("idLabel"),
    nameLabel: translate("nameLabel"),
    startAtLabel: translate("startAt"),
    endAtLabel: translate("endAt"),
    gachaTypeLabel: translate("gachaTypeLabel"),
    gachaPickupCardsLabel: translate("gachaPickupCards"),
    gachaSummaryLabel: translate("gachaSummary"),
    costLabel: translate("costLabel"),
    imageUnavailableLabel: translate("imageUnavailable"),
    noGachaDataLabel: translate("noGachaData")
  }));
  const resolvePath = resolve as unknown as (
    route: string,
    params?: Record<string, string>
  ) => string;
  const getGachaListHref = (): string => resolvePath("/gachas/[region]", { region: data.region });
  const getCardDetailHref = (cardId: string): string =>
    resolvePath("/cards/[region]/[id]", { region: data.region, id: cardId });
  const getBreadcrumbItems = (currentLabel: string) => [
    { label: labels.home, href: resolvePath("/") },
    { label: labels.gachaListTitle, href: getGachaListHref() },
    { label: currentLabel }
  ];
  const getRegionBadgeOptions = (regionOptions: string[]): RegionBadgeOption[] =>
    regionOptions.map((regionOption) =>
      regionOption === data.region
        ? { key: regionOption, label: regionOption.toUpperCase(), active: true }
        : {
            key: regionOption,
            label: regionOption.toUpperCase(),
            href: resolvePath("/gacha/[region]/[id]", { region: regionOption, id: data.gachaId }),
            active: false
          }
    );
</script>

<svelte:head>
  {#await data.gachaPayload}
    <title>{labels.pageTitlePrefix} {data.gachaId} - Sekai Viewer</title>
  {:then payload}
    <title>
      {payload.gacha
        ? `${payload.gacha.name ?? `${labels.pageTitlePrefix} ${data.gachaId}`} - Sekai Viewer`
        : `${labels.pageTitlePrefix} ${data.gachaId} - Sekai Viewer`}
    </title>
  {/await}
</svelte:head>

<section class="mx-auto flex w-full max-w-400 flex-col gap-4 px-4">
  {#await data.gachaPayload}
    <PageHeader breadcrumbs={getBreadcrumbItems(`${labels.pageTitlePrefix} ${data.gachaId}`)} breadcrumbClass="md:max-w-[68%]">
      {#snippet actions()}
        <RegionBadgeSwitch options={[{ key: data.region, label: data.region.toUpperCase(), active: true }]} />
      {/snippet}
    </PageHeader>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <article class="card content-card-shell overflow-hidden shadow-sm">
        <div class="card-body gap-4 p-5">
          <div class="h-8 w-5/6 animate-pulse rounded-xl bg-base-300"></div>
          <div class="content-card-inset h-48 animate-pulse rounded-2xl bg-base-300"></div>
          <div class="space-y-2">
            <div class="h-4 w-full animate-pulse rounded bg-base-300"></div>
            <div class="h-4 w-2/3 animate-pulse rounded bg-base-300"></div>
          </div>
        </div>
      </article>
      <article class="card content-card-shell overflow-hidden shadow-sm">
        <div class="card-body gap-3 p-5">
          <div class="h-5 w-1/3 animate-pulse rounded bg-base-300"></div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="h-20 animate-pulse rounded-2xl bg-base-300"></div>
            <div class="h-20 animate-pulse rounded-2xl bg-base-300"></div>
            <div class="h-20 animate-pulse rounded-2xl bg-base-300"></div>
            <div class="h-20 animate-pulse rounded-2xl bg-base-300"></div>
          </div>
        </div>
      </article>
    </div>
  {:then payload}
    <PageHeader breadcrumbs={getBreadcrumbItems(payload.gacha?.name ?? `${labels.pageTitlePrefix} ${data.gachaId}`)} breadcrumbClass="md:max-w-[68%]">
      {#snippet actions()}
        {#await data.availableRegions then availableRegions}
          <RegionBadgeSwitch options={getRegionBadgeOptions(availableRegions)} />
        {/await}
      {/snippet}
    </PageHeader>

    {#if payload.error}
      <div class="alert alert-error">{payload.error}</div>
    {/if}

    {#if payload.gacha}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <article class="card content-card-shell overflow-hidden shadow-sm">
          <div class="card-body gap-3 p-5">
            <p class="text-sm font-semibold uppercase tracking-[0.16em] opacity-60">{labels.gachaTypeLabel}</p>
            <h1 class="text-2xl/tight font-bold">{payload.gacha.name ?? labels.noGachaDataLabel}</h1>
            <div class="content-card-inset space-y-3 rounded-xl p-4">
              <div class="flex items-center justify-between gap-4"><span class="text-sm font-medium opacity-70">{labels.nameLabel}</span><span class="text-right font-semibold">{payload.gacha.name ?? labels.noGachaDataLabel}</span></div>
              <div class="flex items-center justify-between gap-4"><span class="text-sm font-medium opacity-70">{labels.idLabel}</span><span class="font-semibold">{payload.gacha.id}</span></div>
              <div class="flex items-center justify-between gap-4"><span class="text-sm font-medium opacity-70">{labels.gachaTypeLabel}</span><span class="font-semibold">{payload.gacha.gachaType ?? labels.noGachaDataLabel}</span></div>
              <div class="flex items-center justify-between gap-4"><span class="text-sm font-medium opacity-70">{labels.startAtLabel}</span><span class="font-semibold">{payload.gacha.startAt ? formatDisplayDateTime(payload.gacha.startAt, data.uiLocale) : labels.noGachaDataLabel}</span></div>
              <div class="flex items-center justify-between gap-4"><span class="text-sm font-medium opacity-70">{labels.endAtLabel}</span><span class="font-semibold">{payload.gacha.endAt ? formatDisplayDateTime(payload.gacha.endAt, data.uiLocale) : labels.noGachaDataLabel}</span></div>
              <div class="flex items-center justify-between gap-4"><span class="text-sm font-medium opacity-70">{labels.costLabel}</span><span class="text-right font-semibold">{payload.gacha.costCount !== null ? `${payload.gacha.costCount}${payload.gacha.costResourceType || payload.gacha.costResourceId ? ` ${payload.gacha.costResourceType ?? ""}${payload.gacha.costResourceId ? `:${payload.gacha.costResourceId}` : ""}` : ""}` : labels.noGachaDataLabel}</span></div>
            </div>
            <div class="content-card-inset rounded-xl p-4"><p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{labels.gachaSummaryLabel}</p><p class="mt-2 text-sm/7 opacity-90">{payload.gacha.summary ?? labels.noGachaDataLabel}</p></div>
          </div>
        </article>

        <article class="card content-card-shell overflow-hidden shadow-sm">
          <div class="card-body gap-4 p-5">
            <div class="flex items-center justify-between gap-3"><h2 class="text-lg font-bold">{labels.gachaPickupCardsLabel}</h2></div>
            {#if payload.pickupCards.length > 0}
              <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {#each payload.pickupCards as pickup (pickup.cardId ?? `pickup-${pickup.weight ?? 0}`)}
                  <a class="content-card-inset group flex flex-col gap-3 rounded-xl p-3 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm" href={pickup.cardId ? getCardDetailHref(pickup.cardId) : resolvePath("/cards/[region]", { region: data.region })}>
                    <div class="aspect-3/4 overflow-hidden rounded-lg bg-base-300">
                      {#if pickup.assetBundleName}
                        <img src={getCardThumbnailAssetURL(pickup.assetBundleName, false, data.region)} alt={pickup.title ?? pickup.cardId ?? labels.imageUnavailableLabel} class="size-full object-cover" loading="lazy" decoding="async" />
                      {:else}
                        <div class="flex size-full items-center justify-center text-sm opacity-60">{labels.imageUnavailableLabel}</div>
                      {/if}
                    </div>
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold">{pickup.title ?? pickup.cardId ?? labels.noGachaDataLabel}</p>
                      <p class="mt-1 text-xs opacity-70">{pickup.cardId ?? labels.noGachaDataLabel}</p>
                    </div>
                  </a>
                {/each}
              </div>
            {:else}
              <div class="alert"><span>{labels.noGachaDataLabel}</span></div>
            {/if}
          </div>
        </article>
      </div>
    {:else if !payload.error}
      {#await data.availableRegions}
        <div class="alert"><span class="loading loading-spinner loading-sm"></span>{labels.noGachaDataLabel}</div>
      {:then availableRegions}
        {#if availableRegions.some((region) => region !== data.region)}
          <div class="alert alert-warning"><span>{data.gachaUnavailableInCurrentRegionMessage}</span></div>
        {:else}
          <div class="alert alert-warning"><span>{data.failedToLoadGachaDataMessage}</span></div>
        {/if}
      {/await}
    {/if}
  {/await}
</section>
