<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import CharacterCatalogueCard from "$lib/components/character/CharacterCatalogueCard.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import type { CharacterCatalogueItem } from "$lib/domain/character";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "character", "card", "error"]);
  let messages = $state<Record<string, string>>(fallbackMessages);
  let query = $state("");
  let selectedUnit = $state("");
  let catalogue = $state<CharacterCatalogueItem[]>([]);
  let loadFailed = $state(false);
  let loading = $state(true);
  let requestId = 0;
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const t = (key: string, fallback: string): string => translate(key, fallback);
  const units = $derived([
    ...new Set(catalogue.map((item) => item.unit).filter((unit): unit is string => Boolean(unit)))
  ]);
  const visibleItems = $derived.by(() => {
    const needle = query.trim().toLocaleLowerCase(data.uiLocale);
    return catalogue.filter(
      (item) =>
        (!needle ||
          item.name.toLocaleLowerCase(data.uiLocale).includes(needle) ||
          item.id.includes(needle)) &&
        (!selectedUnit || item.unit === selectedUnit)
    );
  });
  const regionOptions = (): RegionBadgeOption[] =>
    supportedRegions.map((region) =>
      region === data.region
        ? { key: region, label: regionLabels[region], active: true }
        : {
            key: region,
            label: regionLabels[region],
            href: resolve("/characters/[region]", { region }),
            active: false
          }
    );

  $effect(() => {
    const id = ++requestId;
    messages = fallbackMessages;
    if (browser)
      void Promise.resolve(data.i18nMessages).then((next) => {
        if (id === requestId) messages = next;
      });
  });
  $effect(() => {
    loading = true;
    catalogue = [];
    void Promise.resolve(data.catalogue).then((result) => {
      catalogue = result.items;
      loadFailed = result.loadFailed;
      loading = false;
    });
  });
</script>

<svelte:head
  ><title>{t("characterListTitle", "Characters")} {regionLabels[data.region]} - Sekai Viewer</title
  ></svelte:head
>

<section use:swipeRegion class="mx-auto flex w-full max-w-360 flex-col gap-5 px-2">
  <PageHeader
    breadcrumbs={[
      { label: t("home", "Home"), href: resolve("/") },
      { label: t("characterListTitle", "Characters") }
    ]}
  >
    {#snippet actions()}<RegionBadgeSwitch options={regionOptions()} />{/snippet}
  </PageHeader>

  <div class="content-card-shell rounded-2xl border border-base-content/8 p-3 shadow-sm sm:p-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label class="input input-bordered flex min-h-12 flex-1 items-center gap-2">
        <Icon icon="mdi:magnify" class="size-5 opacity-50" aria-hidden="true" />
        <span class="sr-only">{t("characterSearchLabel", "Search characters")}</span>
        <input
          type="search"
          class="grow"
          bind:value={query}
          placeholder={t("characterSearchPlaceholder", "Search by name or ID")}
        />
      </label>
      <div
        data-swipe-region-skip
        class="flex max-w-full gap-2 overflow-x-auto pb-1"
        aria-label={t("characterUnitFilterLabel", "Filter by unit")}
      >
        <button
          type="button"
          class={`btn btn-sm min-h-11 shrink-0 ${selectedUnit === "" ? "btn-primary" : "btn-outline"}`}
          onclick={() => (selectedUnit = "")}>{t("characterUnitAll", "All")}</button
        >
        {#each units as unit (unit)}
          <button
            type="button"
            class={`btn btn-circle btn-sm size-11! shrink-0 p-0 ${selectedUnit === unit ? "btn-primary" : "btn-outline"}`}
            aria-label={unit}
            aria-pressed={selectedUnit === unit}
            onclick={() => (selectedUnit = unit)}
          >
            <UnitIconBadge {unit} variant="sm" />
          </button>
        {/each}
      </div>
    </div>
    {#if !loading}<p class="mt-3 text-xs font-medium opacity-55">
        {t("characterResultCount", "{count} characters").replace(
          "{count}",
          String(visibleItems.length)
        )}
      </p>{/if}
  </div>

  {#if loading}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each Array(12) as _, index (index)}<div
          class="content-card-shell flex min-h-40 items-center gap-4 rounded-2xl p-5"
        >
          <div class="skeleton size-22 rounded-full"></div>
          <div class="flex-1 space-y-3">
            <div class="skeleton h-4 w-2/3"></div>
            <div class="skeleton h-3 w-1/2"></div>
          </div>
        </div>{/each}
    </div>
  {:else if loadFailed}
    <div class="alert alert-error" role="alert">
      <Icon icon="mdi:alert-circle-outline" class="size-5" aria-hidden="true" />{t(
        "characterListLoadFailed",
        "Character data could not be loaded."
      )}
    </div>
  {:else if visibleItems.length === 0}
    <div
      class="content-card-inset flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl px-6 text-center"
    >
      <Icon icon="mdi:account-search-outline" class="size-9 opacity-45" aria-hidden="true" />
      <p class="font-semibold">{t("characterListEmpty", "No characters match these filters.")}</p>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        onclick={() => {
          query = "";
          selectedUnit = "";
        }}>{t("characterClearFilters", "Clear filters")}</button
      >
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each visibleItems as character (character.id)}<CharacterCatalogueCard
          {character}
          region={data.region}
          unitLabel={t("characterUnitLabel", "Unit")}
          heightLabel={t("characterHeightLabel", "Height")}
        />{/each}
    </div>
  {/if}
</section>
