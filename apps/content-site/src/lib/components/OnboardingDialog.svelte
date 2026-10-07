<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onDestroy, tick } from "svelte";
  import "$lib/icons/mdi";

  type OnboardingStep = {
    icon: string;
    title: string;
    description: string;
    target: string;
  };

  type TargetResolution = HTMLElement | readonly HTMLElement[];

  let {
    open,
    title,
    progressLabel,
    previousLabel,
    nextLabel,
    finishLabel,
    skipLabel,
    closeLabel,
    steps,
    onComplete,
    onSkip,
    onClose,
    onStepChange,
    resolveTarget
  }: {
    open: boolean;
    title: string;
    progressLabel: string;
    previousLabel: string;
    nextLabel: string;
    finishLabel: string;
    skipLabel: string;
    closeLabel: string;
    steps: readonly OnboardingStep[];
    onComplete: () => void;
    onSkip: () => void;
    onClose: () => void;
    onStepChange?: (stepIndex: number) => void | Promise<void>;
    resolveTarget?: (target: string) => TargetResolution | null;
  } = $props();

  const dialogTitleId = "content-site-onboarding-title";
  const dialogDescriptionId = "content-site-onboarding-description";
  let dialog: HTMLDialogElement | null = $state(null);
  let closeButton: HTMLButtonElement | null = $state(null);
  let coach: HTMLElement | null = $state(null);
  let currentStep = $state(0);
  let spotlightStyle = $state("");
  let maskPanels = $state<string[]>([]);
  let coachStyle = $state("");
  let hasTarget = $state(false);
  let suppressCloseNotification = false;
  let restoreFocusElement: HTMLElement | null = null;
  let measurementRequest = 0;
  let geometryFrame = 0;
  let stopGeometryTracking: (() => void) | null = null;
  const activeStep = $derived(steps[currentStep]);
  const isLastStep = $derived(currentStep >= steps.length - 1);

  const getVisibleTargets = (targetName: string): HTMLElement[] => {
    const targets = document.querySelectorAll<HTMLElement>(
      `[data-onboarding-target="${targetName}"]`
    );

    return [...targets].filter((target) => {
      const rect = target.getBoundingClientRect();
      const style = window.getComputedStyle(target);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        target.getClientRects().length > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    });
  };

  const asTargetArray = (target: TargetResolution | null): HTMLElement[] =>
    target ? (Array.isArray(target) ? [...target] : [target as HTMLElement]) : [];

  const clamp = (value: number, minimum: number, maximum: number): number =>
    Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

  const updateGeometry = (): void => {
    const step = steps[currentStep];
    if (!step || typeof window === "undefined") {
      hasTarget = false;
      spotlightStyle = "";
      coachStyle = "";
      return;
    }

    const resolvedTargets = resolveTarget
      ? asTargetArray(resolveTarget(step.target))
      : getVisibleTargets(step.target);
    if (resolvedTargets.length === 0) {
      hasTarget = false;
      spotlightStyle = "";
      coachStyle = "";
      return;
    }

    const visibleRects = resolvedTargets.flatMap((target) => {
      const rect = target.getBoundingClientRect();
      // Scrollable menus can clip a section: highlight only the visible real area.
      let visibleLeft = rect.left;
      let visibleTop = rect.top;
      let visibleRight = rect.right;
      let visibleBottom = rect.bottom;
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        const style = window.getComputedStyle(parent);
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
          const parentRect = parent.getBoundingClientRect();
          visibleLeft = Math.max(visibleLeft, parentRect.left);
          visibleRight = Math.min(visibleRight, parentRect.right);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          const parentRect = parent.getBoundingClientRect();
          visibleTop = Math.max(visibleTop, parentRect.top);
          visibleBottom = Math.min(visibleBottom, parentRect.bottom);
        }
      }
      if (
        visibleRight <= visibleLeft ||
        visibleBottom <= visibleTop ||
        visibleRight <= 0 ||
        visibleLeft >= window.innerWidth ||
        visibleBottom <= 0 ||
        visibleTop >= window.innerHeight
      ) {
        return [];
      }
      return [
        {
          left: Math.max(0, visibleLeft),
          top: Math.max(0, visibleTop),
          right: Math.min(window.innerWidth, visibleRight),
          bottom: Math.min(window.innerHeight, visibleBottom)
        }
      ];
    });
    if (visibleRects.length === 0) {
      hasTarget = false;
      spotlightStyle = "";
      coachStyle = "";
      return;
    }

    const rect = {
      left: Math.min(...visibleRects.map((item) => item.left)),
      top: Math.min(...visibleRects.map((item) => item.top)),
      right: Math.max(...visibleRects.map((item) => item.right)),
      bottom: Math.max(...visibleRects.map((item) => item.bottom))
    };
    const visibleTop = rect.top;
    const visibleBottom = rect.bottom;
    if (visibleBottom <= visibleTop || rect.right <= rect.left) {
      hasTarget = false;
      spotlightStyle = "";
      coachStyle = "";
      return;
    }
    const viewportPadding = 8;
    const left = clamp(rect.left - viewportPadding, 4, window.innerWidth - 4);
    const top = clamp(visibleTop - viewportPadding, 4, window.innerHeight - 4);
    const right = clamp(rect.right + viewportPadding, 4, window.innerWidth - 4);
    const bottom = clamp(visibleBottom + viewportPadding, 4, window.innerHeight - 4);
    const spotlightWidth = Math.max(1, right - left);
    const spotlightHeight = Math.max(1, bottom - top);
    const coachWidth = Math.min(320, window.innerWidth - 24);
    const coachHeight = coach?.getBoundingClientRect().height ?? 240;
    const coachLeft = clamp(
      rect.left + (rect.right - rect.left) / 2 - coachWidth / 2,
      12,
      window.innerWidth - coachWidth - 12
    );
    const spaceBelow = window.innerHeight - bottom;
    // Prefer beside the control on desktop; on narrow screens use below or above.
    const beside = left >= coachWidth + 28;
    const placedLeft = beside ? left - coachWidth - 16 : coachLeft;
    const preferredTop = beside
      ? top
      : spaceBelow >= coachHeight + 16
        ? bottom + 16
        : top - coachHeight - 16;
    const coachTop = clamp(preferredTop, 12, window.innerHeight - coachHeight - 12);

    spotlightStyle = `left:${left}px;top:${top}px;width:${spotlightWidth}px;height:${spotlightHeight}px`;
    // Four flat scrim panels form the cutout without a giant shadow or filter.
    maskPanels = [
      `left:0;top:0;width:100%;height:${top}px`,
      `left:0;top:${bottom}px;width:100%;bottom:0`,
      `left:0;top:${top}px;width:${left}px;height:${spotlightHeight}px`,
      `left:${right}px;right:0;top:${top}px;height:${spotlightHeight}px`
    ];
    coachStyle = `left:${placedLeft}px;top:${coachTop}px;width:${coachWidth}px`;
    hasTarget = true;
  };

  const scheduleGeometryUpdate = (): void => {
    if (typeof window === "undefined") return;
    window.cancelAnimationFrame(geometryFrame);
    geometryFrame = window.requestAnimationFrame(() => {
      geometryFrame = 0;
      if (open) updateGeometry();
    });
  };

  const handleResize = (): void => {
    void syncStep(currentStep);
  };

  const getFocusableCoachButtons = (): HTMLButtonElement[] => {
    if (!coach) return [];

    return [...coach.querySelectorAll<HTMLButtonElement>("button")].filter((button) => {
      const style = window.getComputedStyle(button);
      return (
        !button.disabled &&
        button.tabIndex >= 0 &&
        !button.closest("[hidden], [inert], [aria-hidden='true']") &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });
  };

  const handleTourKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || !open || !dialog?.open || !coach) return;

    const buttons = getFocusableCoachButtons();
    if (buttons.length === 0) return;

    const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      activeIndex === -1
        ? event.shiftKey
          ? buttons.length - 1
          : 0
        : (activeIndex + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;

    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  const startGeometryTracking = (): void => {
    stopGeometryTracking?.();
    const resizeObserver = new ResizeObserver(scheduleGeometryUpdate);
    const mutationObserver = new MutationObserver(scheduleGeometryUpdate);
    resizeObserver.observe(document.documentElement);
    if (coach) resizeObserver.observe(coach);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "class", "hidden"]
    });
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", scheduleGeometryUpdate, true);
    document.addEventListener("keydown", handleTourKeydown, true);
    stopGeometryTracking = () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", scheduleGeometryUpdate, true);
      document.removeEventListener("keydown", handleTourKeydown, true);
      window.cancelAnimationFrame(geometryFrame);
      stopGeometryTracking = null;
    };
  };

  const syncStep = async (stepIndex: number): Promise<void> => {
    const request = ++measurementRequest;
    hasTarget = false;
    await onStepChange?.(stepIndex);
    await tick();
    if (!open || request !== measurementRequest) return;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    if (open && request === measurementRequest) updateGeometry();
  };

  const closeWithoutNotification = (): void => {
    if (!dialog?.open) return;
    suppressCloseNotification = true;
    measurementRequest += 1;
    stopGeometryTracking?.();
    dialog.close();
  };

  const restoreFocus = (): void => {
    const element = restoreFocusElement;
    restoreFocusElement = null;
    if (element?.isConnected && element.getClientRects().length > 0 && !dialog?.contains(element)) {
      void tick().then(() => element.focus({ preventScroll: true }));
    }
  };

  const closeByUser = (): void => {
    if (dialog?.open) dialog.close();
    else onClose();
  };

  const handleClose = (): void => {
    measurementRequest += 1;
    stopGeometryTracking?.();
    currentStep = 0;
    spotlightStyle = "";
    coachStyle = "";
    hasTarget = false;
    if (suppressCloseNotification) {
      suppressCloseNotification = false;
      restoreFocus();
      return;
    }
    onClose();
    restoreFocus();
  };

  const selectStep = (stepIndex: number): void => {
    if (stepIndex < 0 || stepIndex >= steps.length || stepIndex === currentStep) return;
    currentStep = stepIndex;
    void syncStep(stepIndex);
  };

  const finish = (callback: () => void): void => {
    callback();
    closeWithoutNotification();
  };

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      restoreFocusElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      currentStep = 0;
      dialog.showModal();
      startGeometryTracking();
      void syncStep(0);
      void tick().then(() => closeButton?.focus());
    } else if (!open && dialog.open) {
      closeWithoutNotification();
    }
  });

  onDestroy(() => {
    measurementRequest += 1;
    stopGeometryTracking?.();
  });
</script>

<dialog
  bind:this={dialog}
  class="onboarding-tour"
  aria-labelledby={dialogTitleId}
  aria-describedby={dialogDescriptionId}
  onclose={handleClose}
>
  <button
    type="button"
    class="onboarding-tour-dismiss"
    class:onboarding-tour-dismiss-fallback={!hasTarget}
    tabindex="-1"
    aria-label={closeLabel}
    onclick={closeByUser}
  ></button>

  {#if hasTarget}
    {#each maskPanels as panel (panel)}
      <div class="onboarding-tour-scrim" style={panel} aria-hidden="true"></div>
    {/each}
    <div class="onboarding-tour-spotlight" style={spotlightStyle} aria-hidden="true"></div>
  {/if}

  {#if activeStep}
    <aside
      bind:this={coach}
      class:onboarding-tour-coach-fallback={!hasTarget}
      class="onboarding-tour-coach"
      style={hasTarget ? coachStyle : undefined}
    >
      <div class="mb-2 flex shrink-0 items-center justify-between gap-2">
        <span class="text-xs text-(--archive-text-muted)">{title}</span>
        <button
          bind:this={closeButton}
          type="button"
          class="btn btn-ghost btn-square min-h-11 min-w-11 shrink-0"
          aria-label={closeLabel}
          onclick={closeByUser}
        >
          <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
        </button>
      </div>
      <div
        class="flex min-h-0 items-start gap-3 overflow-y-auto"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-(--archive-surface-raised) text-primary"
          aria-hidden="true"
        >
          <Icon icon={activeStep.icon} class="size-5" />
        </span>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 id={dialogTitleId} class="wrap-break-word font-semibold">{activeStep.title}</h2>
            <span
              aria-label={progressLabel}
              class="shrink-0 text-xs font-semibold tabular-nums text-(--archive-text-muted)"
            >
              {currentStep + 1} / {steps.length}
            </span>
          </div>
          <p
            id={dialogDescriptionId}
            class="mt-1 wrap-break-word text-sm/5 text-(--archive-text-muted)"
          >
            {activeStep.description}
          </p>
        </div>
      </div>

      <div
        class="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-(--archive-border-subtle) pt-3"
      >
        <button
          type="button"
          class="btn btn-ghost min-h-11 min-w-11 px-2"
          onclick={() => finish(onSkip)}
        >
          {skipLabel}
        </button>
        <div class="ml-auto flex flex-wrap justify-end gap-2">
          {#if currentStep > 0}
            <button
              type="button"
              class="btn btn-ghost min-h-11 min-w-11 gap-1 px-2"
              onclick={() => selectStep(currentStep - 1)}
            >
              <Icon icon="mdi:chevron-left" class="size-5" aria-hidden="true" />
              {previousLabel}
            </button>
          {/if}
          {#if isLastStep}
            <button
              type="button"
              class="btn btn-primary min-h-11 min-w-11 px-2"
              onclick={() => finish(onComplete)}
            >
              {finishLabel}
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-primary min-h-11 min-w-11 gap-1 px-2"
              onclick={() => selectStep(currentStep + 1)}
            >
              {nextLabel}
              <Icon icon="mdi:chevron-right" class="size-5" aria-hidden="true" />
            </button>
          {/if}
        </div>
      </div>
    </aside>
  {/if}
</dialog>

<style>
  .onboarding-tour {
    position: fixed;
    inset: 0;
    width: 100vw;
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: 0;
    overflow: visible;
    border: 0;
    background: transparent;
    color: var(--archive-text-default);
  }

  .onboarding-tour::backdrop {
    background: transparent;
  }

  .onboarding-tour-dismiss {
    position: fixed;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    cursor: default;
    border: 0;
    background: transparent;
  }

  .onboarding-tour-spotlight {
    position: fixed;
    z-index: 1;
    border: 2px solid var(--color-primary);
    border-radius: 0.75rem;
    pointer-events: none;
  }

  .onboarding-tour-scrim {
    position: fixed;
    z-index: 1;
    background: color-mix(in oklab, black 65%, transparent);
    pointer-events: none;
  }

  .onboarding-tour-dismiss-fallback {
    background: color-mix(in oklab, black 65%, transparent);
  }

  .onboarding-tour-coach {
    position: fixed;
    z-index: 2;
    display: flex;
    flex-direction: column;
    width: min(20rem, calc(100vw - 1.5rem));
    max-height: calc(100dvh - 1.5rem);
    overflow: hidden;
    border: 1px solid var(--archive-border-default);
    border-radius: 0.75rem;
    background: var(--archive-surface-overlay);
    padding: 0.875rem;
    box-shadow: 0 8px 20px color-mix(in oklab, var(--archive-text-default) 12%, transparent);
    pointer-events: auto;
  }

  .onboarding-tour-coach-fallback {
    top: auto !important;
    right: 0.75rem;
    bottom: 0.75rem;
    left: 0.75rem !important;
    width: auto;
    max-width: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .onboarding-tour-spotlight,
    .onboarding-tour-coach {
      transition: none;
    }
  }

  :global(:root[data-low-motion]) .onboarding-tour-spotlight,
  :global(:root[data-low-motion]) .onboarding-tour-coach {
    transition: none;
  }
</style>
