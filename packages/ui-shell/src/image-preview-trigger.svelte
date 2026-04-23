<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Snippet } from "svelte";

  type Props = {
    src: string;
    alt?: string;
    fallbackLabel?: string;
    ariaLabel?: string;
    buttonClass?: string;
    imageClass?: string;
    disabled?: boolean;
    onclick?: () => void;
    children?: Snippet;
  };

  let {
    src,
    alt = "",
    fallbackLabel = "",
    ariaLabel = "",
    buttonClass = "block w-full cursor-zoom-in",
    imageClass = "h-auto max-h-full w-full object-contain",
    disabled = false,
    onclick,
    children
  }: Props = $props();

  let previewImageLoaded = $state(false);
  let previewImageFailed = $state(false);

  $effect(() => {
    if (src !== undefined) {
      previewImageLoaded = false;
      previewImageFailed = false;
    }
  });
</script>

<button
  type="button"
  class={`${buttonClass} ${disabled || previewImageFailed ? "cursor-default" : ""}`}
  onclick={onclick}
  aria-label={previewImageFailed && fallbackLabel ? fallbackLabel : ariaLabel || alt}
  disabled={disabled || previewImageFailed}
>
  {#if children}
    {@render children()}
  {:else}
    <div class="relative h-full w-full overflow-hidden">
      {#if !previewImageLoaded && !previewImageFailed}
        <div class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse">
          <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"></span>
        </div>
      {/if}
      {#if previewImageFailed}
        <div class="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65">
          <Icon icon="mdi:file-remove-outline" class="h-10 w-10 opacity-75" aria-hidden="true" />
          {#if fallbackLabel}
            <span class="font-medium">{fallbackLabel}</span>
          {/if}
        </div>
      {/if}
      <img
        src={src}
        alt={alt}
        class={`${imageClass} transition-all duration-300 ease-out ${previewImageLoaded && !previewImageFailed ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"} ${previewImageFailed ? "pointer-events-none sr-only" : ""}`}
        onload={() => {
          previewImageLoaded = true;
          previewImageFailed = false;
        }}
        onerror={() => {
          previewImageLoaded = true;
          previewImageFailed = true;
        }}
      />
    </div>
  {/if}
</button>
