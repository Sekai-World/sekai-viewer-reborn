<script lang="ts">
  import {
    getEventBackgroundAssetURL,
    getEventBannerAssetURL,
    getEventCharacterAssetURL,
    getEventLogoAssetURL
  } from "$lib/assets";
  import type { EventDetail } from "$lib/event-detail";
  import type { SupportedRegion } from "$lib/regions";
  import EventAssetImage from "$lib/components/EventAssetImage.svelte";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import Icon from "@iconify/svelte";

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
  let previewFormat = $state("");
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
    `tab flex-1 rounded-xl border border-transparent font-semibold transition-colors ${
      resolvedTab === tab
        ? "border-primary/45 bg-primary text-primary-content shadow-sm"
        : "text-base-content/70 hover:bg-base-100/80"
    }`;
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
    if (event.id || region || activeTab) {
      previewOpen = false;
      previewFormat = "";
    }
  });
</script>

{#snippet previewImage(src: string, alt: string, imageClass: string, fallbackLabel = "")}
  {@const resolvedSrc = getResolvedPreviewSrc(src)}
  <EventAssetImage
    src={resolvedSrc}
    {alt}
    {fallbackLabel}
    buttonClass="block h-full w-full cursor-zoom-in overflow-hidden"
    interactive={true}
    {imageClass}
    onclick={() => {
      openPreview(src);
    }}
  />
  <ImagePreviewDialog
    bind:open={previewOpen}
    src={resolvedSrc}
    {alt}
    {fallbackLabel}
    {closeLabel}
    formatOptions={normalizedPreviewFormatOptions}
    currentFormat={previewFormat}
    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
    onFormatChange={(format: string) => {
      previewFormat = format;
    }}
  />
{/snippet}

{#snippet missingTitle()}
  <div class="flex h-full items-center justify-center px-6 text-center text-sm opacity-70">
    {event.title}
  </div>
{/snippet}

<article class="card content-card-shell overflow-hidden shadow-sm">
  <div class="card-body items-center gap-3 p-5 text-center">
    <div class="tabs tabs-box content-card-inset w-full p-1">
      <button type="button" class={getTabClass("banner")} onclick={() => (activeTab = "banner")}>
        {bannerLabel}
      </button>
      <button type="button" class={getTabClass("title")} onclick={() => (activeTab = "title")}>
        {titleLabel}
      </button>
      <button
        type="button"
        class={getTabClass("background")}
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
      class={`content-card-inset w-full overflow-hidden rounded-[1.75rem] transition-[aspect-ratio] duration-300 ease-out ${
        isCompactTab(resolvedTab) ? "aspect-[16/7]" : "aspect-[16/10]"
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
          <Icon icon="mdi:file-remove-outline" class="h-10 w-10 opacity-75" aria-hidden="true" />
          <span class="font-medium">{imageUnavailableLabel}</span>
        </div>
      {/if}
    </div>
  </div>
</article>
