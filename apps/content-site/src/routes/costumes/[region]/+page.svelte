<script lang="ts">
  import { goto, refreshAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { getCostumeThumbnailURL } from "#lib/assets/index.js";
  import { getLocalCharacterThumbnailAssetURL } from "#lib/assets/characters.js";
  import CostumeTile from "#lib/components/costume/CostumeTile.svelte";
  import CatalogueFrame from "#lib/components/mission/CatalogueFrame.svelte";
  import MissionCharacterPicker from "#lib/components/mission/MissionCharacterPicker.svelte";
  import MysekaiLoadMore from "#lib/components/mysekai/MysekaiLoadMore.svelte";
  import ListToolbarButton from "#lib/components/shared/ListToolbarButton.svelte";
  import {
    costumeRarities,
    toCostumeSearchParams,
    type CostumeListQuery,
    type CostumeOutfit
  } from "#lib/domain/costume.js";
  import type { MissionCharacterOption } from "#lib/domain/mission.js";
  import { regionLabels, supportedRegions } from "#lib/domain/regions.js";
  import { createStreamedTranslator } from "#lib/i18n/streamed-translator.svelte.js";
  import { fetchPagedResult, PagedList } from "#lib/paged-list.svelte.js";
  import { createPageTitle } from "#lib/page-title.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "costume"]);
  const t = $derived(i18n.t);

  const list = new PagedList<CostumeOutfit>((outfit) => outfit.id ?? 0);
  $effect(() => {
    list.reset(Promise.resolve(data.catalogue));
  });

  type CharacterOptionsState = {
    status: "loading" | "ready" | "error";
    items: MissionCharacterOption[];
  };
  let characterOptions = $state<CharacterOptionsState>({ status: "loading", items: [] });
  $effect(() => {
    let active = true;
    characterOptions = { status: "loading", items: [] };
    void Promise.resolve(data.characters).then((items) => {
      if (!active) return;
      characterOptions = items ? { status: "ready", items } : { status: "error", items: [] };
    });
    return () => {
      active = false;
    };
  });

  const title = $derived(t("navigation.costumes"));
  const labels = $derived({
    title,
    home: t("home"),
    search: t("costume.search"),
    searchAction: t("costume.searchAction"),
    loading: t("costume.loading"),
    empty: t("costume.empty"),
    error: t("costume.error"),
    retry: t("costume.retry"),
    previous: "",
    next: ""
  });

  const listPath = (region: string, query: CostumeListQuery): string => {
    const search = toCostumeSearchParams(query).toString();
    return `${resolve("/costumes/[region]", { region })}${search ? `?${search}` : ""}`;
  };
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: listPath(region, data.query)
    }))
  );
  const navigateQuery = (overrides: Partial<CostumeListQuery>): void => {
    void goto(listPath(data.region, { ...data.query, ...overrides }), { reset: false });
  };
  const loadMore = (): void => {
    void list.loadMore((page) =>
      fetchPagedResult<CostumeOutfit>(
        `${resolve("/costumes/[region]/data", { region: data.region })}?${toCostumeSearchParams(data.query, page).toString()}`
      )
    );
  };

  const rarityTabs = $derived([
    { key: null, label: t("costume.all") },
    ...costumeRarities.map((rarity) => ({ key: rarity, label: t(`costume.rarity.${rarity}`) }))
  ]);
  const sortLabel = $derived(
    `${t("costume.sortOrder")}: ${data.query.sortOrder === "asc" ? t("costume.sortDescending") : t("costume.sortAscending")}`
  );
  const catalogueKey = $derived(`${data.region}:${toCostumeSearchParams(data.query)}`);
</script>

<svelte:head><title>{createPageTitle(`${title} ${regionLabels[data.region]}`)}</title></svelte:head>

{#snippet pageIdentity()}
  <h1 class="text-2xl font-bold text-(--archive-text-strong)">{title}</h1>
{/snippet}

{#snippet controls()}
  <div class="flex min-w-0 flex-1 flex-col gap-4" data-swipe-region-skip>
    <div class="grid min-w-0 gap-2">
      <h2 class="text-sm font-semibold text-(--archive-text-strong)">
        {t("costume.rarityTitle")}
      </h2>
      <div class="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t("costume.rarityTitle")}>
        {#each rarityTabs as tab (tab.key ?? "all")}
          {@const active = data.query.rarity === tab.key}
          <button
            type="button"
            class="btn touch-target max-w-full rounded-xl whitespace-normal wrap-break-word {active
              ? 'btn-primary'
              : 'btn-ghost'}"
            aria-pressed={active}
            onclick={() => navigateQuery({ rarity: tab.key })}
          >
            {tab.label}
          </button>
        {/each}
      </div>
    </div>
    <div class="grid min-w-0 gap-3">
      <MissionCharacterPicker
        characters={characterOptions.items}
        status={characterOptions.status}
        selectedId={data.query.characterId}
        getImageSrc={getLocalCharacterThumbnailAssetURL}
        labels={{
          loading: t("costume.loading"),
          error: t("costume.error"),
          retry: t("costume.retry"),
          otherGroup: t("costume.otherUnit"),
          change: t("costume.characterChange"),
          title: t("costume.characterTitle")
        }}
        onSelect={(characterId) => navigateQuery({ characterId })}
        onRetry={() => void refreshAll()}
      />
      {#if data.query.characterId !== null}
        <div>
          <button
            type="button"
            class="btn btn-ghost btn-sm touch-target"
            onclick={() => navigateQuery({ characterId: null })}
          >
            {t("costume.characterAll")}
          </button>
        </div>
      {/if}
    </div>
  </div>
  <div
    class="border-t border-(--archive-border-subtle) pt-4 lg:shrink-0 lg:border-t-0 lg:pt-0"
    data-swipe-region-skip
  >
    <div class="join shrink-0" role="group" aria-label={t("costume.sortOrder")}>
      <ListToolbarButton
        icon="mdi:numeric"
        label={t("costume.sortOrder")}
        ariaLabel={sortLabel}
        title={sortLabel}
        sortIndicatorIcon={data.query.sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down"}
        class="join-item btn-primary"
        onclick={() =>
          navigateQuery({ sortOrder: data.query.sortOrder === "asc" ? "desc" : "asc" })}
      />
    </div>
  </div>
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
  resultsLabel={t("costume.results")}
  onSearch={(name) => navigateQuery({ name })}
  onRetry={() => void refreshAll()}
>
  {#snippet loadingPlaceholder()}
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="content-card-shell rounded-2xl p-2 sm:p-3">
          <div class="aspect-square w-full rounded-xl bg-(--archive-surface-sunken)"></div>
          <div class="mt-2 h-4 w-3/4 rounded bg-(--archive-surface-sunken)"></div>
        </div>
      {/each}
    </div>
  {/snippet}
  <ul
    class="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6"
  >
    {#each list.items as outfit (outfit.id)}
      <li class="min-w-0">
        <CostumeTile
          href={resolve("/costume/[region]/[id]", {
            region: data.region,
            id: String(outfit.id)
          })}
          name={outfit.name ?? String(outfit.id)}
          imageSrc={getCostumeThumbnailURL(outfit.thumbnailAssetbundleName, data.region)}
          imageUnavailableLabel={t("imageUnavailable")}
        />
      </li>
    {/each}
  </ul>
  <MysekaiLoadMore
    hasNext={list.hasNext}
    isLoading={list.isLoadingMore}
    error={list.loadMoreError}
    loadingLabel={t("costume.loadingMore")}
    idleLabel={t("costume.loadMore")}
    errorLabel={t("costume.loadMoreError")}
    retryLabel={t("costume.retry")}
    onLoadMore={loadMore}
  />
</CatalogueFrame>
