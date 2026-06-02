<script lang="ts">
  import { getMusicJacketAssetURL } from "$lib/assets";
  import { getContentDisplaySettings } from "$lib/content-display-settings";
  import { toTimestampMs } from "$lib/date-time";
  import EventAssetImage from "$lib/components/EventAssetImage.svelte";
  import type { SupportedRegion } from "$lib/regions";

  type MusicListItem = {
    id: string;
    title: string;
    assetBundleName: string | null;
    categories: string[];
    composer: string | null;
    publishedAt: string | number | null;
  };

  let {
    region,
    item,
    viewMode,
    idLabel,
    jacketAltSuffix,
    creatorLabel,
    spoilerContentLabel,
    getCategoryLabel
  }: {
    region: SupportedRegion;
    item: MusicListItem;
    viewMode: "grid" | "agenda";
    idLabel: string;
    jacketAltSuffix: string;
    creatorLabel: string;
    spoilerContentLabel: string;
    getCategoryLabel: (value: string) => string;
  } = $props();

  const contentDisplaySettings = getContentDisplaySettings();
  const spoilerRevealAnimationMs = 180;
  let spoilerRevealed = $state(false);
  let spoilerRevealAnimating = $state(false);
  let lastSpoilerIdentity = $state("");
  let spoilerRevealTimeout: ReturnType<typeof setTimeout> | null = null;

  const hasSpoiler = (): boolean => {
    const publishedAtMs = toTimestampMs(item.publishedAt);
    return publishedAtMs !== null && publishedAtMs > Date.now();
  };

  const isSpoilerPlaceholderVisible = (): boolean =>
    hasSpoiler() &&
    contentDisplaySettings.mosaickedSpoilerContent &&
    (!spoilerRevealed || spoilerRevealAnimating);

  const clearSpoilerRevealTimeout = (): void => {
    if (spoilerRevealTimeout === null) {
      return;
    }

    clearTimeout(spoilerRevealTimeout);
    spoilerRevealTimeout = null;
  };

  $effect(() => {
    const nextSpoilerIdentity = `${region}:${item.id}`;
    if (lastSpoilerIdentity === nextSpoilerIdentity) {
      return;
    }

    clearSpoilerRevealTimeout();
    lastSpoilerIdentity = nextSpoilerIdentity;
    spoilerRevealed = false;
    spoilerRevealAnimating = false;

    return clearSpoilerRevealTimeout;
  });

  const revealSpoiler = (): void => {
    if (!isSpoilerPlaceholderVisible()) {
      return;
    }

    spoilerRevealAnimating = true;
    clearSpoilerRevealTimeout();
    spoilerRevealTimeout = setTimeout(() => {
      spoilerRevealed = true;
      spoilerRevealAnimating = false;
      spoilerRevealTimeout = null;
    }, spoilerRevealAnimationMs);
  };

  const handleRevealClick = (): void => {
    revealSpoiler();
  };
</script>

{#snippet spoilerOverlay()}
  <button
    type="button"
    class={`event-list-spoiler-mosaic-overlay absolute inset-0 z-10 flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center backdrop-blur-2xl transition-opacity duration-180 ease-out ${spoilerRevealAnimating ? "opacity-0" : "opacity-100"}`}
    aria-label={spoilerContentLabel}
    onclick={handleRevealClick}
  >
    <div
      class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-error/70 text-2xl font-black leading-none text-error"
    >
      !
    </div>
    <span class="text-sm font-semibold tracking-[0.12em] text-error">{spoilerContentLabel}</span>
  </button>
{/snippet}

<article class="card content-card-shell relative overflow-hidden shadow-sm">
  {#if isSpoilerPlaceholderVisible()}
    {@render spoilerOverlay()}
  {/if}
  {#if viewMode === "agenda"}
    <div class="grid grid-cols-[5.5rem_1fr] gap-3 p-3 sm:grid-cols-[6.5rem_1fr]">
      {#if isSpoilerPlaceholderVisible()}
        <div class="aspect-square rounded-xl bg-base-200/60"></div>
      {:else if item.assetBundleName}
        <EventAssetImage
          src={getMusicJacketAssetURL(item.assetBundleName, region)}
          alt={`${item.title} ${jacketAltSuffix}`}
          imageClass="h-full w-full object-cover"
          buttonClass="block aspect-square w-full overflow-hidden rounded-xl"
        />
      {:else}
        <div class="aspect-square rounded-xl bg-base-200"></div>
      {/if}
      <div class="flex min-w-0 flex-col justify-center gap-2">
        {#if isSpoilerPlaceholderVisible()}
          <div class="h-5 w-16 rounded-full bg-base-200/60"></div>
          <div class="h-11 rounded-lg bg-base-200/60"></div>
          <div class="h-4 rounded bg-base-200/60"></div>
        {:else}
          <span class="badge badge-sm border-none bg-base-200 font-semibold text-base-content">
            {idLabel}{item.id}
          </span>
          <h2 class="line-clamp-2 font-semibold leading-snug">{item.title}</h2>
          {#if item.composer}
            <p class="truncate text-sm opacity-70">{creatorLabel}: {item.composer}</p>
          {/if}
          <div class="flex flex-wrap gap-1">
            {#each item.categories as category (category)}
              <span class="badge badge-sm badge-outline border-base-content/15">
                {getCategoryLabel(category)}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="relative aspect-square overflow-hidden">
      {#if isSpoilerPlaceholderVisible()}
        <div class="h-full w-full bg-base-200/60"></div>
      {:else if item.assetBundleName}
        <EventAssetImage
          src={getMusicJacketAssetURL(item.assetBundleName, region)}
          alt={`${item.title} ${jacketAltSuffix}`}
          imageClass="h-full w-full object-cover"
          buttonClass="block h-full w-full overflow-hidden"
        />
      {:else}
        <div class="h-full w-full bg-base-200"></div>
      {/if}
      {#if !isSpoilerPlaceholderVisible()}
        <div class="absolute left-3 top-3">
          <span class="badge border-none bg-base-100/94 font-semibold text-base-content shadow-sm">
            {idLabel}{item.id}
          </span>
        </div>
        <div class="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          {#each item.categories as category (category)}
            <span
              class="badge border-none bg-base-100/94 font-semibold text-base-content shadow-sm"
            >
              {getCategoryLabel(category)}
            </span>
          {/each}
        </div>
      {/if}
    </div>
    {#if !isSpoilerPlaceholderVisible()}
      <div class="card-body gap-2 p-4">
        <h2 class="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</h2>
        {#if item.composer}
          <p class="truncate text-xs opacity-70">{item.composer}</p>
        {/if}
      </div>
    {/if}
  {/if}
</article>
