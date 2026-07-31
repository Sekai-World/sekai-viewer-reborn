<script lang="ts">
  import Icon from "@iconify/svelte";
  import { ImagePreviewTrigger } from "@platform/ui-shell";
  import {
    ImageRetryController,
    STATIC_ASSET_RETRY_POLICY,
    type ImageRetryPolicy
  } from "@platform/ui-shell/image-retry";
  import { onDestroy } from "svelte";

  let {
    src,
    fallbackSrc,
    alt = "",
    fallbackLabel = "",
    imageClass = "h-full w-full object-contain",
    buttonClass = "block w-full overflow-hidden",
    loadMode = "immediate",
    interactive = false,
    retryPolicy = STATIC_ASSET_RETRY_POLICY,
    onclick
  }: {
    src: string;
    fallbackSrc?: string;
    alt?: string;
    fallbackLabel?: string;
    imageClass?: string;
    buttonClass?: string;
    loadMode?: "immediate" | "visible";
    interactive?: boolean;
    retryPolicy?: ImageRetryPolicy;
    onclick?: () => void;
  } = $props();

  let imageVisible = $state(false);
  let observedNode: HTMLDivElement | null = $state(null);
  let previousSourceKey: string | null = null;

  const getInitialRetrySources = (): [string, string | undefined, ImageRetryPolicy] => [
    src,
    fallbackSrc,
    retryPolicy
  ];
  const imageRetry = new ImageRetryController(...getInitialRetrySources());
  const shouldRenderImage = $derived(loadMode === "immediate" || imageVisible);

  const interactiveButtonClass = $derived(
    interactive ? `${buttonClass} cursor-zoom-in` : buttonClass
  );

  $effect.pre(() => {
    const sourceKey = `${src}\0${fallbackSrc ?? ""}\0${loadMode}`;

    if (previousSourceKey === null) {
      previousSourceKey = sourceKey;
    } else if (previousSourceKey !== sourceKey) {
      previousSourceKey = sourceKey;
      imageRetry.reset();
      imageVisible = loadMode === "immediate";
    }

    imageRetry.setSources(src, fallbackSrc, retryPolicy);
  });

  onDestroy(() => imageRetry.dispose());

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
</script>

{#if interactive}
  <ImagePreviewTrigger
    {src}
    {fallbackSrc}
    {alt}
    {fallbackLabel}
    ariaLabel={alt || fallbackLabel}
    buttonClass={interactiveButtonClass}
    {imageClass}
    {retryPolicy}
    {onclick}
  />
{:else}
  <div class={buttonClass}>
    <div class="relative size-full overflow-hidden" bind:this={observedNode}>
      {#if !shouldRenderImage || (!imageRetry.imageLoaded && !imageRetry.imageFailed)}
        <div
          class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse"
        >
          <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"
          ></span>
        </div>
      {/if}
      {#if imageRetry.imageFailed}
        <div
          class="flex size-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
        >
          <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
          {#if fallbackLabel}
            <span class="font-medium">{fallbackLabel}</span>
          {/if}
        </div>
      {/if}
      {#if shouldRenderImage}
        {#key imageRetry.requestKey}
          {@const requestSnapshot = imageRetry.requestSnapshot}
          <img
            src={imageRetry.requestUrl}
            {alt}
            loading="eager"
            decoding="async"
            class={`${imageClass} transition-[opacity,transform] duration-300 ease-out ${imageRetry.imageLoaded && !imageRetry.imageFailed ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"} ${imageRetry.imageFailed ? "pointer-events-none sr-only" : ""}`}
            onload={() => requestSnapshot && imageRetry.handleImageLoad(requestSnapshot)}
            onerror={() => requestSnapshot && imageRetry.handleImageError(requestSnapshot)}
          />
        {/key}
      {/if}
    </div>
  </div>
{/if}
