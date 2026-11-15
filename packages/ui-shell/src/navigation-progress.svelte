<script lang="ts" module>
  /** A navigation that settles sooner than this shows no indicator at all. */
  export const NAVIGATION_PROGRESS_SHOW_DELAY_MS = 120;
  /** Once shown, the bar stays this long so it never reads as a flicker. */
  export const NAVIGATION_PROGRESS_MIN_VISIBLE_MS = 200;
  /** The outgoing content is dimmed once the wait is clearly noticeable. */
  export const NAVIGATION_PROGRESS_DIM_DELAY_MS = 400;
  /** Screen readers hear about the wait only when it is long. */
  export const NAVIGATION_PROGRESS_ANNOUNCE_DELAY_MS = 1000;
  /** Fill-and-fade time of the finishing bar; matches the CSS below. */
  export const NAVIGATION_PROGRESS_FINISH_MS = 330;
</script>

<script lang="ts">
  import { onDestroy, untrack } from "svelte";

  type Props = {
    /** True while a navigation is pending. */
    active: boolean;
    /** Announced to assistive technology when the wait is long. */
    label?: string;
    /** True while the indicator is shown for a pending navigation. */
    busy?: boolean;
    /** True once the outgoing content should be dimmed. */
    dimmed?: boolean;
  };

  let {
    active,
    label = "Loading page",
    busy = $bindable(false),
    dimmed = $bindable(false)
  }: Props = $props();

  let phase = $state<"idle" | "loading" | "done">("idle");
  let announced = $state(false);
  let shownAt = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (!active) return;

    const show = () => {
      phase = "loading";
      busy = true;
      shownAt = performance.now();
    };
    const timers = [
      setTimeout(() => {
        dimmed = true;
      }, NAVIGATION_PROGRESS_DIM_DELAY_MS),
      setTimeout(() => {
        announced = true;
      }, NAVIGATION_PROGRESS_ANNOUNCE_DELAY_MS)
    ];

    clearTimeout(settleTimer);
    if (untrack(() => phase) === "loading") {
      // A navigation started while the previous bar was still on screen.
      show();
    } else {
      // Also restarts a bar that was fading out, so it never runs backwards.
      phase = "idle";
      timers.push(setTimeout(show, NAVIGATION_PROGRESS_SHOW_DELAY_MS));
    }

    return () => {
      timers.forEach(clearTimeout);
      busy = false;
      dimmed = false;
      announced = false;
      if (phase !== "loading") return;

      const remaining = Math.max(
        0,
        NAVIGATION_PROGRESS_MIN_VISIBLE_MS - (performance.now() - shownAt)
      );
      settleTimer = setTimeout(() => {
        phase = "done";
        settleTimer = setTimeout(() => {
          phase = "idle";
        }, NAVIGATION_PROGRESS_FINISH_MS);
      }, remaining);
    };
  });

  // Runs after the effect cleanup above, which may have just scheduled it.
  onDestroy(() => {
    clearTimeout(settleTimer);
  });
</script>

<div class="navigation-progress" data-phase={phase} aria-hidden="true">
  <div class="navigation-progress-bar"></div>
</div>
<div class="sr-only" role="status">{announced ? label : ""}</div>

<style>
  .navigation-progress {
    position: fixed;
    inset: 0 0 auto;
    z-index: 90;
    height: 3px;
    pointer-events: none;
  }

  .navigation-progress-bar {
    height: 100%;
    background: var(--color-primary);
    opacity: 0;
    transform: scaleX(0);
    transform-origin: left center;
  }

  :global([dir="rtl"]) .navigation-progress-bar {
    transform-origin: right center;
  }

  /* Indeterminate trickle: quick at first, then slowing towards the end. */
  [data-phase="loading"] .navigation-progress-bar {
    opacity: 1;
    transform: scaleX(0.9);
    transition: transform 8s cubic-bezier(0.1, 0.7, 0.2, 1);
  }

  [data-phase="done"] .navigation-progress-bar {
    opacity: 0;
    transform: scaleX(1);
    transition:
      transform 150ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 180ms linear 150ms;
  }

  /* Reduced motion: a static full-width bar that appears and disappears. */
  @media (prefers-reduced-motion: reduce) {
    [data-phase="loading"] .navigation-progress-bar {
      transform: scaleX(1);
      transition: none;
    }

    [data-phase="done"] .navigation-progress-bar {
      transition: none;
    }
  }

  :global([data-low-motion]) [data-phase="loading"] .navigation-progress-bar {
    transform: scaleX(1);
    transition: none;
  }

  :global([data-low-motion]) [data-phase="done"] .navigation-progress-bar {
    transition: none;
  }
</style>
