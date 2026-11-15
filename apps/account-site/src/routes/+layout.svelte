<script lang="ts">
  import "../app.css";
  import { beforeNavigate, onNavigate } from "$app/navigation";
  import { navigating, page } from "$app/state";
  import { onMount, type Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { GlobalNotificationBanner, NavigationProgress, trackPageLeave } from "@platform/ui-shell";
  import type { LayoutData } from "./$types";

  type DocumentWithViewTransition = Document & {
    startViewTransition?: (updateCallback: () => Promise<void> | void) => unknown;
  };
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  let { children, data }: { children: Snippet; data: LayoutData } = $props();
  // The 150ms fade only runs where native view transitions are unavailable
  // and motion is allowed; reduced-motion users get an instant swap.
  let useFallbackRouteTransition = $state(false);
  const pageLeave = trackPageLeave(beforeNavigate);
  let navigationBusy = $state(false);
  let navigationDimmed = $state(false);
  const navigationTransitionKey = $derived(`${page.url.pathname}${page.url.search}`);

  onNavigate((navigation) => {
    if (navigation.shallow && navigation.type === "goto") return;

    const documentWithViewTransition = document as DocumentWithViewTransition;
    if (typeof documentWithViewTransition.startViewTransition !== "function") {
      return;
    }
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      return;
    }

    return new Promise<void>((resolve) => {
      documentWithViewTransition.startViewTransition!(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  onMount(() => {
    const supportsViewTransition =
      typeof (document as DocumentWithViewTransition).startViewTransition === "function";
    const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    useFallbackRouteTransition = !supportsViewTransition && !prefersReducedMotion;
  });
</script>

<GlobalNotificationBanner notices={data.globalNotices} />
<NavigationProgress
  active={navigating.to !== null || pageLeave.leaving}
  bind:busy={navigationBusy}
  bind:dimmed={navigationDimmed}
/>

{#if useFallbackRouteTransition}
  {#key navigationTransitionKey}
    <div
      class="page-switch-shell transition-opacity duration-180 motion-reduce:transition-none"
      class:opacity-60={navigationDimmed}
      aria-busy={navigationBusy ? "true" : undefined}
      in:fade|local={{ duration: 150 }}
      out:fade|local={{ duration: 150 }}
    >
      {@render children()}
    </div>
  {/key}
{:else}
  <div
    class="page-switch-shell transition-opacity duration-180 motion-reduce:transition-none"
    class:opacity-60={navigationDimmed}
    aria-busy={navigationBusy ? "true" : undefined}
  >
    {@render children()}
  </div>
{/if}
