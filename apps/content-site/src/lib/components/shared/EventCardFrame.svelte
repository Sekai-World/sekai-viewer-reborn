<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import { EVENT_CARD_BODY_CLASS, EVENT_CARD_SURFACE_CLASS } from "$lib/styles/event-card";

  let {
    id,
    href,
    frameClass,
    useBody = true,
    bodyClass = EVENT_CARD_BODY_CLASS,
    overlay,
    onclick,
    children
  }: {
    id?: string;
    href: string;
    frameClass: string;
    useBody?: boolean;
    bodyClass?: string;
    overlay?: Snippet;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  } = $props();

  let canHoverCardLift = $state(false);
  const requestsCardHoverLift = $derived(frameClass.split(" ").includes("card-hover-lift"));
  const frameClassWithoutCardHoverLift = $derived(
    frameClass
      .split(" ")
      .filter((className) => className !== "card-hover-lift")
      .join(" ")
  );
  const resolvedAnchorClass = $derived(frameClassWithoutCardHoverLift);
  const resolvedSurfaceClass = $derived(
    canHoverCardLift && requestsCardHoverLift
      ? `${EVENT_CARD_SURFACE_CLASS} card-hover-lift`
      : EVENT_CARD_SURFACE_CLASS
  );

  onMount(() => {
    const hoverMediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncHoverCapability = (): void => {
      canHoverCardLift = hoverMediaQuery.matches;
    };

    syncHoverCapability();
    hoverMediaQuery.addEventListener("change", syncHoverCapability);

    return () => hoverMediaQuery.removeEventListener("change", syncHoverCapability);
  });
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {id} {href} class={resolvedAnchorClass} {onclick}>
  <div class={resolvedSurfaceClass}>
    {#if useBody}
      <div class={bodyClass}>
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
