<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onDestroy, untrack } from "svelte";
  import type { Snippet } from "svelte";
  import {
    ImageRetryController,
    STATIC_ASSET_RETRY_POLICY,
    type ImageRetryPolicy
  } from "./image-retry/index";

  type Props = {
    src: string;
    fallbackSrc?: string;
    alt?: string;
    fallbackLabel?: string;
    ariaLabel?: string;
    buttonClass?: string;
    imageClass?: string;
    retryPolicy?: ImageRetryPolicy;
    disabled?: boolean;
    onclick?: () => void;
    children?: Snippet;
  };

  let {
    src,
    fallbackSrc,
    alt = "",
    fallbackLabel = "",
    ariaLabel = "",
    buttonClass = "block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    imageClass = "h-auto max-h-full w-full object-contain",
    retryPolicy = STATIC_ASSET_RETRY_POLICY,
    disabled = false,
    onclick,
    children
  }: Props = $props();

  // Seed the controller for the initial render without making construction the
  // source of reactivity; the pre-effect keeps it synchronized thereafter.
  const imageRetry = untrack(() => new ImageRetryController(src, fallbackSrc, retryPolicy));

  $effect.pre(() => {
    imageRetry.setSources(src, fallbackSrc, retryPolicy);
  });

  onDestroy(() => imageRetry.dispose());
</script>

<button
  type="button"
  class={`${buttonClass} ${disabled || imageRetry.imageFailed ? "cursor-default" : ""}`}
  {onclick}
  aria-label={imageRetry.imageFailed && fallbackLabel ? fallbackLabel : ariaLabel || alt}
  disabled={disabled || imageRetry.imageFailed}
>
  {#if children}
    {@render children()}
  {:else if !imageRetry.imageFailed}
    <div class="group relative size-full overflow-hidden">
      {#if !imageRetry.imageLoaded}
        <div
          class="image-preview-loading absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse"
        >
          <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"
          ></span>
        </div>
      {/if}
      {#key imageRetry.requestKey}
        {@const requestSnapshot = imageRetry.requestSnapshot}
        <img
          src={imageRetry.requestUrl}
          {alt}
          class={`${imageClass} transition-[opacity,transform] duration-300 ease-out ${imageRetry.imageLoaded ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"}`}
          onload={() => requestSnapshot && imageRetry.handleImageLoad(requestSnapshot)}
          onerror={() => requestSnapshot && imageRetry.handleImageError(requestSnapshot)}
        />
      {/key}
      {#if imageRetry.imageLoaded}
        <!-- magnifying glass overlay — bottom-right -->
        <span
          class="pointer-events-none absolute right-3 bottom-3 flex size-10 items-center justify-center rounded-full bg-base-100/60 text-base-content/70 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:opacity-0"
          aria-hidden="true"
        >
          <Icon icon="mdi:magnify-plus-outline" class="size-5" />
        </span>
      {/if}
    </div>
  {:else}
    <div
      class="flex size-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
    >
      <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
      {#if fallbackLabel}
        <span class="font-medium">{fallbackLabel}</span>
      {/if}
    </div>
  {/if}
</button>
