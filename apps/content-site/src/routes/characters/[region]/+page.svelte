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
  import type { CharacterCatalogueItem } from "$lib/domain/character";
  import { resolveUnitLogoUrl } from "$lib/domain/unit-icon";
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
    const grouped = catalogue.reduce<{
      order: string[];
      byGroup: Record<string, CharacterCatalogueItem[]>;
    }>(
      (result, item) => {
        const key = item.unit && unitProfiles[item.unit] ? unitProfiles[item.unit] : "__unassigned";
        return {
          order: result.order.includes(key) ? result.order : [...result.order, key],
          byGroup: {
            ...result.byGroup,
            [key]: [...(result.byGroup[key] ?? []), item]
          }
        };
      },
      { order: [], byGroup: {} }
    );

    return grouped.order.map(
      (group): [string, CharacterCatalogueItem[]] => [group, grouped.byGroup[group] ?? []]
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
    <div class="flex flex-col gap-4 sm:gap-5">
      {#each groups as [group, characters] (group)}
        <section class="flex flex-col items-center gap-2 sm:gap-2.5" aria-labelledby={`character-group-${group}`}>
          {#if group !== "__unassigned" && resolveUnitLogoUrl(characters[0]?.unit ?? "")}
            <img src={resolveUnitLogoUrl(characters[0]?.unit ?? "") ?? undefined} alt="" class="size-28 object-contain sm:size-32" />
          {/if}
          <div class="flex w-full max-w-4xl flex-nowrap items-center justify-center gap-px sm:gap-0.5">
            {#each characters as character (character.id)}<CharacterCatalogueCard {character} region={data.region} />{/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</section>
