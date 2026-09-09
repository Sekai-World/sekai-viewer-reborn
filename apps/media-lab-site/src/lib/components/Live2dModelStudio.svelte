<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "@iconify/svelte";

  /** Localized control labels, resolved by the hosting route's translator. */
  export interface Live2dModelStudioLabels {
    controlsTitle: string;
    motion: string;
    motionEmpty: string;
    expression: string;
    expressionEmpty: string;
    noneLoaded: string;
    apply: string;
    pause: string;
    resume: string;
    idleBreath: string;
    reload: string;
    reset: string;
    controlsHint: string;
  }

  interface Props {
    labels: Live2dModelStudioLabels;
    /** Human-readable stage status rendered under the stage surface. */
    statusLine: string;
    /** Controls stay disabled until the model player adapter reports readiness. */
    controlsEnabled?: boolean;
    motions?: readonly string[];
    expressions?: readonly string[];
    selectedMotion?: string;
    selectedExpression?: string;
    idleMotion?: boolean;
    paused?: boolean;
    /**
     * Lifecycle insertion point: the model player adapter renders its canvas
     * host here. When absent, the studio shows its reserved-stage placeholder.
     */
    stage?: Snippet<[]>;
    onApplyMotion?: () => void;
    onApplyExpression?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onReset?: () => void;
    onReload?: () => void;
  }

  let {
    labels,
    statusLine,
    controlsEnabled = false,
    motions = [],
    expressions = [],
    selectedMotion = $bindable(""),
    selectedExpression = $bindable(""),
    idleMotion = $bindable(true),
    paused = false,
    stage,
    onApplyMotion,
    onApplyExpression,
    onPause,
    onResume,
    onReset,
    onReload
  }: Props = $props();

  const uid = $props.id();
  const motionSelectionAvailable = $derived(motions.includes(selectedMotion));
  const expressionSelectionAvailable = $derived(expressions.includes(selectedExpression));
  const filteredMotions = $derived(
    motions.filter((motion) =>
      motion.toLocaleLowerCase().includes(selectedMotion.toLocaleLowerCase())
    )
  );
  const filteredExpressions = $derived(
    expressions.filter((expression) =>
      expression.toLocaleLowerCase().includes(selectedExpression.toLocaleLowerCase())
    )
  );
  let motionOpen = $state(false);
  let expressionOpen = $state(false);
  let motionActiveIndex = $state(-1);
  let expressionActiveIndex = $state(-1);
  let motionInput: HTMLInputElement;
  let expressionInput: HTMLInputElement;

  function openMotionSelector() {
    if (!controlsEnabled) return;
    motionOpen = true;
    motionActiveIndex = filteredMotions.length > 0 ? 0 : -1;
  }

  function openExpressionSelector() {
    if (!controlsEnabled) return;
    expressionOpen = true;
    expressionActiveIndex = filteredExpressions.length > 0 ? 0 : -1;
  }

  function closeMotionSelector() {
    motionOpen = false;
    motionActiveIndex = -1;
  }

  function closeExpressionSelector() {
    expressionOpen = false;
    expressionActiveIndex = -1;
  }

  function handleMotionInput() {
    openMotionSelector();
  }

  function handleExpressionInput() {
    openExpressionSelector();
  }

  function selectMotion(motion: string) {
    selectedMotion = motion;
    closeMotionSelector();
  }

  function selectExpression(expression: string) {
    selectedExpression = expression;
    closeExpressionSelector();
  }

  function clearMotion() {
    selectedMotion = "";
    motionOpen = true;
    motionActiveIndex = motions.length > 0 ? 0 : -1;
    motionInput?.focus();
  }

  function clearExpression() {
    selectedExpression = "";
    expressionOpen = true;
    expressionActiveIndex = expressions.length > 0 ? 0 : -1;
    expressionInput?.focus();
  }

  function preventOptionFocus(event: PointerEvent) {
    event.preventDefault();
  }

  function handleMotionKeydown(event: KeyboardEvent) {
    if (!controlsEnabled) return;

    if (event.key === "Escape") {
      if (motionOpen) {
        event.preventDefault();
        closeMotionSelector();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!motionOpen) openMotionSelector();
      if (filteredMotions.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      motionActiveIndex =
        motionActiveIndex < 0
          ? step > 0
            ? 0
            : filteredMotions.length - 1
          : (motionActiveIndex + step + filteredMotions.length) % filteredMotions.length;
      return;
    }

    if (event.key === "Enter" && motionOpen && motionActiveIndex >= 0) {
      const motion = filteredMotions[motionActiveIndex];
      if (motion) {
        event.preventDefault();
        selectMotion(motion);
      }
    }
  }

  function handleExpressionKeydown(event: KeyboardEvent) {
    if (!controlsEnabled) return;

    if (event.key === "Escape") {
      if (expressionOpen) {
        event.preventDefault();
        closeExpressionSelector();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!expressionOpen) openExpressionSelector();
      if (filteredExpressions.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      expressionActiveIndex =
        expressionActiveIndex < 0
          ? step > 0
            ? 0
            : filteredExpressions.length - 1
          : (expressionActiveIndex + step + filteredExpressions.length) %
            filteredExpressions.length;
      return;
    }

    if (event.key === "Enter" && expressionOpen && expressionActiveIndex >= 0) {
      const expression = filteredExpressions[expressionActiveIndex];
      if (expression) {
        event.preventDefault();
        selectExpression(expression);
      }
    }
  }

  function handleMotionFocusOut(event: FocusEvent) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && (event.currentTarget as HTMLElement).contains(nextTarget))
      return;
    closeMotionSelector();
  }

  function handleExpressionFocusOut(event: FocusEvent) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && (event.currentTarget as HTMLElement).contains(nextTarget))
      return;
    closeExpressionSelector();
  }
</script>

<div class="flex flex-col gap-4">
  <section
    aria-labelledby={`${uid}-controls-title`}
    class="rounded-2xl border border-base-content/10 bg-base-100 p-4 shadow-sm sm:p-5"
  >
    <div class="mb-4 flex items-center justify-between gap-4">
      <h3 id={`${uid}-controls-title`} class="text-base font-semibold text-base-content">
        {labels.controlsTitle}
      </h3>
      {#if !controlsEnabled}
        <span class="text-right text-xs font-medium text-base-content/50"
          >{labels.controlsHint}</span
        >
      {/if}
    </div>

    <div class="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_minmax(15rem,1fr)_auto] lg:items-end">
      <div class="flex min-w-0 items-end gap-2" onfocusout={handleMotionFocusOut}>
        <div class="relative min-w-0 flex-1">
          <label class="flex min-w-0 flex-col gap-1.5" for={`${uid}-motion`}>
            <span class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
              {labels.motion}
            </span>
            <input
              id={`${uid}-motion`}
              class="input input-bordered min-h-11 w-full min-w-0 bg-base-100 pr-11"
              type="text"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={motionOpen && filteredMotions.length > 0}
              aria-controls={`${uid}-motion-options`}
              aria-activedescendant={motionActiveIndex >= 0
                ? `${uid}-motion-option-${motionActiveIndex}`
                : undefined}
              placeholder={motions.length > 0 ? labels.motionEmpty : labels.noneLoaded}
              disabled={!controlsEnabled}
              bind:this={motionInput}
              bind:value={selectedMotion}
              onfocus={openMotionSelector}
              onclick={openMotionSelector}
              oninput={handleMotionInput}
              onkeydown={handleMotionKeydown}
            />
          </label>
          {#if controlsEnabled && selectedMotion !== ""}
            <button
              type="button"
              class="btn btn-circle absolute right-0 bottom-0 size-8 min-h-8 border border-current bg-transparent p-0 text-base-content/60 hover:border-current hover:bg-transparent hover:text-base-content focus-visible:border-current focus-visible:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={`${labels.motion} ${labels.reset}`}
              title={`${labels.motion} ${labels.reset}`}
              onpointerdown={preventOptionFocus}
              onclick={clearMotion}
            >
              <Icon icon="mdi:close" class="size-4" aria-hidden="true" />
            </button>
          {/if}
          {#if motionOpen && filteredMotions.length > 0}
            <ul
              id={`${uid}-motion-options`}
              class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-base-content/10 bg-base-100 p-1 shadow-lg"
              role="listbox"
              aria-label={labels.motion}
            >
              {#each filteredMotions as motion, index (`${motion}-${index}`)}
                <li
                  id={`${uid}-motion-option-${index}`}
                  class="rounded-lg"
                  role="option"
                  aria-selected={motionActiveIndex === index}
                >
                  <button
                    type="button"
                    class={`flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${motionActiveIndex === index ? "bg-primary/10 text-primary" : "text-base-content hover:bg-base-content/5"}`}
                    onpointerdown={preventOptionFocus}
                    onpointerenter={() => (motionActiveIndex = index)}
                    onclick={() => selectMotion(motion)}
                  >
                    {motion}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        <button
          type="button"
          class="btn btn-primary btn-sm h-11 min-h-11! shrink-0 px-3 text-sm"
          disabled={!controlsEnabled || !motionSelectionAvailable || selectedMotion === ""}
          onclick={onApplyMotion}
        >
          {labels.apply}
        </button>
      </div>

      <div class="flex min-w-0 items-end gap-2" onfocusout={handleExpressionFocusOut}>
        <div class="relative min-w-0 flex-1">
          <label class="flex min-w-0 flex-col gap-1.5" for={`${uid}-expression`}>
            <span class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
              {labels.expression}
            </span>
            <input
              id={`${uid}-expression`}
              class="input input-bordered min-h-11 w-full min-w-0 bg-base-100 pr-11"
              type="text"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={expressionOpen && filteredExpressions.length > 0}
              aria-controls={`${uid}-expression-options`}
              aria-activedescendant={expressionActiveIndex >= 0
                ? `${uid}-expression-option-${expressionActiveIndex}`
                : undefined}
              placeholder={expressions.length > 0 ? labels.expressionEmpty : labels.noneLoaded}
              disabled={!controlsEnabled}
              bind:this={expressionInput}
              bind:value={selectedExpression}
              onfocus={openExpressionSelector}
              onclick={openExpressionSelector}
              oninput={handleExpressionInput}
              onkeydown={handleExpressionKeydown}
            />
          </label>
          {#if controlsEnabled && selectedExpression !== ""}
            <button
              type="button"
              class="btn btn-circle absolute right-0 bottom-0 size-8 min-h-8 border border-current bg-transparent p-0 text-base-content/60 hover:border-current hover:bg-transparent hover:text-base-content focus-visible:border-current focus-visible:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={`${labels.expression} ${labels.reset}`}
              title={`${labels.expression} ${labels.reset}`}
              onpointerdown={preventOptionFocus}
              onclick={clearExpression}
            >
              <Icon icon="mdi:close" class="size-4" aria-hidden="true" />
            </button>
          {/if}
          {#if expressionOpen && filteredExpressions.length > 0}
            <ul
              id={`${uid}-expression-options`}
              class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-base-content/10 bg-base-100 p-1 shadow-lg"
              role="listbox"
              aria-label={labels.expression}
            >
              {#each filteredExpressions as expression, index (`${expression}-${index}`)}
                <li
                  id={`${uid}-expression-option-${index}`}
                  class="rounded-lg"
                  role="option"
                  aria-selected={expressionActiveIndex === index}
                >
                  <button
                    type="button"
                    class={`flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${expressionActiveIndex === index ? "bg-primary/10 text-primary" : "text-base-content hover:bg-base-content/5"}`}
                    onpointerdown={preventOptionFocus}
                    onpointerenter={() => (expressionActiveIndex = index)}
                    onclick={() => selectExpression(expression)}
                  >
                    {expression}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
        <button
          type="button"
          class="btn btn-primary btn-sm h-11 min-h-11! shrink-0 px-3 text-sm"
          disabled={!controlsEnabled || !expressionSelectionAvailable || selectedExpression === ""}
          onclick={onApplyExpression}
        >
          {labels.apply}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
        <button
          type="button"
          class="btn btn-outline btn-sm h-11 min-h-11! shrink-0 px-3 text-sm"
          disabled={!controlsEnabled}
          aria-pressed={paused}
          data-playback-icon={paused ? "play" : "pause"}
          onclick={paused ? onResume : onPause}
        >
          <Icon icon={paused ? "mdi:play" : "mdi:pause"} class="size-4" aria-hidden="true" />
          {paused ? labels.resume : labels.pause}
        </button>
        <label class="flex min-h-11 shrink-0 items-center gap-2 px-1 text-sm font-medium">
          <input
            type="checkbox"
            class="toggle toggle-primary"
            disabled={!controlsEnabled}
            bind:checked={idleMotion}
          />
          {labels.idleBreath}
        </label>
        <button
          type="button"
          class="btn btn-outline btn-sm h-11 min-h-11! shrink-0 px-3 text-sm"
          disabled={!controlsEnabled}
          onclick={onReset}
        >
          <Icon icon="mdi:restart" class="size-4" aria-hidden="true" />
          {labels.reset}
        </button>
        <button
          type="button"
          class="btn btn-outline btn-sm h-11 min-h-11! shrink-0 px-3 text-sm"
          disabled={!controlsEnabled}
          onclick={onReload}
        >
          <Icon icon="mdi:reload" class="size-4" aria-hidden="true" />
          {labels.reload}
        </button>
      </div>
    </div>
  </section>

  <div>
    <div
      class="relative aspect-video w-full overflow-hidden rounded-2xl border border-base-content/10 bg-neutral text-neutral-content shadow-sm"
    >
      {#if stage}
        {@render stage()}
      {:else}
        <!-- Reserved-stage placeholder: purely visual, the adapter owns the
             accessible canvas once mounted. -->
        <div class="absolute inset-0 grid place-items-center" aria-hidden="true">
          <div
            class="absolute inset-0 bg-[radial-gradient(closest-side,rgba(255,255,255,0.07),transparent)]"
          ></div>
          <Icon icon="mdi:drama-masks" class="relative size-10 opacity-40" aria-hidden="true" />
        </div>
      {/if}
    </div>
    <p class="mt-2 text-sm text-base-content/60" role="status">{statusLine}</p>
  </div>
</div>
