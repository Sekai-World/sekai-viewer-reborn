<script lang="ts">
  import "../app.css";
  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount, type Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { GlobalNotificationBanner } from "@platform/ui-shell";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: Snippet; data: LayoutData } = $props();
  let useFallbackRouteTransition = $state(true);
  const navigationTransitionKey = $derived(`${page.url.pathname}${page.url.search}`);

  onMount(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const documentWithViewTransition = document as Document & {
      startViewTransition?: (updateCallback: () => Promise<void> | void) => unknown;
    };
    const supportsViewTransition =
      typeof documentWithViewTransition.startViewTransition === "function";
    useFallbackRouteTransition = !supportsViewTransition || prefersReducedMotion;

    const maybeDisposeNavigationTransition =
      supportsViewTransition && !prefersReducedMotion
        ? onNavigate((navigation) => {
            if (!documentWithViewTransition.startViewTransition) {
              return;
            }

            return new Promise<void>((resolve) => {
              documentWithViewTransition.startViewTransition(async () => {
                resolve();
                await navigation.complete;
              });
            });
          })
        : undefined;

    const disposeNavigationTransition =
      typeof maybeDisposeNavigationTransition === "function"
        ? maybeDisposeNavigationTransition
        : () => {};

    return () => {
      disposeNavigationTransition();
    };
  });
</script>

<GlobalNotificationBanner notices={data.globalNotices} />

{#if useFallbackRouteTransition}
  {#key navigationTransitionKey}
    <div
      class="page-switch-shell"
      in:fade|local={{ duration: 150 }}
      out:fade|local={{ duration: 110 }}
    >
      {@render children()}
    </div>
  {/key}
{:else}
  <div class="page-switch-shell">
    {@render children()}
  </div>
{/if}
