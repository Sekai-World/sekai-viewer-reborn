<script lang="ts">
  import {
    getCardCutoutAssetURL,
    getCardFullAssetURL
  } from "$lib/assets/index";
  import type { CardDetail } from "$lib/domain/card-detail";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import Icon from "@iconify/svelte";

  export type CardAssetTab = "normal" | "trained" | "normalCutout" | "trainedCutout";

  let {
    card,
    region,
    activeTab = $bindable<CardAssetTab>("normal"),
    normalLabel,
    trainedLabel,
    normalCutoutLabel,
    trainedCutoutLabel,
    imageUnavailableLabel,
    cardImageAltSuffix,
    closeLabel
  }: {
    card: CardDetail;
    region: SupportedRegion;
    activeTab?: CardAssetTab;
    normalLabel: string;
    trainedLabel: string;
    normalCutoutLabel: string;
    trainedCutoutLabel: string;
    imageUnavailableLabel: string;
    cardImageAltSuffix: string;
    closeLabel: string;
  } = $props();

  let previewOpen = $state(false);
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
      tabs.push("normal", "normalCutout");
    }
    if (isTrainableCard()) {
      tabs.push("trained", "trainedCutout");
    }
    return tabs.length > 0 ? tabs : ["normal"];
  });
  const resolvedTab = $derived(availableTabs.includes(activeTab) ? activeTab : availableTabs[0]);
  const getAssetRegion = (): SupportedRegion => "jp";
  const isCutoutTab = (tab: CardAssetTab): boolean => tab === "normalCutout" || tab === "trainedCutout";
  const isTrainedTab = (tab: CardAssetTab): boolean => tab === "trained" || tab === "trainedCutout";
  const getTabLabel = (tab: CardAssetTab): string => {
    if (tab === "trained") {
      return trainedLabel;
    }
    if (tab === "normalCutout") {
      return normalCutoutLabel;
    }
    if (tab === "trainedCutout") {
      return trainedCutoutLabel;
    }
    return normalLabel;
  };
  const getTabClass = (tab: CardAssetTab): string =>
    `tab min-w-0 flex-1 whitespace-nowrap rounded-xl border border-transparent px-2 text-xs font-semibold transition-colors sm:text-sm ${
      resolvedTab === tab
        ? "border-primary/45 bg-primary text-primary-content shadow-sm"
        : "text-base-content/70 hover:bg-base-100/80"
    }`;
  const getPreviewAspectClass = (): string =>
    isCutoutTab(resolvedTab) ? "aspect-4/3" : "aspect-[21/10]";
  const getAssetUrl = (
    tab: CardAssetTab,
    assetRegion = getAssetRegion(),
    extension = "webp"
  ): string | null => {
    if (!card.assetBundleName) {
      return null;
    }

    return isCutoutTab(tab)
      ? getCardCutoutAssetURL(card.assetBundleName, isTrainedTab(tab), assetRegion, extension)
      : getCardFullAssetURL(card.assetBundleName, isTrainedTab(tab), assetRegion, extension);
  };
  const imageUrl = $derived(getAssetUrl(resolvedTab));
  const openPreview = (): void => {
    previewOpen = true;
  };

  $effect(() => {
    if (card.id || region || activeTab) {
      previewOpen = false;
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
    imageClass={`h-full w-full ${isCutoutTab(resolvedTab) ? "object-contain p-2" : "object-contain"}`}
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
    <div
      class={`tabs tabs-box content-card-inset grid w-full ${availableTabs.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-1 p-1 sm:flex`}
    >
      {#each availableTabs as tab (tab)}
        <button type="button" class={getTabClass(tab)} onclick={() => (activeTab = tab)}>
          {getTabLabel(tab)}
        </button>
      {/each}
    </div>

    <div
      class={`content-card-inset flex w-full items-center justify-center overflow-hidden rounded-[1.75rem] transition-[aspect-ratio] duration-300 ease-out ${getPreviewAspectClass()}`}
    >
      {#if imageUrl}
        {@render imagePreview(
          imageUrl,
          `${card.title} ${cardImageAltSuffix}`
        )}
      {:else}
        <div class="flex flex-col items-center justify-center gap-3 px-6 text-sm text-base-content/65">
          <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
          <span class="font-medium">{imageUnavailableLabel}</span>
        </div>
      {/if}
    </div>
  </div>
</article>
