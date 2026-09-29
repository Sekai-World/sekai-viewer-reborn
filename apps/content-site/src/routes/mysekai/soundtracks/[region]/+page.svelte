<script lang="ts">
  import Icon from "@iconify/svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { AudioPlayer } from "@platform/ui-shell";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import MysekaiLoadMore from "$lib/components/mysekai/MysekaiLoadMore.svelte";
  import { getMysekaiSoundTrackAudioURL, getMysekaiSoundTrackJacketURL } from "$lib/assets/index";
  import {
    toMysekaiSoundtrackSearchParams,
    type MusicSoundTrackCategory,
    type MysekaiMusicRecord,
    type MysekaiSoundtrackListQuery
  } from "$lib/domain/mysekai";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createStreamedTranslator } from "$lib/i18n/streamed-translator.svelte";
  import { fetchPagedResult, PagedList } from "$lib/paged-list.svelte";
  import { createPageTitle } from "$lib/page-title";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "mysekai"]);
  const t = $derived(i18n.t);

  const list = new PagedList<MysekaiMusicRecord>((record) => record.id);
  let categories = $state<MusicSoundTrackCategory[]>([]);
  let playingId = $state<number | null>(null);

  $effect(() => {
    list.reset(Promise.resolve(data.catalogue));
    playingId = null;
  });
  $effect(() => {
    let active = true;
    void Promise.resolve(data.filters).then((value) => {
      if (active && value) categories = value.soundTrackCategories;
    });
    return () => {
      active = false;
    };
  });

  const title = $derived(t("navigation.mysekaiSoundtracks"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("mysekai.soundtrack.search"),
    searchAction: t("mysekai.searchAction"),
    loading: t("mysekai.loading"),
    empty: t("mysekai.empty"),
    error: t("mysekai.error"),
    retry: t("mysekai.retry"),
    previous: "",
    next: ""
  });

  const listPath = (region: string, query: MysekaiSoundtrackListQuery): string => {
    const search = toMysekaiSoundtrackSearchParams(query).toString();
    return `${resolve("/mysekai/soundtracks/[region]", { region })}${search ? `?${search}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listPath(region, data.query)
    }))
  );
  const navigateQuery = (overrides: Partial<MysekaiSoundtrackListQuery>): void => {
    void goto(listPath(data.region, { ...data.query, ...overrides }), {
      keepFocus: true,
      noScroll: true
    });
  };
  const loadMore = (): void => {
    void list.loadMore((page) =>
      fetchPagedResult<MysekaiMusicRecord>(
        `${resolve("/mysekai/soundtracks/[region]/data", { region: data.region })}?${toMysekaiSoundtrackSearchParams(data.query, page).toString()}`
      )
    );
  };

  const categoryById = $derived(new Map(categories.map((category) => [category.id, category])));
  const playing = $derived(list.items.find((record) => record.id === playingId) ?? null);
  const playingCategory = $derived(
    playing?.soundTrack?.musicSoundTrackCategoryId === undefined
      ? null
      : (categoryById.get(playing.soundTrack.musicSoundTrackCategoryId) ?? null)
  );
  const audioStages = $derived({
    preparing: t("audioDownloadStages.preparing"),
    fetchingAudio: t("audioDownloadStages.fetchingAudio"),
    fetchingCover: t("audioDownloadStages.fetchingCover"),
    writingMetadata: t("audioDownloadStages.writingMetadata"),
    finalizing: t("audioDownloadStages.finalizing"),
    ready: t("audioDownloadStages.ready"),
    failed: t("audioDownloadStages.failed"),
    cancelled: t("audioDownloadStages.cancelled")
  });
  const catalogueKey = $derived(`${data.region}:${toMysekaiSoundtrackSearchParams(data.query)}`);
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{title}</h1>
{/snippet}

{#snippet controls()}
  <label class="flex min-w-0 flex-col gap-1 text-sm font-semibold sm:w-64" data-swipe-region-skip>
    <span>{t("mysekai.soundtrack.category")}</span>
    <select
      class="select min-h-11 w-full bg-(--archive-surface-default)"
      value={data.query.categoryId === null ? "" : String(data.query.categoryId)}
      onchange={(event) =>
        navigateQuery({
          categoryId: event.currentTarget.value ? Number(event.currentTarget.value) : null
        })}
    >
      <option value="">{t("mysekai.all")}</option>
      {#each categories as category (category.id)}
        <option value={String(category.id)}>{category.name}</option>
      {/each}
    </select>
  </label>
{/snippet}

<CatalogueFrame
  {labels}
  homeHref={resolve("/")}
  {regions}
  status={list.status}
  empty={list.status === "ready" && list.items.length === 0}
  query={data.query.name}
  resetKey={catalogueKey}
  {pageIdentity}
  {controls}
  resultsLabel={t("mysekai.results")}
  onSearch={(name) => navigateQuery({ name })}
  onRetry={() => void invalidateAll()}
>
  {#if playing?.soundTrack}
    <div class="content-card-shell mb-4 rounded-2xl p-3 sm:p-4">
      <AudioPlayer
        src={getMysekaiSoundTrackAudioURL(
          playing.soundTrack.assetbundleName,
          playing.soundTrack.assetbundleFileName
        )}
        title={playing.soundTrack.title}
        subtitle={playingCategory?.name ?? ""}
        artworkUrl={getMysekaiSoundTrackJacketURL(playingCategory?.assetbundleName) ?? ""}
        downloadProgressMessages={audioStages}
        playLabel={t("audioPlayLabel")}
        pauseLabel={t("audioPauseLabel")}
        downloadLabel={t("audioDownloadLabel")}
        downloadCloseLabel={t("audioDownloadCloseLabel")}
        volumeLabel={t("audioVolumeLabel")}
        seekLabel={t("audioSeekLabel")}
        unavailableLabel={t("mysekai.audioUnavailable")}
      />
    </div>
  {/if}
  <ul class="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {#each list.items as record (record.id)}
      {#if record.soundTrack}
        {@const category =
          record.soundTrack.musicSoundTrackCategoryId === undefined
            ? null
            : (categoryById.get(record.soundTrack.musicSoundTrackCategoryId) ?? null)}
        {@const jacket = getMysekaiSoundTrackJacketURL(category?.assetbundleName)}
        {@const selected = playingId === record.id}
        <li class="min-w-0">
          <button
            type="button"
            class="content-card-shell flex size-full min-w-0 items-center gap-3 rounded-2xl p-2 text-left outline-none transition-[transform,border-color,background-color] duration-180 hover-lift hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none {selected
              ? 'border-primary/50'
              : ''}"
            aria-pressed={selected}
            aria-label={t("mysekai.soundtrack.play").replace("{title}", record.soundTrack.title)}
            onclick={() => (playingId = record.id)}
          >
            <span class="relative size-16 shrink-0 overflow-hidden rounded-xl">
              {#if jacket}
                <AssetImage
                  buttonClass="block size-full overflow-hidden"
                  src={jacket}
                  alt=""
                  fallbackLabel=""
                  loadMode="visible"
                  imageClass="size-full object-cover"
                />
              {/if}
            </span>
            <span class="min-w-0 flex-1">
              <span class="line-clamp-2 font-semibold wrap-anywhere text-(--archive-text-strong)"
                >{record.soundTrack.title}</span
              >
              {#if category}
                <span class="mt-0.5 block truncate text-xs text-(--archive-text-muted)"
                  >{category.name}</span
                >
              {/if}
            </span>
            <Icon
              icon={selected ? "mdi:music-note-eighth" : "mdi:play"}
              class="size-6 shrink-0 text-primary"
              aria-hidden="true"
            />
          </button>
        </li>
      {/if}
    {/each}
  </ul>
  <MysekaiLoadMore
    hasNext={list.hasNext}
    isLoading={list.isLoadingMore}
    error={list.loadMoreError}
    loadingLabel={t("mysekai.loadingMore")}
    idleLabel={t("mysekai.loadMore")}
    errorLabel={t("mysekai.loadMoreError")}
    retryLabel={t("mysekai.retry")}
    onLoadMore={loadMore}
  />
</CatalogueFrame>
