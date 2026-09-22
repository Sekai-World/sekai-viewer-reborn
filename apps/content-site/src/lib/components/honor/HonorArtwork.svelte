<script lang="ts">
  import { HonorDegree, type HonorDegreeAssetResolver } from "@platform/ui-shell";
  import type { CatalogueHonorDegree } from "$lib/honor-degree";
  let {
    degree,
    resolveAsset,
    label,
    imageUnavailableLabel,
    decorative = false
  }: {
    degree: CatalogueHonorDegree;
    resolveAsset: HonorDegreeAssetResolver;
    label: string;
    imageUnavailableLabel: string;
    decorative?: boolean;
  } = $props();
  let visible = $state(false);
  let narrow = $state(false);
  let failedDegree = $state.raw<CatalogueHonorDegree | null>(null);
  const honor = $derived(narrow ? degree.sub : degree.main);
  function observe(node: HTMLDivElement) {
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(([entry]) => {
            narrow = entry.contentRect.width < 266;
          });
    resize?.observe(node);
    const intersection =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              visible = true;
              intersection?.disconnect();
            }
          });
    if (intersection) intersection.observe(node);
    else visible = true;
    const onError = (event: Event) => {
      if (event.target instanceof SVGElement && event.target.tagName === "image")
        failedDegree = degree;
    };
    node.addEventListener("error", onError, true);
    return {
      destroy() {
        resize?.disconnect();
        intersection?.disconnect();
        node.removeEventListener("error", onError, true);
      }
    };
  }
</script>

<div use:observe class="flex h-14 w-full max-w-67 items-center overflow-hidden">
  {#if honor.kind === "empty" || failedDegree === degree}
    <span class="text-sm text-(--archive-text-muted)">{imageUnavailableLabel}</span>
  {:else if visible}
    {#key degree}
      <svelte:boundary>
        <HonorDegree
          {honor}
          {resolveAsset}
          slot={narrow ? "sub1" : "main"}
          size="S"
          {label}
          {decorative}
        />
        {#snippet failed()}
          <span class="text-sm text-(--archive-text-muted)">{imageUnavailableLabel}</span>
        {/snippet}
      </svelte:boundary>
    {/key}
  {/if}
</div>
