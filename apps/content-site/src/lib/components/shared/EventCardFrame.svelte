<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import { EVENT_CARD_BODY_CLASS, EVENT_CARD_SURFACE_CLASS } from "$lib/styles/event-card";

  let {
    id,
    href,
    frameClass,
    useBody = true,
    overlay,
    onclick,
    children
  }: {
    id?: string;
    href: string;
    frameClass: string;
    useBody?: boolean;
    overlay?: Snippet;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  } = $props();

  let canHover3d = $state(false);
  const frameClassWithoutHover3d = $derived(
    frameClass
      .split(" ")
      .filter((className) => className !== "hover-3d")
      .join(" ")
  );
  const resolvedFrameClass = $derived(
    canHover3d ? `${frameClassWithoutHover3d} hover-3d` : frameClassWithoutHover3d
  );

  onMount(() => {
    const hoverMediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncHoverCapability = (): void => {
      canHover3d = hoverMediaQuery.matches;
    };

    syncHoverCapability();
    hoverMediaQuery.addEventListener("change", syncHoverCapability);

    return () => hoverMediaQuery.removeEventListener("change", syncHoverCapability);
  });
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {id} {href} class={resolvedFrameClass} {onclick}>
  <div class={EVENT_CARD_SURFACE_CLASS}>
    {#if useBody}
      <div class={EVENT_CARD_BODY_CLASS}>
        {@render children?.()}
      </div>
    {:else}
      <div class="relative z-10">
        {@render children?.()}
      </div>
    {/if}
    {#if overlay}
      <div class="absolute inset-0 z-30">
        {@render overlay()}
      </div>
    {/if}
  </div>
  <div></div>
  <div></div>
  <div></div>
  <div></div>
  <div></div>
  <div></div>
  <div></div>
  <div></div>
</a>
