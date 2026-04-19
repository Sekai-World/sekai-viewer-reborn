<script lang="ts">
  import type { Snippet } from "svelte";
  import { EVENT_CARD_BODY_CLASS, EVENT_CARD_GLOW_CLASS } from "$lib/styles/event-card";

  let {
    id,
    href,
    frameClass,
    children
  }: {
    id?: string;
    href: string;
    frameClass: string;
    children?: Snippet;
  } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a {id} {href} class={frameClass}>
  <div class={EVENT_CARD_GLOW_CLASS}></div>
  <div class={EVENT_CARD_BODY_CLASS}>
    {@render children?.()}
  </div>
</a>
