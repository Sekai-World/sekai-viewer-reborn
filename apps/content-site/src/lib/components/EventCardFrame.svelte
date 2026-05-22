<script lang="ts">
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
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {id} {href} class={frameClass} {onclick}>
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
