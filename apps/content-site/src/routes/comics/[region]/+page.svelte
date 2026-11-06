<script lang="ts">
  import { goto, refreshAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { getComicImageURL } from "#lib/assets/index.js";
  import ComicPreviewDialog from "#lib/components/comic/ComicPreviewDialog.svelte";
  import ComicTile from "#lib/components/comic/ComicTile.svelte";
  import CatalogueFrame from "#lib/components/mission/CatalogueFrame.svelte";
  import { filterComicsByTitle, type ComicItem } from "#lib/domain/comic.js";
  import { regionLabels, supportedRegions } from "#lib/domain/regions.js";
  import { createStreamedTranslator } from "#lib/i18n/streamed-translator.svelte.js";
  import { createPageTitle } from "#lib/page-title.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "comic"]);
  const t = $derived(i18n.t);

  let comics = $state<ComicItem[]>([]);
  let status = $state<"loading" | "error" | "ready">("loading");
  $effect(() => {
    let active = true;
    status = "loading";
    void data.comics.then((value) => {
      if (!active) return;
      comics = value ?? [];
      status = value ? "ready" : "error";
    });
    return () => {
      active = false;
    };
  });

  const name = $derived(page.url.searchParams.get("name")?.trim() ?? "");
  const visibleComics = $derived(filterComicsByTitle(comics, name));

  const listHref = (region: string, query: string): string =>
    `${resolve("/comics/[region]", { region })}${
      query ? `?name=${encodeURIComponent(query)}` : ""
    }`;
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listHref(region, name)
    }))
  );

  const title = $derived(t("navigation.comics"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("comic.search"),
    searchAction: t("comic.searchAction"),
    loading: t("comic.loading"),
    empty: t("comic.empty"),
    error: t("comic.error"),
    retry: t("comic.retry"),
    previous: "",
    next: ""
  });

  let preview: ComicPreviewDialog | undefined = $state();
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{title}</h1>
{/snippet}

<CatalogueFrame
  {labels}
  homeHref={resolve("/")}
  {regions}
  {status}
  empty={status === "ready" && visibleComics.length === 0}
  query={name}
  resetKey={data.region}
  {pageIdentity}
  resultsLabel={t("comic.results")}
  onSearch={(query) => void goto(listHref(data.region, query), { reset: false })}
  onRetry={() => void refreshAll()}
>
  {#snippet loadingPlaceholder()}
    <div class="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="content-card-shell rounded-2xl p-2 sm:p-3">
          <div class="aspect-644/478 w-full rounded-xl bg-(--archive-surface-sunken)"></div>
          <div class="mt-2 h-4 w-3/4 rounded bg-(--archive-surface-sunken)"></div>
        </div>
      {/each}
    </div>
  {/snippet}
  <ul class="grid grid-cols-2 items-stretch gap-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
    {#each visibleComics as comic (comic.id)}
      <li class="min-w-0">
        <ComicTile
          {comic}
          imageSrc={getComicImageURL(comic.assetbundleName, data.region)}
          imageUnavailableLabel={t("imageUnavailable")}
          onOpen={(trigger) => void preview?.show(comic, trigger)}
        />
      </li>
    {/each}
  </ul>
</CatalogueFrame>

<ComicPreviewDialog
  bind:this={preview}
  catalogueKey={`${data.region}:${name}`}
  region={data.region}
  comics={visibleComics}
  {t}
/>
