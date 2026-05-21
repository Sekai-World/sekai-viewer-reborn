<script lang="ts">
  import Icon from "@iconify/svelte";
  import { ImagePreviewTrigger } from "@platform/ui-shell";

  let {
    src,
    alt = "",
    fallbackLabel = "",
    imageClass = "h-full w-full object-contain",
    buttonClass = "block w-full overflow-hidden",
    interactive = false,
    onclick
  }: {
    src: string;
    alt?: string;
    fallbackLabel?: string;
    imageClass?: string;
    buttonClass?: string;
    interactive?: boolean;
    onclick?: () => void;
  } = $props();

  let previewImageLoaded = $state(false);
  let previewImageFailed = $state(false);

  $effect(() => {
    if (src !== undefined) {
      previewImageLoaded = false;
      previewImageFailed = false;
    }
  });
</script>

{#if interactive}
  <ImagePreviewTrigger
    {src}
    {alt}
    {fallbackLabel}
    ariaLabel={alt || fallbackLabel}
    {buttonClass}
    {imageClass}
    {onclick}
  />
{:else}
  <div class={buttonClass}>
    <div class="relative h-full w-full overflow-hidden">
      {#if !previewImageLoaded && !previewImageFailed}
        <div
          class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse"
        >
          <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"
          ></span>
        </div>
      {/if}
      {#if previewImageFailed}
        <div
          class="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
        >
          <Icon icon="mdi:file-remove-outline" class="h-10 w-10 opacity-75" aria-hidden="true" />
          {#if fallbackLabel}
            <span class="font-medium">{fallbackLabel}</span>
          {/if}
        </div>
      {/if}
      <img
        {src}
        {alt}
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
  </div>
{/if}
