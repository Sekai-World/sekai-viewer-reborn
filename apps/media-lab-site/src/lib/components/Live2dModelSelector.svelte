<script lang="ts">
  import Icon from "@iconify/svelte";
  import {
    resolveModelSelection,
    type Live2dModelOption
  } from "$lib/live2d/model-catalog";

  /** Localized labels, resolved by the hosting route's translator. */
  export interface Live2dModelSelectorLabels {
    /** Per-card state badge; every catalog entry is a placeholder. */
    previewBadge: string;
    inputLabel: string;
    inputPlaceholder: string;
    inputHint: string;
    inputError: string;
    inputAction: string;
    empty: string;
  }

  interface Props {
    models: readonly Live2dModelOption[];
    labels: Live2dModelSelectorLabels;
    /** Model ID currently shown by a viewer page, if embedded there. */
    activeModelId?: string;
    /**
     * Navigation seam for the model-ID input. Card anchors navigate natively;
     * the host wires this (typically `goto`) so the component stays
     * routing-free.
     */
    onOpenModel?: (modelId: string) => void;
  }

  let { models, labels, activeModelId = "", onOpenModel }: Props = $props();

  const uid = $props.id();

  let draftModelId = $state("");

  const trimmedDraft = $derived(draftModelId.trim());
  const selection = $derived(resolveModelSelection(trimmedDraft, models));
  const canOpenDraft = $derived(selection.status !== "invalid");
  const showDraftError = $derived(trimmedDraft.length > 0 && !canOpenDraft);
  // Visual-only cue linking a typed known ID back to its catalog card; the
  // surrounding hint text keeps the state understandable without it.
  const suggestedModelId = $derived(selection.status === "known" ? selection.modelId : "");

  const openDraft = (event: SubmitEvent): void => {
    event.preventDefault();
    if (selection.status === "invalid") return;
    onOpenModel?.(selection.modelId);
  };
</script>

<div class="flex flex-col gap-4">
  {#if models.length === 0}
    <p
      class="rounded-xl border border-dashed border-base-content/15 bg-base-content/[0.03] p-6 text-center text-sm text-base-content/60"
    >
      {labels.empty}
    </p>
  {:else}
    <ul class="grid gap-3 sm:grid-cols-2" role="list">
      {#each models as model (model.id)}
        {@const isActive = model.id === activeModelId}
        {@const isSuggested = model.id === suggestedModelId}
        <li>
          <a
            href={`/live2d/${model.id}`}
            aria-current={isActive ? "true" : undefined}
            class={`group flex h-full items-start gap-3 rounded-xl border p-4 shadow-sm transition-colors duration-150 hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isActive ? "border-primary/60 bg-primary/[0.06] ring-1 ring-primary/40" : isSuggested ? "border-primary/40 ring-1 ring-primary/25" : "border-base-content/10 bg-base-100"}`}
          >
            <span
              class="grid size-10 shrink-0 place-items-center rounded-lg border border-base-content/10 bg-base-content/5 text-base-content/60 transition-colors duration-150 group-hover:text-primary"
              aria-hidden="true"
            >
              <Icon icon="mdi:cube-outline" class="size-5" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="font-semibold text-base-content">{model.title}</span>
                <span class="badge badge-outline badge-warning badge-sm gap-1 font-medium">
                  <Icon icon="mdi:flask-outline" class="size-3" aria-hidden="true" />
                  {labels.previewBadge}
                </span>
              </span>
              <span class="text-sm/6 text-base-content/70">{model.description}</span>
              <span class="font-mono text-xs break-all text-base-content/50">{model.id}</span>
            </span>
            <Icon
              icon="mdi:arrow-right"
              class="mt-1 size-4 shrink-0 text-primary opacity-0 transition-opacity duration-150 group-focus-visible:opacity-100 group-hover:opacity-100"
              aria-hidden="true"
            />
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  <form
    class="flex flex-col gap-2 rounded-xl border border-base-content/10 bg-base-content/[0.03] p-4"
    onsubmit={openDraft}
  >
    <label
      class="text-xs font-semibold tracking-wide text-base-content/60 uppercase"
      for={`${uid}-model-id`}
    >
      {labels.inputLabel}
    </label>
    <div class="flex flex-col gap-2 sm:flex-row">
      <input
        id={`${uid}-model-id`}
        type="text"
        class="input min-h-11 w-full flex-1 bg-base-100 font-mono text-sm"
        bind:value={draftModelId}
        placeholder={labels.inputPlaceholder}
        autocomplete="off"
        spellcheck="false"
        aria-invalid={showDraftError || undefined}
        aria-describedby={showDraftError ? `${uid}-model-id-error` : `${uid}-model-id-hint`}
      />
      <button type="submit" class="btn btn-primary btn-sm min-h-11! px-4" disabled={!canOpenDraft}>
        {labels.inputAction}
        <Icon icon="mdi:arrow-right" class="size-4" aria-hidden="true" />
      </button>
    </div>
    {#if showDraftError}
      <p id={`${uid}-model-id-error`} role="alert" class="flex items-center gap-1 text-sm text-error">
        <Icon icon="mdi:alert-circle-outline" class="size-4 shrink-0" aria-hidden="true" />
        {labels.inputError}
      </p>
    {:else}
      <p id={`${uid}-model-id-hint`} class="text-sm/6 text-base-content/60">
        {labels.inputHint}
      </p>
    {/if}
  </form>
</div>
