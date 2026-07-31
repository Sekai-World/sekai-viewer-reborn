<script lang="ts">
  import { goto } from "$app/navigation";
  import { asset } from "$app/paths";
  import { getCardSmallAssetURL, getCardThumbnailAssetURL } from "$lib/assets/index";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { formatDisplayDateTime, toTimestampMs } from "$lib/time/date-time";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import type { SupportedRegion } from "$lib/domain/regions";
  import CardGridImage from "$lib/components/card/CardGridImage.svelte";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";

  type CardListCardItem = {
    id: string;
    prefix: string;
    assetBundleName: string | null;
    attr: string | null;
    rarityType: string | null;
    characterId: number | null;
    characterName: string | null;
    unit: string | null;
    supportUnit: string | null;
    initialSpecialTrainingStatus: string | null;
    releaseAt: string | number | null;
    archivePublishedAt: string | number | null;
  };

  type CardListViewMode = "grid" | "agenda" | "comfy";
  type CardImageKind = "small" | "thumbnail";

  let {
    href,
    region,
    item,
    viewMode,
    idLabel,
    spoilerContentLabel,
    cardListCharacterFallback,
    cardListReleaseLabel,
    cardImageAltSuffix,
    displayLocale
  }: {
    href: string;
    region: SupportedRegion;
    item: CardListCardItem;
    viewMode: CardListViewMode;
    idLabel: string;
    spoilerContentLabel: string;
    cardListCharacterFallback: string;
    cardListReleaseLabel: string;
    cardImageAltSuffix: string;
    displayLocale: string;
  } = $props();

  const contentDisplaySettings = getContentDisplaySettings();
  const spoilerRevealAnimationMs = 180;
  let spoilerRevealed = $state(false);
  let spoilerRevealAnimating = $state(false);
  let lastSpoilerIdentity = $state("");
  let spoilerRevealTimeout: ReturnType<typeof setTimeout> | null = null;
  let visibleImageKeys = $state<Record<string, boolean>>({});
  let gridContentNode: HTMLDivElement | null = $state(null);

  const rarityValueByType: Record<string, number> = {
    rarity_1: 1,
    rarity_2: 2,
    rarity_3: 3,
    rarity_4: 4,
    rarity_birthday: 1
  };

  const isTrainableCard = (): boolean =>
    item.rarityType === "rarity_3" || item.rarityType === "rarity_4";
  const isTrainedOnlyCard = (): boolean =>
    item.initialSpecialTrainingStatus === "done" && isTrainableCard();
  const hasSingleCardArtwork = (): boolean =>
    Boolean(item.assetBundleName) && (!isTrainableCard() || isTrainedOnlyCard());
  const getReleaseAt = (): string | number | null => item.releaseAt ?? item.archivePublishedAt;
  const getCardTitle = (): string => item.prefix;
  const getCharacterLabel = (): string =>
    item.characterName ??
    (item.characterId !== null
      ? `${cardListCharacterFallback} ${item.characterId}`
      : cardListCharacterFallback);
  const getRarityValue = (): number =>
    item.rarityType ? (rarityValueByType[item.rarityType] ?? 0) : 0;
  const getRarityFrameLevel = (): string | null => {
    if (item.rarityType === "rarity_birthday") {
      return "bd";
    }

    const rarityValue = getRarityValue();
    return rarityValue > 0 ? String(rarityValue) : null;
  };
  const getAttrIconUrl = (size: 64 | 88 = 64): string | null =>
    item.attr ? asset(`/card_attr/icon_attribute_${item.attr}_${size}.png`) : null;
  const getCardFrameUrl = (size: "L" | "S"): string | null => {
    const rarityFrameLevel = getRarityFrameLevel();
    return rarityFrameLevel ? asset(`/card_frame/cardFrame_${size}_${rarityFrameLevel}.png`) : null;
  };
  const getRarityIconUrl = (trained: boolean): string | null => {
    if (item.rarityType === "rarity_birthday") {
      return asset("/card_rarity/rarity_birthday.png");
    }

    if (getRarityValue() <= 0) {
      return null;
    }

    return asset(
      trained ? "/card_rarity/rarity_star_afterTraining.png" : "/card_rarity/rarity_star_normal.png"
    );
  };
  const hasSpoiler = (): boolean => {
    const releaseAtMs = toTimestampMs(getReleaseAt());
    return releaseAtMs !== null && releaseAtMs > Date.now();
  };

  const isSpoilerContentMosaicked = (): boolean =>
    hasSpoiler() && contentDisplaySettings.mosaickedSpoilerContent && !spoilerRevealed;

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
    visibleImageKeys = {};

    return clearSpoilerRevealTimeout;
  });

  const revealSpoiler = (): void => {
    if (!isSpoilerContentMosaicked()) {
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

  const hasModifier = (event: MouseEvent | KeyboardEvent): boolean =>
    event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

  const handleCardClick = (event: MouseEvent): void => {
    if (
      !isSpoilerContentMosaicked() ||
      hasModifier(event) ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    revealSpoiler();
  };

  const handleCardKeydown = (event: KeyboardEvent): void => {
    if (hasModifier(event)) {
      return;
    }

    if (event.key === "Enter") {
      if (!isSpoilerContentMosaicked()) {
        return;
      }

      event.preventDefault();
      if (!event.repeat) {
        revealSpoiler();
      }
      return;
    }

    if (event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (isSpoilerContentMosaicked()) {
      if (!event.repeat) {
        revealSpoiler();
      }
      return;
    }

    if (!event.repeat) {
      void goto(href);
    }
  };

  const getPrimaryCardAssetRegion = (): SupportedRegion => "jp";
  const getFallbackCardAssetRegion = (): SupportedRegion | null =>
    region === "jp" ? null : region;

  const getSmallImageUrl = (
    trained: boolean,
    assetRegion = getPrimaryCardAssetRegion()
  ): string | null =>
    item.assetBundleName ? getCardSmallAssetURL(item.assetBundleName, trained, assetRegion) : null;

  const getThumbnailImageUrl = (
    trained: boolean,
    assetRegion = getPrimaryCardAssetRegion()
  ): string | null =>
    item.assetBundleName
      ? getCardThumbnailAssetURL(item.assetBundleName, trained, assetRegion)
      : null;

  const getFallbackImageUrl = (kind: CardImageKind, trained: boolean): string | null => {
    const fallbackRegion = getFallbackCardAssetRegion();
    if (!fallbackRegion) {
      return null;
    }

    return kind === "small"
      ? getSmallImageUrl(trained, fallbackRegion)
      : getThumbnailImageUrl(trained, fallbackRegion);
  };

  const markImageVisible = (key: string): void => {
    if (visibleImageKeys[key]) {
      return;
    }

    visibleImageKeys = { ...visibleImageKeys, [key]: true };
  };

  $effect(() => {
    if (visibleImageKeys.grid || !gridContentNode) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      markImageVisible("grid");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          markImageVisible("grid");
          observer.disconnect();
        }
      },
      { threshold: 0.01 }
    );

    observer.observe(gridContentNode);

    return () => {
      observer.disconnect();
    };
  });
</script>

{#snippet spoilerOverlay()}
  <div
    class={`event-list-spoiler-mosaic-overlay flex size-full flex-col items-center justify-center gap-3 px-6 text-center backdrop-blur-2xl transition-opacity duration-180 ease-out ${spoilerRevealAnimating ? "opacity-0" : "opacity-100"}`}
  >
    <span
      class="flex size-9 items-center justify-center rounded-full border-2 border-error/70 text-2xl font-black leading-none text-error"
      aria-hidden="true"
    >
      !
    </span>
    <span class="text-sm font-semibold tracking-[0.12em] text-error">{spoilerContentLabel}</span>
  </div>
{/snippet}

{#snippet cardFrame(size: "L" | "S", visible: boolean)}
  {@const frameUrl = getCardFrameUrl(size)}
  {#if frameUrl && visible}
    <img
      src={frameUrl}
      alt=""
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 z-10 size-full object-fill"
      loading="lazy"
      decoding="async"
    />
  {/if}
{/snippet}

{#snippet largeIcons()}
  {@const attrIconUrl = getAttrIconUrl()}
  {@const normalRarityIconUrl = getRarityIconUrl(false)}
  {@const trainedRarityIconUrl = getRarityIconUrl(true)}
  {@const rarityCount = item.rarityType === "rarity_birthday" ? 1 : getRarityValue()}
  <svg
    class="pointer-events-none absolute inset-0 z-20 size-full"
    viewBox="0 0 160 90"
    aria-hidden="true"
  >
    {#if attrIconUrl}
      <image href={attrIconUrl} x="0" y="0" width="21" height="21" class="drop-shadow" />
    {/if}
    {#if normalRarityIconUrl && rarityCount > 0}
      <g class={isTrainableCard() ? "card-grid-rarity-stack card-grid-rarity-stack-left" : ""}>
        {#each Array.from(Array(rarityCount).keys()) as index (`rarity-large-normal-${index}`)}
          <image
            href={normalRarityIconUrl}
            x="5"
            y={71 - index * 13}
            width="14"
            height="14"
            class="drop-shadow"
          />
        {/each}
      </g>
    {/if}
    {#if isTrainableCard() && trainedRarityIconUrl && rarityCount > 0}
      <g class="card-grid-rarity-stack card-grid-rarity-stack-right">
        {#each Array.from(Array(rarityCount).keys()) as index (`rarity-large-trained-${index}`)}
          <image
            href={trainedRarityIconUrl}
            x="141"
            y={71 - index * 13}
            width="14"
            height="14"
            class="drop-shadow"
          />
        {/each}
      </g>
    {/if}
  </svg>
{/snippet}

{#snippet metaBadges(stackSupportUnit = false)}
  <div class="flex flex-wrap items-center gap-1.5">
    <span class="badge badge-sm border-none bg-base-200 font-semibold text-base-content">
      {idLabel}{item.id}
    </span>
    {#if item.unit}
      {#if item.characterId !== null}
        <CharacterAvatar
          src={getLocalCharacterThumbnailAssetURL(item.characterId)}
          label={getCharacterLabel()}
          characterId={item.characterId}
          variant="xs"
          class="bg-white"
          decorative
        />
      {/if}
      {#if stackSupportUnit && item.unit === "piapro" && item.supportUnit && item.supportUnit !== "none"}
        <span class="relative inline-flex shrink-0" aria-hidden="true">
          <UnitIconBadge unit={item.unit} variant="sm" />
          <UnitIconBadge
            unit={item.supportUnit}
            variant="sm"
            class="absolute -bottom-1 -right-3 scale-75 shadow-sm ring-1 ring-base-100"
          />
        </span>
      {:else}
        <UnitIconBadge unit={item.unit} variant="sm" />
      {/if}
    {/if}
    {#if !stackSupportUnit && item.unit === "piapro" && item.supportUnit && item.supportUnit !== "none"}
      <UnitIconBadge unit={item.supportUnit} variant="sm" />
    {/if}
  </div>
{/snippet}

{#snippet thumbImage(trained: boolean)}
  {@const thumbUrl = getThumbnailImageUrl(trained)}
  {@const fallbackUrl = getFallbackImageUrl("thumbnail", trained)}
  <CardThumbnail
    src={thumbUrl}
    fallbackSrc={fallbackUrl}
    alt={`${getCardTitle()} ${cardImageAltSuffix}`}
    fallbackLabel=""
    {trained}
    attr={item.attr}
    rarityType={item.rarityType}
    rarityCount={item.rarityType === "rarity_birthday" ? 1 : getRarityValue()}
    showFrame={true}
    showIcons={true}
    loadMode="visible"
    maxSize={160}
    containerClass="relative overflow-hidden rounded-xl bg-base-200 aspect-square"
    imageClass="size-full object-cover"
  />
{/snippet}

{#snippet placedThumbImage(trained: boolean)}
  {#if hasSingleCardArtwork()}
    <div class="col-span-2 grid grid-cols-2 gap-2">
      <div class="col-start-1 translate-x-[calc(50%+var(--spacing))]">
        {@render thumbImage(trained)}
      </div>
    </div>
  {:else}
    {@render thumbImage(trained)}
  {/if}
{/snippet}

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a
  {href}
  class="relative isolate block w-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
  aria-label={`${item.prefix} ${idLabel}${item.id}`}
  onclick={handleCardClick}
  onkeydown={handleCardKeydown}
>
  <article
    class={`card-hover-lift card content-card-shell relative overflow-hidden shadow-sm ${viewMode === "agenda" ? "min-h-34" : ""}`}
  >
    {#if isSpoilerPlaceholderVisible()}
      <div
        class={viewMode === "grid" ? "aspect-video bg-base-200/60" : "min-h-32 bg-base-200/60"}
      ></div>
      <div class="card-body gap-2 p-3 sm:p-4">
        <div class="h-5 w-3/4 rounded bg-base-200/70"></div>
        <div class="h-4 w-1/3 rounded bg-base-200/70"></div>
      </div>
      <div class="absolute inset-0 z-20">
        {@render spoilerOverlay()}
      </div>
    {:else if viewMode === "agenda"}
      <div class="grid grid-cols-[9rem_1fr] gap-4 p-3 sm:grid-cols-[12rem_1fr]">
        <div class="grid grid-cols-2 gap-2 self-center">
          {#if !isTrainedOnlyCard()}
            {@render placedThumbImage(false)}
          {/if}
          {#if isTrainableCard()}
            {@render placedThumbImage(true)}
          {/if}
        </div>
        <div class="flex min-w-0 flex-col justify-center gap-2">
          {@render metaBadges()}
          <h2 class="line-clamp-2 text-base/snug font-semibold">{getCardTitle()}</h2>
          <p class="truncate text-sm opacity-70">{getCharacterLabel()}</p>
          {#if getReleaseAt() !== null}
            <p class="text-xs opacity-55">
              {cardListReleaseLabel}: {formatDisplayDateTime(getReleaseAt(), displayLocale)}
            </p>
          {/if}
        </div>
      </div>
    {:else if viewMode === "comfy"}
      <div class="card-body items-center gap-3 p-3 sm:p-4 text-center">
        <div class="grid w-full max-w-34 grid-cols-2 gap-2">
          {#if !isTrainedOnlyCard()}
            {@render placedThumbImage(false)}
          {/if}
          {#if isTrainableCard()}
            {@render placedThumbImage(true)}
          {/if}
        </div>
        {@render metaBadges(true)}
        <h2 class="line-clamp-2 text-sm/snug font-semibold">{getCardTitle()}</h2>
        <p class="line-clamp-1 text-xs opacity-70">{getCharacterLabel()}</p>
      </div>
    {:else}
      {@const normalUrl = getSmallImageUrl(false)}
      {@const trainedUrl = getSmallImageUrl(true)}
      <div class="card-grid-stage">
        {#if isTrainableCard() && normalUrl && trainedUrl && !isTrainedOnlyCard()}
          <div class="card-grid-hover-area card-grid-hover-area-left"></div>
          <div class="card-grid-hover-area card-grid-hover-area-right"></div>
        {/if}
        <div class="card-grid-content" bind:this={gridContentNode}>
          <div class="card-grid-image-container">
            {#if isTrainedOnlyCard() && trainedUrl && visibleImageKeys.grid === true}
              <CardGridImage
                src={trainedUrl}
                fallbackSrc={getFallbackImageUrl("small", true)}
                alt={`${getCardTitle()} ${cardImageAltSuffix}`}
                class="card-grid-single-image"
                loading="lazy"
                decoding="async"
              />
            {:else if isTrainableCard() && trainedUrl && normalUrl && visibleImageKeys.grid === true}
              <div class="card-grid-split-stage">
                <div class="card-grid-split-wrapper card-grid-split-wrapper-left">
                  <CardGridImage
                    src={normalUrl}
                    fallbackSrc={getFallbackImageUrl("small", false)}
                    alt={`${getCardTitle()} ${cardImageAltSuffix}`}
                    class="card-grid-split-image card-grid-split-image-left"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div class="card-grid-split-wrapper card-grid-split-wrapper-right">
                  <CardGridImage
                    src={trainedUrl}
                    fallbackSrc={getFallbackImageUrl("small", true)}
                    alt={`${getCardTitle()} ${cardImageAltSuffix}`}
                    class="card-grid-split-image card-grid-split-image-right"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            {:else if normalUrl && visibleImageKeys.grid === true}
              <CardGridImage
                src={normalUrl}
                fallbackSrc={getFallbackImageUrl("small", false)}
                alt={`${getCardTitle()} ${cardImageAltSuffix}`}
                class="card-grid-single-image"
                loading="lazy"
                decoding="async"
              />
            {:else}
              <div
                class="flex size-full items-center justify-center px-6 text-center text-sm opacity-70"
              >
                {getCardTitle()}
              </div>
            {/if}
          </div>
          {@render cardFrame("L", visibleImageKeys.grid === true)}
          {#if visibleImageKeys.grid === true}
            {@render largeIcons()}
          {/if}
        </div>
      </div>
      <div class="card-body gap-1.5 p-3 sm:p-4">
        <h2 class="line-clamp-2 text-base/snug font-semibold">{getCardTitle()}</h2>
        {@render metaBadges()}
        <p class="truncate text-sm opacity-70">{getCharacterLabel()}</p>
      </div>
    {/if}
  </article>
</a>

<style>
  .card-grid-stage {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: color-mix(in oklab, var(--color-base-200) 86%, var(--color-base-100));
  }

  .card-grid-content {
    position: absolute;
    inset: 0;
  }

  .card-grid-image-container {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .card-grid-image-container :global(.card-grid-single-image) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-grid-split-stage {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .card-grid-split-wrapper {
    position: absolute;
    top: 0;
    height: 100%;
    overflow: hidden;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card-grid-split-wrapper-left {
    left: 0;
    width: 50%;
  }

  .card-grid-split-wrapper-right {
    right: 0;
    width: 50%;
  }

  .card-grid-image-container :global(.card-grid-split-image) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-grid-image-container :global(.card-grid-split-image-left),
  .card-grid-image-container :global(.card-grid-split-image-right) {
    object-position: center;
  }

  .card-grid-hover-area {
    position: absolute;
    top: 0;
    width: 50%;
    height: 100%;
    z-index: 5;
  }

  .card-grid-hover-area-left {
    left: 0;
  }

  .card-grid-hover-area-right {
    right: 0;
  }

  .card-grid-rarity-stack {
    transition: opacity 0.2s ease-out;
  }

  .card-grid-hover-area-left:hover ~ .card-grid-content .card-grid-split-wrapper-left {
    width: 100%;
  }

  .card-grid-hover-area-left:hover ~ .card-grid-content .card-grid-split-wrapper-right {
    width: 0;
  }

  .card-grid-hover-area-left:hover ~ .card-grid-content .card-grid-rarity-stack-right {
    opacity: 0;
  }

  .card-grid-hover-area-right:hover ~ .card-grid-content .card-grid-split-wrapper-left {
    width: 0;
  }

  .card-grid-hover-area-right:hover ~ .card-grid-content .card-grid-split-wrapper-right {
    width: 100%;
  }

  .card-grid-hover-area-right:hover ~ .card-grid-content .card-grid-rarity-stack-left {
    opacity: 0;
  }
</style>
