<script lang="ts">
  import {
    getGachaBackgroundAssetURL,
    getGachaBackgroundFallbackAssetURL,
    getGachaBannerAssetURL,
    getGachaLogoAssetURL
  } from "$lib/assets/index";
  import type { GachaDetail } from "$lib/domain/gacha-detail";
  import type { SupportedRegion } from "$lib/domain/regions";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import {
    DETAIL_MEDIA_BUTTON_CLASS,
    DETAIL_MEDIA_RADIUS_CLASS
  } from "$lib/styles/detail-media";

  export type GachaAssetTab = "logo" | "banner" | "background";
  type PreviewImageOptions = {
    src: string;
    alt: string;
    imageClass: string;
    fallbackSrc?: string;
    fallbackLabel?: string;
  };

  let {
    gacha,
    region,
    activeTab = $bindable<GachaAssetTab>("logo"),
    logoLabel,
    bannerLabel,
    backgroundLabel,
    backgroundUnavailableLabel,
    bannerAltSuffix,
    imageUnavailableLabel,
    closeLabel
  }: {
    gacha: GachaDetail;
    region: SupportedRegion;
    activeTab?: GachaAssetTab;
    logoLabel: string;
    bannerLabel: string;
    backgroundLabel: string;
    backgroundUnavailableLabel: string;
    bannerAltSuffix: string;
    imageUnavailableLabel: string;
    closeLabel: string;
  } = $props();

  let previewOpen = $state(false);
  const previewFormatOptions = ["webp", "png"];
  const normalizedPreviewFormatOptions = previewFormatOptions
    .map((format) => format.trim().toLowerCase())
    .filter(Boolean);

  const getTabClass = (tab: GachaAssetTab): string =>
    `tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
      activeTab === tab
        ? "border-primary/45 bg-primary text-primary-content shadow-sm"
        : "text-base-content/70 hover:bg-base-100/80"
    }`;
  const openPreview = (): void => {
    previewOpen = true;
  };

  $effect(() => {
    if (gacha.id || region || activeTab) {
      previewOpen = false;
    }
  });
</script>

{#snippet previewImage(options: PreviewImageOptions)}
  <AssetImage
    src={options.src}
    fallbackSrc={options.fallbackSrc}
    alt={options.alt}
    fallbackLabel={options.fallbackLabel}
    buttonClass={DETAIL_MEDIA_BUTTON_CLASS}
    interactive={true}
    imageClass={`${options.imageClass} ${DETAIL_MEDIA_RADIUS_CLASS}`}
    onclick={() => {
      openPreview();
    }}
  />
  <ImagePreviewDialog
    bind:open={previewOpen}
    src={options.src}
    fallbackSrc={options.fallbackSrc}
    alt={options.alt}
    fallbackLabel={options.fallbackLabel}
    {closeLabel}
    formatOptions={normalizedPreviewFormatOptions}
    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
  />
{/snippet}

{#snippet missingImage()}
  <div class="flex h-full items-center justify-center px-6 text-center text-sm opacity-70">
    {gacha.name ?? imageUnavailableLabel}
  </div>
{/snippet}

{#snippet missingBackgroundImage()}
  <div
    class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
  >
    <span class="font-medium">{backgroundUnavailableLabel}</span>
  </div>
{/snippet}

<article class="card content-card-shell overflow-hidden shadow-sm">
  <div class="card-body items-center gap-3 p-3 sm:p-5 text-center">
    <div class="tabs tabs-box content-card-inset w-full p-1">
      <button type="button" class={getTabClass("logo")} onclick={() => (activeTab = "logo")}>
        {logoLabel}
      </button>
      <button type="button" class={getTabClass("banner")} onclick={() => (activeTab = "banner")}>
        {bannerLabel}
      </button>
      <button
        type="button"
        class={getTabClass("background")}
        onclick={() => (activeTab = "background")}
      >
        {backgroundLabel}
      </button>
    </div>

    <div
      class={`content-card-inset w-full overflow-hidden ${DETAIL_MEDIA_RADIUS_CLASS} transition-[aspect-ratio] duration-300 ease-out ${activeTab === "background" ? "aspect-video" : "aspect-16/7"}`}
    >
      {#if activeTab === "logo"}
        {#if gacha.assetBundleName}
          {@render previewImage({
            src: getGachaLogoAssetURL(gacha.assetBundleName, region),
            alt: `${gacha.name ?? gacha.id} ${bannerAltSuffix}`,
            imageClass: "h-full w-full object-contain p-4 md:p-6"
          })}
        {:else}
          {@render missingImage()}
        {/if}
      {:else if activeTab === "banner"}
        {#if gacha.id}
          {@render previewImage({
            src: getGachaBannerAssetURL(gacha.id, region),
            alt: `${gacha.name ?? gacha.id} ${bannerAltSuffix}`,
            imageClass: "h-full w-full object-contain p-4 md:p-6"
          })}
        {:else}
          {@render missingImage()}
        {/if}
      {:else}
        {@const backgroundSrc = getGachaBackgroundAssetURL(gacha.assetBundleName, gacha.id, region)}
        {@const backgroundFallbackSrc = getGachaBackgroundFallbackAssetURL(
          gacha.assetBundleName,
          gacha.id,
          region
        )}
        {#if backgroundSrc}
          {@render previewImage({
            src: backgroundSrc,
            fallbackSrc: backgroundFallbackSrc,
            alt: `${gacha.name ?? gacha.id} ${backgroundLabel}`,
            imageClass: "h-full w-full object-contain",
            fallbackLabel: backgroundUnavailableLabel
          })}
        {:else}
          {@render missingBackgroundImage()}
        {/if}
      {/if}
    </div>
  </div>
</article>
