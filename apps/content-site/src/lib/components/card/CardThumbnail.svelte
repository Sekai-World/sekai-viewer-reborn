<script lang="ts">
  import { asset } from "$app/paths";
  import Icon from "@iconify/svelte";

  let {
    src,
    alt,
    fallbackLabel = "",
    fallbackSrc = null,
    trained = false,
    attr = null,
    rarityType = null,
    rarityCount = 0,
    loadMode = "visible",
    showFrame = true,
    showIcons = true,
    maxSize = 160,
    containerClass = "relative overflow-hidden rounded-xl bg-base-200 aspect-square",
    imageClass = "size-full object-cover"
  }: {
    src: string | null;
    alt: string;
    fallbackLabel?: string;
    fallbackSrc?: string | null;
    trained?: boolean;
    attr?: string | null;
    rarityType?: string | null;
    rarityCount?: number;
    loadMode?: "immediate" | "visible";
    showFrame?: boolean;
    showIcons?: boolean;
    maxSize?: number | null;
    containerClass?: string;
    imageClass?: string;
  } = $props();

  let imageLoaded = $state(false);
  let imageFailed = $state(false);
  let imageVisible = $state(false);
  let previousImageStateKey = $state("");
  let observedNode: HTMLDivElement | null = $state(null);
  const shouldRenderImage = $derived(loadMode === "immediate" || imageVisible);
  const resolvedRarityCount = $derived(
    rarityCount > 0 ? rarityCount : rarityType === "rarity_birthday" ? 1 : 0
  );

  $effect(() => {
    const imageStateKey = `${src ?? ""}:${loadMode}`;
    if (imageStateKey === previousImageStateKey) return;

    previousImageStateKey = imageStateKey;
    imageLoaded = false;
    imageFailed = false;
    imageVisible = loadMode === "immediate";
  });

  $effect(() => {
    if (loadMode !== "visible" || imageVisible || !observedNode) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      imageVisible = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          imageVisible = true;
          observer.disconnect();
        }
      },
      { threshold: 0.01 }
    );

    observer.observe(observedNode);

    return () => {
      observer.disconnect();
    };
  });

  const getAttrIconUrl = (size: 64 | 88 = 88): string | null =>
    attr ? asset(`/card_attr/icon_attribute_${attr}_${size}.png`) : null;

  const getRarityIconUrl = (): string | null => {
    if (rarityType === "rarity_birthday") {
      return asset("/card_rarity/rarity_birthday.png");
    }

    if (resolvedRarityCount <= 0) {
      return null;
    }

    return asset(
      trained ? "/card_rarity/rarity_star_afterTraining.png" : "/card_rarity/rarity_star_normal.png"
    );
  };

  const getFrameUrl = (): string | null => {
    if (!showFrame) {
      return null;
    }

    const frameLevel = rarityType === "rarity_birthday" ? "bd" : String(resolvedRarityCount);
    if (frameLevel === "0") {
      return null;
    }

    return asset(`/card_frame/cardFrame_S_${frameLevel}.png`);
  };

  const handleImageError = (event: Event): void => {
    const image = event.currentTarget;
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    if (fallbackSrc && image.dataset.fallbackApplied !== "true") {
      image.dataset.fallbackApplied = "true";
      image.src = fallbackSrc;
      return;
    }

    imageLoaded = true;
    imageFailed = true;
  };
</script>

<div
  class={`relative ${containerClass}`}
  style={maxSize != null ? `max-width:${maxSize}px` : undefined}
  bind:this={observedNode}
>
  {#if !shouldRenderImage || (!imageLoaded && !imageFailed && src)}
    <div
      class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse"
    >
      <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"
      ></span>
    </div>
  {/if}

  {#if !src || imageFailed}
    <div
      class="flex size-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
    >
      <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
      {#if fallbackLabel}
        <span class="font-medium">{fallbackLabel}</span>
      {/if}
    </div>
  {/if}

  {#if shouldRenderImage && src}
    <img
      {src}
      {alt}
      loading={loadMode === "visible" ? "lazy" : "eager"}
      decoding="async"
      class={`${imageClass} transition-[opacity,transform] duration-300 ease-out ${imageLoaded && !imageFailed ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"} ${imageFailed ? "pointer-events-none sr-only" : ""}`}
      onload={() => {
        imageLoaded = true;
        imageFailed = false;
      }}
      onerror={handleImageError}
    />
  {/if}

  {#if showFrame}
    {@const frameUrl = getFrameUrl()}
    {#if frameUrl && shouldRenderImage}
      <img
        src={frameUrl}
        alt=""
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-10 size-full object-fill"
        loading="lazy"
        decoding="async"
      />
    {/if}
  {/if}

  {#if showIcons && shouldRenderImage}
    {@const attrIconUrl = getAttrIconUrl()}
    {@const rarityIconUrl = getRarityIconUrl()}
    <svg
      class="pointer-events-none absolute inset-0 z-20 size-full"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {#if attrIconUrl}
        <image href={attrIconUrl} x="71" y="0" width="29" height="29" class="drop-shadow" />
      {/if}
      {#if rarityIconUrl && resolvedRarityCount > 0}
        {#each Array.from(Array(resolvedRarityCount).keys()) as index (`card-thumbnail-rarity-${trained}-${index}`)}
          <image
            href={rarityIconUrl}
            x={2 + index * 21}
            y="73"
            width="22"
            height="22"
            class="drop-shadow"
          />
        {/each}
      {/if}
    </svg>
  {/if}
</div>
