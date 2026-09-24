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
    stretchedLinkLabel,
    children
  }: {
    id?: string;
    href: string;
    frameClass: string;
    useBody?: boolean;
    bodyClass?: string;
    overlay?: Snippet;
    onclick?: (event: MouseEvent) => void;
    /**
     * When set, the frame renders as an <article> with an invisible link that
     * covers the card, so the body can hold its own interactive controls
     * (marked `pointer-events-auto`) without nesting them inside the link.
     */
    stretchedLinkLabel?: string;
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

{#snippet surface()}
  <div class={resolvedSurfaceClass}>
    {#if stretchedLinkLabel !== undefined}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a
        {href}
        class="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={stretchedLinkLabel}
        {onclick}
      ></a>
    {/if}
    {#if useBody}
      <div class={`${bodyClass} ${stretchedLinkLabel !== undefined ? "pointer-events-none" : ""}`}>
        {@render children?.()}
      </div>
    {:else}
      <div class={`relative z-10 ${stretchedLinkLabel !== undefined ? "pointer-events-none" : ""}`}>
        {@render children?.()}
      </div>
    {/if}
    {#if overlay}
      <div class="absolute inset-0 z-30">
        {@render overlay()}
      </div>
    {/if}
  </div>
{/snippet}

{#if stretchedLinkLabel !== undefined}
  <article {id} class={resolvedAnchorClass}>
    {@render surface()}
  </article>
{:else}
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a {id} {href} class={resolvedAnchorClass} {onclick}>
    {@render surface()}
  </a>
{/if}
