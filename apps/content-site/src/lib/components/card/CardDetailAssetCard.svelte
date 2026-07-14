<script lang="ts">
  import { getCardFullAssetURL } from "$lib/assets/index";
  import type { CardDetail } from "$lib/domain/card-detail";
  import CardDetailGalleryDialog from "$lib/components/card/CardDetailGalleryDialog.svelte";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import Icon from "@iconify/svelte";

  export type CardAssetTab = "normal" | "trained";

  let {
    card,
    region,
    activeTab = $bindable<CardAssetTab>("normal"),
    normalLabel,
    trainedLabel,
    imageUnavailableLabel,
    cardImageAltSuffix,
    closeLabel,
    galleryButtonLabel,
    galleryTitle,
    galleryDescription,
    galleryLoadingLabel,
    galleryUnavailableLabel,
    galleryThumbnailLabel,
    gallerySmallLabel,
    galleryFullLabel,
    galleryCutoutLabel,
    galleryCutoutTrimmedLabel,
    galleryGachaLabel
  }: {
    card: CardDetail;
    region: SupportedRegion;
    activeTab?: CardAssetTab;
    normalLabel: string;
    trainedLabel: string;
    imageUnavailableLabel: string;
    cardImageAltSuffix: string;
    closeLabel: string;
    galleryButtonLabel: string;
    galleryTitle: string;
    galleryDescription: string;
    galleryLoadingLabel: string;
    galleryUnavailableLabel: string;
    galleryThumbnailLabel: string;
    gallerySmallLabel: string;
    galleryFullLabel: string;
    galleryCutoutLabel: string;
    galleryCutoutTrimmedLabel: string;
    galleryGachaLabel: string;
  } = $props();

  let previewOpen = $state(false);
  let galleryOpen = $state(false);
  const previewFormatOptions = ["webp", "png"];
  const normalizedPreviewFormatOptions = previewFormatOptions
    .map((format) => format.trim().toLowerCase())
    .filter(Boolean);

  const isTrainableCard = (): boolean =>
    card.rarityType === "rarity_3" || card.rarityType === "rarity_4";
  const isTrainedOnlyCard = (): boolean =>
    card.initialSpecialTrainingStatus === "done" && isTrainableCard();
  const availableTabs = $derived.by<CardAssetTab[]>(() => {
    const tabs: CardAssetTab[] = [];
    if (!isTrainedOnlyCard()) {
      tabs.push("normal");
    }
    if (isTrainableCard()) {
      tabs.push("trained");
    }
    return tabs.length > 0 ? tabs : (["normal"] as CardAssetTab[]);
  });
  const resolvedTab = $derived(availableTabs.includes(activeTab) ? activeTab : availableTabs[0]);
  const isTrainedTab = (tab: CardAssetTab): boolean => tab === "trained";
  const getTabLabel = (tab: CardAssetTab): string =>
    tab === "trained" ? trainedLabel : normalLabel;
  const getTabClass = (tab: CardAssetTab): string =>
    `tab min-w-0 flex-1 whitespace-nowrap rounded-xl border border-transparent px-2 text-xs font-semibold transition-colors sm:text-sm ${
      resolvedTab === tab
        ? "border-primary/45 bg-primary text-primary-content shadow-sm"
        : "text-base-content/70 hover:bg-base-100/80"
    }`;
  const getAssetUrl = (
    tab: CardAssetTab,
    assetRegion: SupportedRegion = "jp",
    extension = "webp"
  ): string | null => {
    if (!card.assetBundleName) {
      return null;
    }
    return getCardFullAssetURL(card.assetBundleName, isTrainedTab(tab), assetRegion, extension);
  };
  const imageUrl = $derived(getAssetUrl(resolvedTab));
  const openPreview = (): void => {
    previewOpen = true;
  };

  $effect(() => {
    if (card.id || region || activeTab) {
      previewOpen = false;
      galleryOpen = false;
    }
  });
</script>

{#snippet imagePreview(src: string, alt: string)}
  <EventAssetImage
    {src}
    {alt}
    fallbackLabel={imageUnavailableLabel}
    buttonClass="block h-full w-full overflow-hidden"
    interactive={true}
    imageClass="h-full w-full object-cover"
    onclick={() => {
      openPreview();
    }}
  />
  <ImagePreviewDialog
    bind:open={previewOpen}
    {src}
    {alt}
    fallbackLabel={imageUnavailableLabel}
    {closeLabel}
    formatOptions={normalizedPreviewFormatOptions}
    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
  />
{/snippet}

<article class="card content-card-shell overflow-hidden shadow-sm">
  <div class="card-body items-center gap-3 p-3 sm:p-5 text-center">
    {#if availableTabs.length > 1}
      <div class="tabs tabs-box content-card-inset flex w-full gap-1 p-1">
        {#each availableTabs as tab (tab)}
          <button type="button" class={getTabClass(tab)} onclick={() => (activeTab = tab)}>
            {getTabLabel(tab)}
          </button>
        {/each}
      </div>
    {/if}

    <div
      class="content-card-inset flex w-full items-center justify-center overflow-hidden rounded-[1.75rem] aspect-16/10"
    >
      {#if imageUrl}
        {@render imagePreview(imageUrl, `${card.title} ${cardImageAltSuffix}`)}
      {:else}
        <div
          class="flex flex-col items-center justify-center gap-3 px-6 text-sm text-base-content/65"
        >
          <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
          <span class="font-medium">{imageUnavailableLabel}</span>
        </div>
      {/if}
    </div>

    <div class="flex w-full justify-end">
      <button
        type="button"
        class="btn btn-ghost btn-sm min-h-10! gap-1.5 px-3 text-xs font-semibold"
        disabled={!card.assetBundleName}
        onclick={() => (galleryOpen = true)}
      >
        <Icon icon="mdi:view-grid-outline" class="size-4" aria-hidden="true" />
        {galleryButtonLabel}
      </button>
    </div>
  </div>
</article>

<CardDetailGalleryDialog
  bind:open={galleryOpen}
  {card}
  title={galleryTitle}
  description={galleryDescription}
  {closeLabel}
  {normalLabel}
  {trainedLabel}
  loadingLabel={galleryLoadingLabel}
  unavailableLabel={galleryUnavailableLabel}
  thumbnailLabel={galleryThumbnailLabel}
  smallLabel={gallerySmallLabel}
  fullLabel={galleryFullLabel}
  cutoutLabel={galleryCutoutLabel}
  cutoutTrimmedLabel={galleryCutoutTrimmedLabel}
  gachaLabel={galleryGachaLabel}
/>
