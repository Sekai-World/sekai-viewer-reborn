<script lang="ts">
  import { goto, refreshAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import CatalogueFrame from "#lib/components/mission/CatalogueFrame.svelte";
  import { getMysekaiPhotoFrameURL } from "#lib/assets/index.js";
  import type { MysekaiPhotoFrame } from "#lib/domain/mysekai.js";
  import { regionLabels, supportedRegions } from "#lib/domain/regions.js";
  import { createStreamedTranslator } from "#lib/i18n/streamed-translator.svelte.js";
  import { createPageTitle } from "#lib/page-title.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "mysekai"]);
  const t = $derived(i18n.t);

  let frames = $state<MysekaiPhotoFrame[] | null>(null);
  let status = $state<"loading" | "error" | "ready">("loading");
  $effect(() => {
    let active = true;
    frames = null;
    status = "loading";
    void data.frames.then((value) => {
      if (!active) return;
      frames = value;
      status = value ? "ready" : "error";
    });
    return () => {
      active = false;
    };
  });

  const name = $derived(page.url.searchParams.get("name")?.trim() ?? "");
  const visibleFrames = $derived(
    (frames ?? []).filter(
      (frame) =>
        name === "" ||
        `${frame.name ?? ""} ${frame.description ?? ""}`.toLowerCase().includes(name.toLowerCase())
    )
  );

  const listHref = (region: string, query: string): string =>
    `${resolve("/mysekai/photo-frames/[region]", { region })}${
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

  const title = $derived(t("navigation.mysekaiPhotoFrames"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("mysekai.photoFrame.search"),
    searchAction: t("mysekai.searchAction"),
    loading: t("mysekai.loading"),
    empty: t("mysekai.empty"),
    error: t("mysekai.error"),
    retry: t("mysekai.retry"),
    previous: "",
    next: ""
  });
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
  empty={status === "ready" && visibleFrames.length === 0}
  query={name}
  resetKey={data.region}
  {pageIdentity}
  resultsLabel={t("mysekai.results")}
  onSearch={(query) => void goto(listHref(data.region, query), { reset: false })}
  onRetry={() => void refreshAll()}
>
  <ul class="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    {#each visibleFrames as frame (frame.id)}
      {@const previewSrc = getMysekaiPhotoFrameURL(frame.assetbundleName)}
      <li class="min-w-0">
        <figure class="content-card-shell flex h-full min-w-0 flex-col gap-3 rounded-2xl p-3">
          <span
            class="flex aspect-988/950 w-full items-center justify-center overflow-hidden rounded-xl bg-(--archive-surface-raised)"
          >
            {#if previewSrc}
              <img
                src={previewSrc}
                alt=""
                class="size-full object-contain"
                loading="lazy"
                decoding="async"
                onerror={(event) => ((event.currentTarget as HTMLImageElement).hidden = true)}
              />
            {/if}
          </span>
          <figcaption class="min-w-0">
            <span class="block font-semibold wrap-anywhere text-(--archive-text-strong)"
              >{frame.name}</span
            >
            {#if frame.description && frame.description !== frame.name}
              <span class="mt-0.5 block text-xs text-(--archive-text-muted)"
                >{frame.description}</span
              >
            {/if}
          </figcaption>
        </figure>
      </li>
    {/each}
  </ul>
</CatalogueFrame>
