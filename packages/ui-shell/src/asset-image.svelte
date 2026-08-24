<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onDestroy } from "svelte";
  import ImagePreviewTrigger from "./image-preview-trigger.svelte";
  import { ImageRetryController, STATIC_ASSET_RETRY_POLICY, type ImageRetryPolicy } from "./image-retry/index";

  let {
    src, fallbackSrc, alt = "", fallbackLabel = "", imageClass = "h-full w-full object-contain",
    buttonClass = "block w-full overflow-hidden", loadMode = "immediate", interactive = false,
    retryPolicy = STATIC_ASSET_RETRY_POLICY, onclick
  }: {
    src: string; fallbackSrc?: string; alt?: string; fallbackLabel?: string; imageClass?: string;
    buttonClass?: string; loadMode?: "immediate" | "visible"; interactive?: boolean;
    retryPolicy?: ImageRetryPolicy; onclick?: () => void;
  } = $props();

  let imageVisible = $state(false);
  let observedNode = $state<HTMLDivElement | null>(null);
  let previousSourceKey: string | null = null;
  // Props are applied by the effect below rather than captured as constructor state.
  const imageRetry = new ImageRetryController("", undefined, STATIC_ASSET_RETRY_POLICY);
  const shouldRenderImage = $derived(loadMode === "immediate" || imageVisible);

  $effect.pre(() => {
    const sourceKey = `${src}\0${fallbackSrc ?? ""}\0${loadMode}`;
    if (previousSourceKey !== null && previousSourceKey !== sourceKey) {
      imageVisible = loadMode === "immediate";
    }
    previousSourceKey = sourceKey;
    imageRetry.setSources(src, fallbackSrc, retryPolicy);
  });
  onDestroy(() => imageRetry.dispose());
  $effect(() => {
    if (loadMode !== "visible" || imageVisible || !observedNode) return;
    if (typeof IntersectionObserver === "undefined") { imageVisible = true; return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { imageVisible = true; observer.disconnect(); }
    }, { threshold: 0.01 });
    observer.observe(observedNode);
    return () => observer.disconnect();
  });
</script>

{#if interactive}
  {#if shouldRenderImage}
    <ImagePreviewTrigger {src} {fallbackSrc} {alt} {fallbackLabel} ariaLabel={alt || fallbackLabel} {buttonClass} {imageClass} {retryPolicy} {onclick} />
  {:else}
    <div class={buttonClass} bind:this={observedNode}>
      <div class="relative size-full overflow-hidden">
        <div class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse" aria-hidden="true"><span class="loading loading-spinner loading-md text-base-content/60"></span></div>
      </div>
    </div>
  {/if}
{:else}
  <div class={buttonClass}>
    <div class="relative size-full overflow-hidden" bind:this={observedNode}>
      {#if !shouldRenderImage || (!imageRetry.imageLoaded && !imageRetry.imageFailed)}
        <div class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse" aria-hidden="true"><span class="loading loading-spinner loading-md text-base-content/60"></span></div>
      {/if}
      {#if imageRetry.imageFailed}
        <div class="flex size-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"><Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />{#if fallbackLabel}<span class="font-medium">{fallbackLabel}</span>{/if}</div>
      {/if}
      {#if shouldRenderImage}
        {#key imageRetry.requestKey}
          {@const requestSnapshot = imageRetry.requestSnapshot}
          <img src={imageRetry.requestUrl} {alt} loading="eager" decoding="async" class={`${imageClass} transition-[opacity,transform] duration-300 ease-out ${imageRetry.imageLoaded && !imageRetry.imageFailed ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"} ${imageRetry.imageFailed ? "pointer-events-none sr-only" : ""}`} onload={() => requestSnapshot && imageRetry.handleImageLoad(requestSnapshot)} onerror={() => requestSnapshot && imageRetry.handleImageError(requestSnapshot)} />
        {/key}
      {/if}
    </div>
  </div>
{/if}
