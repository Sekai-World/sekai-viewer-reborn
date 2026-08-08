<script lang="ts">
  import {
    getEventBackgroundAssetURL,
    getEventBannerAssetURL,
    getEventCharacterAssetURL,
    getEventLogoAssetURL
  } from "$lib/assets/index";
  import type { EventDetail } from "$lib/domain/event-detail";
  import type { SupportedRegion } from "$lib/domain/regions";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import Icon from "@iconify/svelte";
  import { DETAIL_MEDIA_BUTTON_CLASS, DETAIL_MEDIA_RADIUS_CLASS } from "$lib/styles/detail-media";

  type EventAssetTab = "banner" | "title" | "background" | "characters";

  let {
    event,
    region,
    activeTab = $bindable<EventAssetTab>("banner"),
    bannerLabel,
    titleLabel,
    backgroundLabel,
    charactersLabel,
    bannerAltSuffix,
    imageUnavailableLabel,
    closeLabel
  }: {
    event: EventDetail;
    region: SupportedRegion;
    activeTab?: EventAssetTab;
    bannerLabel: string;
    titleLabel: string;
    backgroundLabel: string;
    charactersLabel: string;
    bannerAltSuffix: string;
    imageUnavailableLabel: string;
    closeLabel: string;
  } = $props();

  let previewOpen = $state(false);
  const previewFormatOptions = ["webp", "png"];
  const normalizedPreviewFormatOptions = previewFormatOptions
    .map((format) => format.trim().toLowerCase())
    .filter(Boolean);

  const isWorldLinkEvent = (eventType: string | null | undefined): boolean =>
    eventType === "world_bloom";
  const shouldShowCharacterTab = (eventType: string | null | undefined): boolean =>
    !isWorldLinkEvent(eventType);
  const resolvedTab = $derived(
    isWorldLinkEvent(event.eventType) && activeTab === "characters" ? "banner" : activeTab
  );
  const isCompactTab = (tab: EventAssetTab): boolean => tab === "banner" || tab === "title";
  const getTabClass = (tab: EventAssetTab): string =>
    `tab min-h-11 flex-1 rounded-xl border border-transparent font-semibold transition-[background-color,border-color,color] duration-150 ${
      resolvedTab === tab
        ? "border-primary/45 bg-primary text-primary-content shadow-[0_4px_12px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]"
        : "text-[var(--archive-text-muted)] hover:border-(--archive-border-default) hover:bg-(--archive-surface-raised)"
    }`;
  const openPreview = (): void => {
    previewOpen = true;
  };

  $effect(() => {
    if (event.id || region || activeTab) {
      previewOpen = false;
    }
  });
</script>

{#snippet previewImage(src: string, alt: string, imageClass: string, fallbackLabel = "")}
  <AssetImage
    {src}
    {alt}
    {fallbackLabel}
    buttonClass={DETAIL_MEDIA_BUTTON_CLASS}
    interactive={true}
    imageClass={`${imageClass} ${DETAIL_MEDIA_RADIUS_CLASS}`}
    onclick={() => {
      openPreview();
    }}
  />
  <ImagePreviewDialog
    bind:open={previewOpen}
    {src}
    {alt}
    {fallbackLabel}
    {closeLabel}
    formatOptions={normalizedPreviewFormatOptions}
    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
  />
{/snippet}

{#snippet missingTitle()}
  <div class="flex h-full items-center justify-center px-6 text-center text-sm opacity-70">
    {event.title}
  </div>
{/snippet}

<article
  class="card content-card-shell overflow-hidden shadow-[0_10px_28px_color-mix(in_oklab,var(--color-base-content)_5%,transparent)]"
>
  <div class="card-body items-center gap-4 p-3 sm:p-5 text-center">
    <div
      class={`tabs tabs-box content-card-inset grid w-full grid-cols-2 border-(--archive-border-default) bg-(--archive-surface-sunken) p-1.5 ${
        shouldShowCharacterTab(event.eventType) ? "sm:grid-cols-4" : "sm:grid-cols-3"
      }`}
    >
      <button type="button" class={getTabClass("banner")} onclick={() => (activeTab = "banner")}>
        {bannerLabel}
      </button>
      <button type="button" class={getTabClass("title")} onclick={() => (activeTab = "title")}>
        {titleLabel}
      </button>
      <button
        type="button"
        class={`${getTabClass("background")} ${
          shouldShowCharacterTab(event.eventType) ? "" : "col-span-2 sm:col-span-1"
        }`}
        onclick={() => (activeTab = "background")}
      >
        {backgroundLabel}
      </button>
      {#if shouldShowCharacterTab(event.eventType)}
        <button
          type="button"
          class={getTabClass("characters")}
          onclick={() => (activeTab = "characters")}
        >
          {charactersLabel}
        </button>
      {/if}
    </div>

    <div
      class={`content-card-inset w-full overflow-hidden border-(--archive-border-default) bg-(--archive-surface-overlay) ${DETAIL_MEDIA_RADIUS_CLASS} transition-[aspect-ratio] duration-300 ease-out ${
        isCompactTab(resolvedTab) ? "aspect-16/7" : "aspect-16/10"
      }`}
    >
      {#if resolvedTab === "banner"}
        {#if event.assetBundleName}
          {@render previewImage(
            getEventBannerAssetURL(event.assetBundleName, region),
            `${event.title} ${bannerAltSuffix}`,
            "h-full w-full object-contain p-4 md:p-6"
          )}
        {:else}
          {@render missingTitle()}
        {/if}
      {:else if resolvedTab === "title"}
        {#if event.assetBundleName}
          {@render previewImage(
            getEventLogoAssetURL(event.assetBundleName, region),
            event.title,
            "h-full w-full object-contain p-4 md:p-6"
          )}
        {:else}
          {@render missingTitle()}
        {/if}
      {:else if resolvedTab === "background"}
        {#if event.assetBundleName}
          {@render previewImage(
            getEventBackgroundAssetURL(event.assetBundleName, region),
            event.title,
            "h-full w-full object-cover"
          )}
        {:else}
          {@render missingTitle()}
        {/if}
      {:else if event.assetBundleName}
        {@render previewImage(
          getEventCharacterAssetURL(event.assetBundleName, region),
          event.title,
          "h-full w-full object-contain",
          imageUnavailableLabel
        )}
      {:else}
        <div
          class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
        >
          <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
          <span class="font-medium">{imageUnavailableLabel}</span>
        </div>
      {/if}
    </div>
  </div>
</article>
