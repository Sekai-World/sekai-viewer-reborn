<script lang="ts">
  import Icon from "@iconify/svelte";
  import { ImagePreviewTrigger } from "@platform/ui-shell";

  let {
    src,
    fallbackSrc,
    alt = "",
    fallbackLabel = "",
    imageClass = "h-full w-full object-contain",
    buttonClass = "block w-full overflow-hidden",
    loadMode = "immediate",
    interactive = false,
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
    onclick?: () => void;
  } = $props();

  let previewImageLoaded = $state(false);
  let previewImageFailed = $state(false);
  let fallbackApplied = $state(false);
  let imageVisible = $state(false);
  let observedNode: HTMLDivElement | null = $state(null);
  const currentSrc = $derived(fallbackApplied && fallbackSrc ? fallbackSrc : src);
  const shouldRenderImage = $derived(loadMode === "immediate" || imageVisible);

  const interactiveButtonClass = $derived(
    interactive ? `${buttonClass} cursor-zoom-in` : buttonClass
  );

  $effect(() => {
    const sourceSet = { primary: src, fallback: fallbackSrc };
    void sourceSet;
    fallbackApplied = false;
    previewImageLoaded = false;
    previewImageFailed = false;
    imageVisible = loadMode === "immediate";
  });

  const handleImageError = (): void => {
    if (!fallbackApplied && fallbackSrc && fallbackSrc !== currentSrc) {
      fallbackApplied = true;
      previewImageLoaded = false;
      previewImageFailed = false;
      return;
    }

    previewImageLoaded = true;
    previewImageFailed = true;
  };

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
    {alt}
    {fallbackLabel}
    ariaLabel={alt || fallbackLabel}
    buttonClass={interactiveButtonClass}
    {imageClass}
    {onclick}
  />
{:else}
  <div class={buttonClass}>
    <div class="relative size-full overflow-hidden" bind:this={observedNode}>
      {#if !shouldRenderImage || (!previewImageLoaded && !previewImageFailed)}
        <div
          class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse"
        >
          <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"
          ></span>
        </div>
      {/if}
      {#if previewImageFailed}
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
        <img
          src={currentSrc}
          {alt}
          loading="eager"
          decoding="async"
          class={`${imageClass} transition-[opacity,transform] duration-300 ease-out ${previewImageLoaded && !previewImageFailed ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"} ${previewImageFailed ? "pointer-events-none sr-only" : ""}`}
          onload={() => {
            previewImageLoaded = true;
            previewImageFailed = false;
          }}
          onerror={handleImageError}
        />
      {/if}
    </div>
  </div>
{/if}
