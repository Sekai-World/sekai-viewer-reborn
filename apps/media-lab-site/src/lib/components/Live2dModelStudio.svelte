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
    loop: string;
    speed: string;
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
    loop?: boolean;
    speed?: number;
    /**
     * Lifecycle insertion point: the model player adapter renders its canvas
     * host here. When absent, the studio shows its reserved-stage placeholder.
     */
    stage?: Snippet<[]>;
    onApplyMotion?: () => void;
    onApplyExpression?: () => void;
    onPause?: () => void;
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
    loop = $bindable(false),
    speed = $bindable(1),
    stage,
    onApplyMotion,
    onApplyExpression,
    onPause,
    onReset,
    onReload
  }: Props = $props();

  const uid = $props.id();
</script>

<div class="flex flex-col gap-4">
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
          >
          </div>
          <Icon icon="mdi:drama-masks" class="relative size-10 opacity-40" aria-hidden="true" />
        </div>
      {/if}
    </div>
    <p class="mt-2 text-sm text-base-content/60" role="status">{statusLine}</p>
  </div>

  <div class="card bg-base-100 shadow-sm ring-1 ring-base-content/10">
    <div class="card-body gap-4 p-5 sm:p-6">
      <h3 class="card-title text-lg">{labels.controlsTitle}</h3>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <label
            class="text-xs font-semibold tracking-wide text-base-content/60 uppercase"
            for={`${uid}-motion`}
          >
            {labels.motion}
          </label>
          <select
            id={`${uid}-motion`}
            class="select min-h-11 w-full bg-base-100"
            disabled={!controlsEnabled}
            bind:value={selectedMotion}
          >
            <option value="">
              {motions.length > 0 ? labels.motionEmpty : labels.noneLoaded}
            </option>
            {#each motions as motion (motion)}
              <option value={motion}>{motion}</option>
            {/each}
          </select>
          <button
            type="button"
            class="btn btn-primary btn-sm min-h-11! px-4"
            disabled={!controlsEnabled || selectedMotion === ""}
            onclick={onApplyMotion}
          >
            {labels.apply}
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <label
            class="text-xs font-semibold tracking-wide text-base-content/60 uppercase"
            for={`${uid}-expression`}
          >
            {labels.expression}
          </label>
          <select
            id={`${uid}-expression`}
            class="select min-h-11 w-full bg-base-100"
            disabled={!controlsEnabled}
            bind:value={selectedExpression}
          >
            <option value="">
              {expressions.length > 0 ? labels.expressionEmpty : labels.noneLoaded}
            </option>
            {#each expressions as expression (expression)}
              <option value={expression}>{expression}</option>
            {/each}
          </select>
          <button
            type="button"
            class="btn btn-primary btn-sm min-h-11! px-4"
            disabled={!controlsEnabled || selectedExpression === ""}
            onclick={onApplyExpression}
          >
            {labels.apply}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          class="btn btn-outline btn-sm min-h-11! px-4"
          disabled={!controlsEnabled}
          onclick={onPause}
        >
          <Icon icon="mdi:pause" class="size-4" aria-hidden="true" />
          {labels.pause}
        </button>
        <label class="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            class="toggle toggle-primary"
            disabled={!controlsEnabled}
            bind:checked={loop}
          />
          {labels.loop}
        </label>
        <label class="flex min-h-11 items-center gap-3 text-sm font-medium">
          {labels.speed}
          <select
            class="select min-h-11 w-24 bg-base-100"
            disabled={!controlsEnabled}
            bind:value={speed}
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <label class="flex min-h-11 items-center gap-3 text-sm font-medium">
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
          class="btn btn-outline btn-sm min-h-11! px-4"
          disabled={!controlsEnabled}
          onclick={onReset}
        >
          <Icon icon="mdi:restart" class="size-4" aria-hidden="true" />
          {labels.reset}
        </button>
        <button
          type="button"
          class="btn btn-outline btn-sm min-h-11! px-4"
          disabled={!controlsEnabled}
          onclick={onReload}
        >
          <Icon icon="mdi:reload" class="size-4" aria-hidden="true" />
          {labels.reload}
        </button>
      </div>

      {#if !controlsEnabled}
        <p class="text-sm/6 text-base-content/60">{labels.controlsHint}</p>
      {/if}
    </div>
  </div>
</div>
