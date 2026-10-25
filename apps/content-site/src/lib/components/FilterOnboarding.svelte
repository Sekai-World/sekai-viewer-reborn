<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { beforeNavigate } from "$app/navigation";
  import OnboardingDialog from "./OnboardingDialog.svelte";
  import {
    readFilterGuideSeen,
    writeFilterGuideSeen,
    type FilterGuideScope
  } from "$lib/filter-onboarding";

  let {
    scope,
    dialog,
    translate,
    targets
  }: {
    scope: FilterGuideScope;
    dialog: HTMLDialogElement | null;
    translate: (key: string) => string;
    targets: readonly string[];
  } = $props();

  const instanceId = $props.id();
  let consentDialog: HTMLDialogElement | null = null;
  let skipButton: HTMLButtonElement | null = null;
  let tourOpen = $state(false);
  let guideTargets = $state<readonly string[]>([]);
  let opening = false;
  let prompted = false;
  let pendingOpen: (() => void) | null = null;
  let accepted = false;
  let disposed = false;
  let request = 0;
  const steps = $derived(
    guideTargets.map((target) => ({
      target,
      icon: "mdi:filter-variant",
      title: translate(`filterGuide.steps.${target}.title`),
      description: translate(`filterGuide.steps.${target}.description`)
    }))
  );

  const finishTour = (): void => {
    request += 1;
    opening = false;
    tourOpen = false;
  };

  // Only called by the catalogue's existing filter-open action, never on mount.
  export function requestOpen(openFilters: () => void): void {
    if (pendingOpen || opening || tourOpen || disposed || !consentDialog) return;
    if (prompted || readFilterGuideSeen(scope)) {
      openFilters();
      return;
    }
    pendingOpen = openFilters;
    accepted = false;
    consentDialog.showModal();
    void tick().then(() => {
      if (!disposed && consentDialog?.open) skipButton?.focus();
    });
  }

  const rememberChoice = (): void => {
    prompted = true;
    writeFilterGuideSeen(scope);
  };

  const choose = (showGuide: boolean): void => {
    accepted = showGuide;
    consentDialog?.close();
  };

  const handleConsentClose = async (): Promise<void> => {
    const openFilters = pendingOpen;
    pendingOpen = null;
    if (!openFilters || disposed) return;
    // Native Escape/other dismissals also count as declining, without blocking filters.
    rememberChoice();
    const currentRequest = ++request;
    const startTour = accepted;
    opening = true;
    openFilters();
    await tick();
    if (disposed || currentRequest !== request || !dialog?.open) return;
    if (startTour) {
      // Measure only after the modal-box entry transform settles. Do not wait for
      // descendant loading indicators or any infinite/decorative animations.
      const panel = dialog.querySelector<HTMLElement>(".modal-box");
      const entryAnimations = (panel?.getAnimations?.() ?? []).filter(
        (animation) =>
          animation.playState === "running" &&
          Number.isFinite(animation.effect?.getComputedTiming().endTime)
      );
      if (entryAnimations.length > 0) {
        // Cancellation (e.g. reduced motion or closing the filter) is safe too.
        await Promise.allSettled(entryAnimations.map((animation) => animation.finished));
      }
    }
    if (disposed || currentRequest !== request || !dialog?.open) return;
    opening = false;
    // Snapshot after draft synchronization and rendering. Conditional controls
    // must exist before they become steps; later prop changes must not shift indices.
    guideTargets = startTour ? targets.filter((target) => resolveTarget(target) !== null) : [];
    tourOpen = startTour && guideTargets.length > 0;
  };

  const resolveTarget = (target: string): HTMLElement | null =>
    dialog?.querySelector<HTMLElement>(`[data-filter-guide="${target}"]`) ?? null;

  const prepareStep = (index: number): void => {
    if (!dialog?.open) {
      finishTour();
      return;
    }
    const target = guideTargets[index];
    const element = target ? resolveTarget(target) : null;
    if (!element) {
      finishTour();
      return;
    }
    element.scrollIntoView({ block: "center", behavior: "instant" });
  };

  $effect(() => {
    const filterDialog = dialog;
    if (!filterDialog) return;
    filterDialog.addEventListener("close", finishTour);
    return () => filterDialog.removeEventListener("close", finishTour);
  });

  beforeNavigate(() => {
    if (!pendingOpen && !opening && !tourOpen) return;
    pendingOpen = null;
    consentDialog?.close();
    finishTour();
    if (dialog?.open) dialog.close();
  });

  onDestroy(() => {
    disposed = true;
    request += 1;
    pendingOpen = null;
    if (consentDialog?.open) consentDialog.close();
  });
</script>

<dialog
  bind:this={consentDialog}
  class="modal"
  aria-labelledby={`${instanceId}-title`}
  aria-describedby={`${instanceId}-description`}
  onclose={handleConsentClose}
  oncancel={(event) => {
    event.preventDefault();
    choose(false);
  }}
>
  <div class="modal-box archive-filter-dialog max-w-sm border">
    <h2 id={`${instanceId}-title`} class="text-lg font-semibold">
      {translate("filterGuide.prompt.title")}
    </h2>
    <p id={`${instanceId}-description`} class="mt-2 text-sm text-(--archive-text-default)">
      {translate("filterGuide.prompt.description")}
    </p>
    <div class="modal-action flex-wrap gap-2">
      <button
        bind:this={skipButton}
        type="button"
        class="btn btn-outline min-h-12!"
        onclick={() => choose(false)}
      >
        {translate("filterGuide.prompt.skip")}
      </button>
      <button type="button" class="btn btn-primary min-h-12!" onclick={() => choose(true)}>
        {translate("filterGuide.prompt.accept")}
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button type="submit" aria-label={translate("closeLabel")}></button>
  </form>
</dialog>

<OnboardingDialog
  open={tourOpen}
  title={translate("filterGuide.title")}
  progressLabel={translate("onboarding.progressLabel")}
  previousLabel={translate("onboarding.previousLabel")}
  nextLabel={translate("onboarding.nextLabel")}
  finishLabel={translate("onboarding.finishLabel")}
  skipLabel={translate("onboarding.skipLabel")}
  closeLabel={translate("closeLabel")}
  {steps}
  {resolveTarget}
  onStepChange={prepareStep}
  onComplete={finishTour}
  onSkip={finishTour}
  onClose={finishTour}
/>
