<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import { getCardThumbnailAssetURL } from "$lib/assets/index";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import DetailPageSkeleton from "$lib/components/shared/DetailPageSkeleton.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import type { CharacterRelatedCard } from "$lib/domain/character";
  import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "character", "card", "error"]);
  let messages = $state<Record<string, string>>(fallbackMessages);
  let requestId = 0;
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const t = (key: string, fallback: string): string => translate(key, fallback);
  const listHref = (): string => resolve("/characters/[region]", { region: data.region });
  const cardsHref = (): string =>
    `${resolve("/cards/[region]", { region: data.region })}?character=${encodeURIComponent(data.characterId)}`;
  const breadcrumbs = (name: string) => [
    { label: t("home", "Home"), href: resolve("/") },
    { label: t("characterListTitle", "Characters"), href: listHref() },
    { label: name }
  ];
  const currentRegionOption = (): RegionBadgeOption[] => [
    { key: data.region, label: regionLabels[data.region], active: true }
  ];
  const regionOptions = (available: SupportedRegion[]): RegionBadgeOption[] =>
    supportedRegions
      .filter((region) => available.includes(region) || region === data.region)
      .map((region) =>
        region === data.region
          ? { key: region, label: regionLabels[region], active: true }
          : {
              key: region,
              label: regionLabels[region],
              href: resolve("/character/[region]/[id]", { region, id: data.characterId }),
              active: false
            }
      );
  const rarityValue = (type: string | null): number =>
    type === "rarity_birthday" ? 1 : Number(type?.match(/\d+/)?.[0] ?? 0);
  const trained = (card: CharacterRelatedCard): boolean =>
    card.initialSpecialTrainingStatus === "done";
  const cardSrc = (card: CharacterRelatedCard): string | null =>
    card.assetBundleName
      ? getCardThumbnailAssetURL(card.assetBundleName, trained(card), "jp")
      : null;
  const cardFallbackSrc = (card: CharacterRelatedCard): string | null =>
    card.assetBundleName && data.region !== "jp"
      ? getCardThumbnailAssetURL(card.assetBundleName, trained(card), data.region)
      : null;

  $effect(() => {
    const id = ++requestId;
    messages = fallbackMessages;
    if (browser)
      void Promise.resolve(data.i18nMessages).then((next) => {
        if (id === requestId) messages = next;
      });
  });
</script>

<svelte:head>
  {#await data.payload}<title
      >{t("characterPageTitlePrefix", "Character")} {data.characterId} - Sekai Viewer</title
    >{:then result}<title
      >{result.character?.name ??
        `${t("characterPageTitlePrefix", "Character")} ${data.characterId}`} - Sekai Viewer</title
    >{/await}
</svelte:head>

<section use:swipeRegion class="mx-auto flex w-full max-w-400 flex-col gap-4 px-2">
  {#await data.payload}
    <PageHeader breadcrumbs={breadcrumbs(`#${data.characterId}`)} breadcrumbClass="md:max-w-[68%]"
      >{#snippet actions()}<RegionBadgeSwitch
          options={currentRegionOption()}
        />{/snippet}</PageHeader
    >
    <DetailPageSkeleton kind="character" />
  {:then result}
    <PageHeader
      breadcrumbs={breadcrumbs(result.character?.name ?? `#${data.characterId}`)}
      breadcrumbClass="md:max-w-[68%]"
    >
      {#snippet actions()}{#await data.availableRegions then available}<RegionBadgeSwitch
            options={regionOptions(available)}
          />{/await}{/snippet}
    </PageHeader>

    {#if result.loadFailed}
      <div class="alert alert-error" role="alert">
        <Icon icon="mdi:alert-circle-outline" class="size-5" aria-hidden="true" />{t(
          "characterDetailLoadFailed",
          "Character data could not be loaded."
        )}
      </div>
    {:else if !result.character}
      <div class="alert alert-error" role="alert">
        {t("characterUnavailable", "This character is not available in the selected region.")}
      </div>
    {:else}
      {@const character = result.character}
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
      >
        <div class="flex flex-col gap-4">
          <article
            class="card content-card-shell overflow-hidden shadow-sm"
            style:--character-accent={character.unitRecord?.colorCode ?? "var(--color-primary)"}
          >
            <div
              class="card-body relative items-center gap-4 overflow-hidden p-5 text-center sm:p-8"
            >
              <div
                class="absolute inset-x-0 top-0 h-1 bg-(--character-accent)"
                aria-hidden="true"
              ></div>
              <div
                class="absolute -right-20 -top-24 size-64 rounded-full bg-(--character-accent) opacity-10"
                aria-hidden="true"
              ></div>
              <CharacterAvatar
                src={getLocalCharacterThumbnailAssetURL(character.id)}
                label={character.name}
                characterId={character.id}
                accentColor={character.unitRecord?.colorCode}
                decorative
                variant="default"
                class="size-36! border-4! bg-white shadow-lg sm:size-44!"
                imageClass="size-full object-contain"
              />
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.2em] opacity-45">
                  #{character.id}
                </p>
                <h1 class="mt-2 wrap-break-word text-3xl/tight font-bold sm:text-4xl">
                  {character.name}
                </h1>
              </div>
            </div>
          </article>

          <article class="card content-card-shell shadow-sm">
            <div class="card-body gap-4 p-3 sm:p-5">
              <div class="flex items-start justify-between gap-3">
                <p
                  class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                >
                  <Icon
                    icon="mdi:information-outline"
                    class="size-4 shrink-0 translate-y-[0.5px]"
                    aria-hidden="true"
                  /><span>{t("characterDetailTitle", "Character details")}</span>
                </p>
                <span class="badge badge-outline border-base-content/20 font-semibold"
                  >#{character.id}</span
                >
              </div>
              <dl class="space-y-2">
                {#each [[t("characterNameLabel", "Name"), character.name], [t("characterUnitLabel", "Unit"), character.unit ?? t("characterValueUnavailable", "Not available")], [t("characterHeightLabel", "Height"), character.height === null ? t("characterValueUnavailable", "Not available") : `${character.height} cm`]] as row (row[0])}
                  <div class="content-card-inset rounded-xl p-3 sm:px-4">
                    <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                      {row[0]}
                    </dt>
                    <dd class="mt-1 flex items-center gap-2 wrap-break-word text-sm font-medium">
                      {#if row[0] === t("characterUnitLabel", "Unit") && character.unit}<UnitIconBadge
                          unit={character.unit}
                          variant="sm"
                        />{/if}{row[1]}
                    </dd>
                  </div>
                {/each}
              </dl>
            </div>
          </article>
        </div>

        <div class="flex flex-col gap-4">
          <article class="card content-card-shell shadow-sm">
            <div class="card-body gap-4 p-3 sm:p-5">
              <section class="space-y-3" aria-labelledby="character-related-cards-title">
                <div class="flex items-center justify-between gap-3">
                  <h2
                    id="character-related-cards-title"
                    class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
                  >
                    <Icon
                      icon="mdi:cards-outline"
                      class="size-4 shrink-0 translate-y-[0.5px]"
                      aria-hidden="true"
                    /><span>{t("characterLatestCardsTitle", "Latest cards")}</span>
                  </h2>
                  <a class="btn btn-ghost btn-sm text-primary" href={cardsHref()}
                    >{t("characterViewAllCards", "View all")}</a
                  >
                </div>
                {#if character.relatedCards.length > 0}
                  <div class="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                    {#each character.relatedCards as card (card.id)}
                      <a
                        href={resolve("/card/[region]/[id]", { region: data.region, id: card.id })}
                        class="content-card-inset group flex h-full flex-col gap-2 rounded-xl p-2 outline-none transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-base-200/80 focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-label={card.prefix ?? `#${card.id}`}
                      >
                        <CardThumbnail
                          src={cardSrc(card)}
                          fallbackSrc={cardFallbackSrc(card)}
                          alt={card.prefix ?? `#${card.id}`}
                          fallbackLabel={`#${card.id}`}
                          trained={trained(card)}
                          attr={card.attr}
                          rarityType={card.rarityType}
                          rarityCount={rarityValue(card.rarityType)}
                          loadMode="visible"
                          maxSize={112}
                          containerClass="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-base-200"
                        />
                        <p class="line-clamp-2 text-center text-xs/4 font-medium group-hover:text-primary">
                          {card.prefix ?? `#${card.id}`}
                        </p>
                      </a>
                    {/each}
                  </div>
                {:else}<div
                    class="content-card-inset rounded-xl p-6 text-center text-sm opacity-65"
                  >
                    {t("characterCardsEmpty", "No related cards were found.")}
                  </div>{/if}
              </section>
            </div>
          </article>
        </div>
      </div>
    {/if}
  {/await}
</section>
