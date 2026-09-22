<script lang="ts">
  import { buildHonorDegreeLayout } from "./honor-degree";
  import type { HonorDegreeProps } from "./honor-degree.types";

  const componentId = $props.id();
  let {
    honor = null,
    resolveAsset,
    slot = "main",
    size = "L",
    label = "Honor",
    title,
    decorative = false,
    class: className = ""
  }: HonorDegreeProps = $props();

  const layout = $derived(buildHonorDegreeLayout(honor, resolveAsset, slot, size));
  const accessibleLabel = $derived(label.trim() || "Honor");
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  class={className}
  viewBox={`0 0 ${layout.width} ${layout.height}`}
  width={layout.width}
  height={layout.height}
  style={`width:${Math.round(layout.width * layout.scale)}px;height:${Math.round(layout.height * layout.scale)}px;flex-shrink:0;vertical-align:middle`}
  role={decorative ? undefined : "img"}
  aria-label={decorative ? undefined : accessibleLabel}
  aria-hidden={decorative ? "true" : undefined}
  focusable="false"
>
  {#if !decorative}<title>{title?.trim() || accessibleLabel}</title>{/if}
  {#if layout.layers.length > 0}
    <g
      transform={layout.reverse ? `translate(${layout.width},0) scale(-1,1)` : undefined}
      aria-hidden="true"
    >
      {#if layout.layers.some((layer) => layer.mask)}
        <defs>
          {#each layout.layers as layer (layer.name)}
            {#if layer.mask}
              <mask
                id={`${componentId}-${layer.name}-mask`}
                maskUnits="userSpaceOnUse"
                maskContentUnits="userSpaceOnUse"
                {...{ "mask-type": "alpha" }}
                x={layer.mask.x}
                y={layer.mask.y}
                width={layer.mask.width}
                height={layer.mask.height}
              >
                <image
                  data-mask-for={layer.name}
                  href={layer.mask.href}
                  x={layer.mask.x}
                  y={layer.mask.y}
                  width={layer.mask.width}
                  height={layer.mask.height}
                  preserveAspectRatio="none"
                />
              </mask>
            {/if}
          {/each}
        </defs>
      {/if}
      {#each layout.layers as layer (layer.name)}
        <image
          data-layer={layer.name}
          href={layer.href}
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
          mask={layer.mask ? `url(#${componentId}-${layer.name}-mask)` : undefined}
          preserveAspectRatio="none"
        />
      {/each}
    </g>
  {:else}
    <text
      x={layout.width / 2}
      y="40"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="currentColor"
      aria-hidden="true">{accessibleLabel}</text
    >
  {/if}
</svg>
