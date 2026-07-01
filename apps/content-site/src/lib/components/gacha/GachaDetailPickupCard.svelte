<script lang="ts">
  import { getCardThumbnailAssetURL } from "$lib/assets/index";
  import type { SupportedRegion } from "$lib/domain/regions";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import Icon from "@iconify/svelte";
  import { resolve } from "$app/paths";

  export type GachaPickupCard = {
    cardId: string | null;
    weight: number | null;
    title: string | null;
    assetBundleName: string | null;
    attr: string | null;
    rarityType: string | null;
  };

  let {
    pickupCards,
    region,
    title,
    weightLabel,
    noPickupsLabel,
    cardAltSuffix
  }: {
    pickupCards: GachaPickupCard[];
    region: SupportedRegion;
    title: string;
    weightLabel: string;
    noPickupsLabel: string;
    cardAltSuffix: string;
  } = $props();

  const getCardDetailHref = (cardId: string): string =>
    resolve("/card/[region]/[id]", { region, id: cardId });

  const rarityValueByType: Record<string, number> = {
    rarity_1: 1,
    rarity_2: 2,
    rarity_3: 3,
    rarity_4: 4,
    rarity_birthday: 1
  };

  const getRarityValue = (rarityType: string | null): number =>
    rarityType ? (rarityValueByType[rarityType] ?? 0) : 0;
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon
        icon="mdi:cards-outline"
        class="size-4 shrink-0 translate-y-[0.5px]"
        aria-hidden="true"
      />
      <span>{title}</span>
    </p>

    {#if pickupCards.length === 0}
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-6 text-center text-sm opacity-70">
        {noPickupsLabel}
      </div>
    {:else}
      <div class="grid grid-cols-4 gap-1.5 md:grid-cols-[repeat(auto-fill,96px)]">
        {#each pickupCards as pickup (pickup.cardId ?? Math.random())}
          {#if pickup.cardId}
            <a
              href={getCardDetailHref(pickup.cardId)}
              class="group block"
            >
              <div class="overflow-hidden rounded-lg bg-base-200/30 ring-1 ring-base-content/5 transition-all hover:shadow-md hover:ring-primary/40">
                  <CardThumbnail
                    src={pickup.assetBundleName ? getCardThumbnailAssetURL(pickup.assetBundleName, false, "jp") : null}
                    fallbackSrc={pickup.assetBundleName && region !== "jp" ? getCardThumbnailAssetURL(pickup.assetBundleName, false, region) : null}
                    alt={pickup.title ? `${pickup.title} ${cardAltSuffix}` : `Card ${pickup.cardId}`}
                    fallbackLabel={pickup.cardId ?? ""}
                    trained={false}
                    attr={pickup.attr}
                    rarityType={pickup.rarityType}
                    rarityCount={pickup.rarityType === "rarity_birthday" ? 1 : getRarityValue(pickup.rarityType)}
                    showFrame={true}
                    showIcons={true}
                    loadMode="visible"
                    maxSize={96}
                    containerClass="relative mx-auto aspect-square overflow-hidden rounded-lg"
                    imageClass="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                {#if pickup.weight !== null && pickup.weight !== undefined}
                  <div class="flex items-center justify-center bg-gradient-to-r from-primary/10 to-transparent px-1 py-0.5 text-center text-[0.6rem] font-medium opacity-60">
                    {pickup.weight}
                  </div>
                {/if}
              </div>
            </a>
          {:else}
            <div class="overflow-hidden rounded-lg bg-base-200/30 ring-1 ring-base-content/5">
                <div class="relative mx-auto aspect-square overflow-hidden rounded-lg">
                  <div class="flex size-full items-center justify-center bg-base-200/50 text-xs opacity-50">
                    ?
                  </div>
                </div>
              </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</article>
