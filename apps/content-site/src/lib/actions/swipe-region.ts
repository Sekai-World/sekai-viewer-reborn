import type { Action } from "svelte/action";

const SWIPE_THRESHOLD_PX = 64;
const EDGE_GUARD_PX = 24;
const HORIZONTAL_DOMINANCE_RATIO = 1.25;
const FEEDBACK_DURATION_MS = 120;

type TouchOrigin = {
  identifier: number;
  x: number;
  y: number;
  target: Element | null;
};

const isElementVisible = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
};

const hasHorizontalScrollAncestor = (target: Element | null, boundary: HTMLElement): boolean => {
  let element = target instanceof HTMLElement ? target : null;

  while (element && element !== boundary) {
    const overflowX = getComputedStyle(element).overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      element.scrollWidth > element.clientWidth
    ) {
      return true;
    }
    element = element.parentElement;
  }

  return false;
};

const shouldSkipTarget = (target: Element | null, boundary: HTMLElement): boolean =>
  Boolean(
    target?.closest("[data-swipe-region-skip], dialog, input, textarea, select, [role='slider']")
  ) || hasHorizontalScrollAncestor(target, boundary);

const getVisibleRegionOptions = (node: HTMLElement): HTMLElement[] => {
  for (const switcher of node.querySelectorAll<HTMLElement>("[data-region-switcher]")) {
    const options = [...switcher.querySelectorAll<HTMLElement>("[data-region-option]")];
    const activeOption = options.find(
      (option) => option.dataset.regionActive === "true" && isElementVisible(option)
    );

    if (activeOption) {
      return options.filter(isElementVisible);
    }
  }

  return [];
};

export const swipeRegion: Action<HTMLElement> = (node) => {
  let origin: TouchOrigin | null = null;
  let navigationTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressClickUntil = 0;

  const clearNavigationTimer = (): void => {
    if (navigationTimer !== null) {
      clearTimeout(navigationTimer);
      navigationTimer = null;
    }
  };

  const handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1 || navigationTimer !== null) {
      origin = null;
      return;
    }

    const touch = event.touches[0];
    const target = event.target instanceof Element ? event.target : null;
    if (
      touch.clientX < EDGE_GUARD_PX ||
      touch.clientX > window.innerWidth - EDGE_GUARD_PX ||
      shouldSkipTarget(target, node) ||
      getVisibleRegionOptions(node).length < 2
    ) {
      origin = null;
      return;
    }

    origin = {
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      target
    };
  };

  const handleTouchEnd = (event: TouchEvent): void => {
    if (!origin || navigationTimer !== null) {
      origin = null;
      return;
    }

    const touch = Array.from(event.changedTouches).find(
      (candidate) => candidate.identifier === origin?.identifier
    );
    const start = origin;
    origin = null;
    if (!touch || shouldSkipTarget(start.target, node)) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO
    ) {
      return;
    }

    const options = getVisibleRegionOptions(node);
    const currentIndex = options.findIndex((option) => option.dataset.regionActive === "true");
    const targetIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const targetOption = options[targetIndex];
    if (currentIndex < 0 || !targetOption) {
      return;
    }

    suppressClickUntil = performance.now() + 500;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      targetOption.animate(
        [
          { transform: `translateX(${deltaX < 0 ? "0.35rem" : "-0.35rem"})`, opacity: 0.65 },
          { transform: "translateX(0)", opacity: 1 }
        ],
        { duration: FEEDBACK_DURATION_MS, easing: "ease-out" }
      );
    }

    navigationTimer = setTimeout(
      () => {
        navigationTimer = null;
        targetOption.click();
      },
      prefersReducedMotion ? 0 : FEEDBACK_DURATION_MS
    );
  };

  const handleTouchCancel = (): void => {
    origin = null;
  };

  const handleClick = (event: MouseEvent): void => {
    if (event.isTrusted && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  node.addEventListener("touchstart", handleTouchStart, { passive: true });
  node.addEventListener("touchend", handleTouchEnd, { passive: true });
  node.addEventListener("touchcancel", handleTouchCancel, { passive: true });
  node.addEventListener("click", handleClick, { capture: true });

  return {
    destroy() {
      clearNavigationTimer();
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchend", handleTouchEnd);
      node.removeEventListener("touchcancel", handleTouchCancel);
      node.removeEventListener("click", handleClick, { capture: true });
    }
  };
};
