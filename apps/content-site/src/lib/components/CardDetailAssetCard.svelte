<script lang="ts">
  import {
    getCardCutoutAssetURL,
    getCardFullAssetURL
  } from "$lib/assets";
  import type { CardDetail } from "$lib/card-detail";
  import EventAssetImage from "$lib/components/EventAssetImage.svelte";
  import type { SupportedRegion } from "$lib/regions";
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
  let previewFormat = $state("");
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
    `tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
      resolvedTab === tab
        ? "border-primary/45 bg-primary text-primary-content shadow-sm"
        : "text-base-content/70 hover:bg-base-100/80"
    }`;
  const getPreviewAspectClass = (): string =>
    isCutoutTab(resolvedTab) ? "aspect-3/4" : "aspect-[21/10]";
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
  const getSrcExtension = (value: string): string => {
    const match = value.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
    return match?.[1]?.toLowerCase() ?? "";
  };
  const replaceSrcExtension = (value: string, extension: string): string =>
    value.replace(/(\.[a-z0-9]+)(?=([?#].*)?$)/i, `.${extension}`);
  const getResolvedPreviewSrc = (src: string): string =>
    previewFormat && normalizedPreviewFormatOptions.includes(previewFormat)
      ? replaceSrcExtension(src, previewFormat)
      : src;
  const openPreview = (src: string): void => {
    if (!previewFormat) {
      previewFormat = getSrcExtension(src);
    }
    previewOpen = true;
  };

  $effect(() => {
    if (card.id || region || activeTab) {
      previewOpen = false;
      previewFormat = "";
    }
  });
</script>

{#snippet imagePreview(src: string, alt: string)}
  {@const resolvedSrc = getResolvedPreviewSrc(src)}
  <EventAssetImage
    src={resolvedSrc}
    {alt}
    fallbackLabel={imageUnavailableLabel}
    buttonClass="block h-full w-full cursor-zoom-in overflow-hidden"
    interactive={true}
    imageClass={`h-full w-full ${isCutoutTab(resolvedTab) ? "object-contain p-4" : "object-contain"}`}
    onclick={() => {
      openPreview(src);
    }}
  />
  <ImagePreviewDialog
    bind:open={previewOpen}
    src={resolvedSrc}
    {alt}
    fallbackLabel={imageUnavailableLabel}
    {closeLabel}
    formatOptions={normalizedPreviewFormatOptions}
    currentFormat={previewFormat}
    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
    onFormatChange={(format: string) => {
      previewFormat = format;
    }}
  />
{/snippet}

<article class="card content-card-shell overflow-hidden shadow-sm">
  <div class="card-body items-center gap-3 p-5 text-center">
    <div class="tabs tabs-box content-card-inset w-full p-1">
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
