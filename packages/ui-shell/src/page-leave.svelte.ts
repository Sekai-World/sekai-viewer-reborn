/** The part of SvelteKit's `BeforeNavigate` that page-leave tracking reads. */
export type PageLeaveNavigation = {
  type: string;
  willUnload: boolean;
  to: { url: URL } | null;
  event?: Event;
};

type BeforeNavigate = (callback: (navigation: PageLeaveNavigation) => void) => void;

/**
 * A leave that never unloads the page (the user stopped the load, or the
 * response turned out to be a download) clears the pending state after this.
 */
export const PAGE_LEAVE_RESET_MS = 10_000;

/**
 * Tracks link navigations that unload the document: cross-site links and
 * `data-sveltekit-reload` links. SvelteKit's `navigating` stays empty for
 * those, so the shell would otherwise show no feedback until the browser
 * replaces the page.
 *
 * Call during component initialization and pass SvelteKit's `beforeNavigate`;
 * this package does not depend on SvelteKit itself.
 */
export function trackPageLeave(beforeNavigate: BeforeNavigate): { readonly leaving: boolean } {
  let leaving = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const reset = () => {
    clearTimeout(resetTimer);
    leaving = false;
  };

  beforeNavigate((navigation) => {
    if (!navigation.willUnload || navigation.type !== "link") return;
    const protocol = navigation.to?.url.protocol;
    if (protocol !== "http:" && protocol !== "https:") return;

    leaving = true;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(reset, PAGE_LEAVE_RESET_MS);
    // Another `beforeNavigate` callback may cancel this navigation after this
    // one has run; SvelteKit then prevents the click's default action.
    queueMicrotask(() => {
      if (navigation.event?.defaultPrevented) reset();
    });
  });

  $effect(() => {
    // A page restored from the back/forward cache comes back in the state it
    // was left in, with the indicator still showing.
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      clearTimeout(resetTimer);
    };
  });

  return {
    get leaving() {
      return leaving;
    }
  };
}
