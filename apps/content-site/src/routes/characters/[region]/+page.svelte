<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import CharacterCatalogueCard from "$lib/components/character/CharacterCatalogueCard.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import type { CharacterCatalogueItem } from "$lib/domain/character";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "character", "card", "error"]);
  let messages = $state<Record<string, string>>(fallbackMessages);
  let catalogue = $state<CharacterCatalogueItem[]>([]);
  let unitProfiles = $state<Record<string, string>>({});
  let loadFailed = $state(false);
  let loading = $state(true);
  let requestId = 0;
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const t = (key: string, fallback: string): string => translate(key, fallback);
  const groups = $derived.by(() => {
    const grouped = new Map<string, CharacterCatalogueItem[]>();
    for (const item of catalogue) {
      const key = item.unit && unitProfiles[item.unit] ? unitProfiles[item.unit] : "__unassigned";
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return [...grouped.entries()];
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
      unitProfiles = "unitProfiles" in result ? (result.unitProfiles as Record<string, string>) : {};
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

  <div class="content-card-shell rounded-2xl border border-base-content/8 p-4 shadow-sm sm:p-5">
    <p class="max-w-2xl text-sm/relaxed opacity-70">{t("characterListIntro", "Browse the cast by group, then open a character to explore their details and cards.")}</p>
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
  {:else if catalogue.length === 0}
    <div
      class="content-card-inset flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl px-6 text-center"
    >
      <Icon icon="mdi:account-search-outline" class="size-9 opacity-45" aria-hidden="true" />
      <p class="font-semibold">{t("characterListEmpty", "No characters are available for this region.")}</p>
    </div>
  {:else}
    <div class="flex flex-col gap-7">
      {#each groups as [group, characters] (group)}
        <section aria-labelledby={`character-group-${group}`}>
          <div class="mb-4 flex items-center gap-3 rounded-xl border-b border-base-content/10 bg-base-100/60 px-4 py-3">
            {#if group !== "__unassigned"}<UnitIconBadge unit={characters[0]?.unit ?? ""} variant="lg" />{/if}
            <div class="min-w-0">
              <h2 id={`character-group-${group}`} class="text-lg font-bold">
                {group === "__unassigned" ? t("characterUnassignedGroup", "Other characters") : group}
              </h2>
              <p class="truncate text-xs opacity-60">{t("characterGroupDescription", "Characters in this group")}</p>
            </div>
          </div>
          <div class={`grid justify-center gap-3 sm:gap-4 ${group === "piapro" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
            {#each characters as character (character.id)}<CharacterCatalogueCard
          {character}
          region={data.region}
          unitLabel={t("characterUnitLabel", "Unit")}
          heightLabel={t("characterHeightLabel", "Height")}
        />{/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</section>
