<script lang="ts">
  import Icon from "@iconify/svelte";
  import { tick } from "svelte";
  import "$lib/icons/mdi";

  type OnboardingStep = {
    icon: string;
    title: string;
    description: string;
  };

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
    onClose
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
  } = $props();

  const dialogTitleId = "content-site-onboarding-title";
  let dialog: HTMLDialogElement | null = $state(null);
  let currentStep = $state(0);
  let suppressCloseNotification = false;
  const activeStep = $derived(steps[currentStep]);
  const isLastStep = $derived(currentStep >= steps.length - 1);

  $effect(() => {
    if (!dialog) return;
    if (open) {
      currentStep = 0;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      suppressCloseNotification = true;
      dialog.close();
    }
  });

  const closeWithoutNotification = (): void => {
    if (!dialog?.open) return;
    suppressCloseNotification = true;
    dialog.close();
  };

  const closeByUser = (): void => {
    if (dialog?.open) dialog.close();
    else onClose();
  };

  const handleClose = (): void => {
    currentStep = 0;
    if (suppressCloseNotification) {
      suppressCloseNotification = false;
      return;
    }
    onClose();
  };

  const handleBackdropClick = (event: MouseEvent): void => {
    if (event.target === dialog) closeByUser();
  };

  const finish = async (callback: () => void): Promise<void> => {
    callback();
    closeWithoutNotification();
    await tick();
  };
</script>

<dialog
  bind:this={dialog}
  class="modal"
  aria-labelledby={dialogTitleId}
  onclick={handleBackdropClick}
  onclose={handleClose}
>
  <div
    class="modal-box flex max-h-[min(42rem,calc(100dvh-2rem))] w-[min(36rem,calc(100vw-1rem))] max-w-none flex-col gap-5 overflow-y-auto border border-(--archive-border-default) bg-(--archive-surface-overlay) p-4 text-(--archive-text-default) sm:gap-6 sm:p-6"
  >
    <header class="flex items-start justify-between gap-3">
      <h2 id={dialogTitleId} class="min-w-0 text-lg font-bold sm:text-xl">{title}</h2>
      <button
        type="button"
        class="btn btn-ghost btn-square min-h-11 min-w-11 shrink-0"
        aria-label={closeLabel}
        onclick={closeByUser}
      >
        <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
      </button>
    </header>

    {#if activeStep}
      <div class="flex flex-col gap-5 sm:gap-6">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-3 text-sm">
            <span>{progressLabel}</span>
            <span class="shrink-0 tabular-nums">{currentStep + 1} / {steps.length}</span>
          </div>
          <progress
            class="progress progress-primary h-2 w-full"
            value={currentStep + 1}
            max={steps.length}
            aria-label={progressLabel}
          ></progress>
        </div>

        <section
          class="content-card-inset flex min-w-0 flex-col gap-4 rounded-xl border border-(--archive-border-subtle) p-4 sm:flex-row sm:gap-5 sm:p-5"
        >
          <div
            class="grid size-12 shrink-0 place-items-center rounded-lg bg-(--archive-surface-raised) text-primary"
            aria-hidden="true"
          >
            <Icon icon={activeStep.icon} class="size-7" />
          </div>
          <div class="min-w-0">
            <h3 class="text-base font-semibold">{activeStep.title}</h3>
            <p
              class="mt-2 whitespace-pre-line wrap-break-word text-sm/6 text-(--archive-text-muted)"
            >
              {activeStep.description}
            </p>
          </div>
        </section>
      </div>
    {/if}

    <footer
      class="flex flex-wrap items-center justify-between gap-2 border-t border-(--archive-border-subtle) pt-4"
    >
      <button
        type="button"
        class="btn btn-ghost min-h-11 min-w-11"
        onclick={() => void finish(onSkip)}
      >
        {skipLabel}
      </button>
      <div class="ml-auto flex flex-wrap justify-end gap-2">
        {#if currentStep > 0}
          <button
            type="button"
            class="btn btn-ghost min-h-11 min-w-11 gap-1"
            onclick={() => (currentStep = Math.max(0, currentStep - 1))}
          >
            <Icon icon="mdi:chevron-left" class="size-5" aria-hidden="true" />
            {previousLabel}
          </button>
        {/if}
        {#if isLastStep}
          <button
            type="button"
            class="btn btn-primary min-h-11 min-w-11"
            onclick={() => void finish(onComplete)}
          >
            {finishLabel}
          </button>
        {:else}
          <button
            type="button"
            class="btn btn-primary min-h-11 min-w-11 gap-1"
            disabled={!activeStep}
            onclick={() => (currentStep = Math.min(steps.length - 1, currentStep + 1))}
          >
            {nextLabel}
            <Icon icon="mdi:chevron-right" class="size-5" aria-hidden="true" />
          </button>
        {/if}
      </div>
    </footer>
  </div>
</dialog>
