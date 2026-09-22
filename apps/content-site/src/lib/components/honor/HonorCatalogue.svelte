<script lang="ts">
  import { onMount, tick, type ComponentProps } from "svelte";
  import Icon from "@iconify/svelte";
  import CatalogueFrame from "$lib/components/mission/CatalogueFrame.svelte";
  import HonorSummary from "./HonorSummary.svelte";
  import HonorArtwork from "./HonorArtwork.svelte";
  import type { CatalogueHonorDegree } from "$lib/honor-degree";
  import type { HonorDegreeAssetResolver } from "@platform/ui-shell";

  export type HonorCatalogueGroup = {
    key: string;
    name: string;
    degree?: CatalogueHonorDegree;
    countLabel: string;
    members: {
      key: string;
      name: string;
      variantLabel?: string;
      degree: CatalogueHonorDegree;
      levels: { label: string; description: string | null }[];
    }[];
  };
  let {
    items,
    catalogueKey,
    imageUnavailableLabel,
    levelsLabel,
    closeLabel = "Close",
    honorTypes = [],
    selectedHonorType = null,
    categoryLabel,
    getHonorTypeLabel,
    onHonorTypeChange,
    resolveAsset,
    ...frame
  }: Omit<ComponentProps<typeof CatalogueFrame>, "children" | "empty" | "loadingPlaceholder"> & {
    items: HonorCatalogueGroup[];
    catalogueKey: string;
    imageUnavailableLabel: string;
    levelsLabel: string;
    closeLabel?: string;
    honorTypes?: string[];
    selectedHonorType?: string | null;
    categoryLabel?: string;
    getHonorTypeLabel?: (honorType: string | null) => string;
    onHonorTypeChange?: (honorType: string | null) => void;
    resolveAsset: HonorDegreeAssetResolver;
  } = $props();

  let dialogViewport = $state(false);
  let dialog: HTMLDialogElement | null = $state(null);
  let activeGroupKey = $state<string | null>(null);
  let lastTrigger: HTMLButtonElement | null = null;
  let previousCatalogueKey = $state<string | null>(null);
  const activeGroup = $derived(items.find((group) => group.key === activeGroupKey) ?? null);
  const categoryTypes = $derived([
    ...new Set(honorTypes.filter((honorType) => honorType.trim().length > 0))
  ]);
  const dialogId = $derived(`honor-group-dialog-${catalogueKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`);
  const dialogTitleId = $derived(`${dialogId}-title`);

  const restoreFocus = (trigger: HTMLButtonElement | null): void => {
    void tick().then(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  };

  const handleDialogClose = (): void => {
    const trigger = lastTrigger;
    lastTrigger = null;
    activeGroupKey = null;
    restoreFocus(trigger);
  };

  const closeDialog = (): void => {
    if (!dialog) {
      if (activeGroupKey !== null) handleDialogClose();
      return;
    }

    if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
      return;
    }

    if (dialog.open) dialog.removeAttribute("open");
    handleDialogClose();
  };

  const openDialog = async (event: MouseEvent, group: HonorCatalogueGroup): Promise<void> => {
    if (!dialogViewport || !dialog) return;

    lastTrigger = event.currentTarget as HTMLButtonElement;
    activeGroupKey = group.key;
    await tick();
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
  };

  onMount(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = (): void => {
      if (!mediaQuery.matches) closeDialog();
      dialogViewport = mediaQuery.matches;
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  });

  $effect(() => {
    if (previousCatalogueKey === null) {
      previousCatalogueKey = catalogueKey;
      return;
    }
    if (catalogueKey === previousCatalogueKey) return;
    previousCatalogueKey = catalogueKey;
    closeDialog();
  });
</script>

{#snippet identity(group: HonorCatalogueGroup)}
  <HonorSummary
    name={group.name}
    degree={group.degree}
    {resolveAsset}
    {imageUnavailableLabel}
    compact
  />
  {#if group.members.length > 1}
    <p class="mt-2 text-sm font-normal text-(--archive-text-muted)">{group.countLabel}</p>
  {/if}
{/snippet}

{#snippet members(group: HonorCatalogueGroup)}
  <ul class="min-w-0 divide-y divide-(--archive-border-subtle)">
    {#each group.members as member (member.key)}
      {@const label = member.variantLabel ?? member.name}
      <li class="min-w-0 space-y-3 py-4 first:pt-0 last:pb-0">
        {#if group.members.length > 1 || label !== group.name}
          <h3 class="font-semibold wrap-anywhere text-(--archive-text-strong)">{label}</h3>
        {/if}
        {#if group.members.length > 1}
          <HonorArtwork
            degree={member.degree}
            {resolveAsset}
            label={member.name}
            {imageUnavailableLabel}
          />
        {/if}
        {#if member.levels.length}
          <dl aria-label={levelsLabel} class="space-y-3 text-sm">
            {#each member.levels as level, index (index)}
              <div class="grid min-w-0 gap-1 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-3">
                <dt class="font-semibold wrap-anywhere text-(--archive-text-default)">
                  {level.label}
                </dt>
                {#if level.description}
                  <dd class="whitespace-pre-line wrap-anywhere text-(--archive-text-muted)">
                    {level.description}
                  </dd>
                {/if}
              </div>
            {/each}
          </dl>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<CatalogueFrame {...frame} empty={false}>
  {#snippet loadingPlaceholder()}
    <div class="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {#each Array.from({ length: 12 }) as _, index (index)}
        <div class="content-card-shell min-h-32 rounded-2xl p-4">
          <div class="h-14 w-full max-w-67 rounded-lg bg-(--archive-surface-sunken)"></div>
          <div class="mt-3 h-4 w-3/4 rounded bg-(--archive-surface-sunken)"></div>
        </div>
      {/each}
    </div>
  {/snippet}
  {#key catalogueKey}
    {#if categoryLabel && getHonorTypeLabel && onHonorTypeChange}
      <div class="mb-4 border-b border-(--archive-border-subtle) pb-3">
        <div class="flex min-w-0 flex-wrap gap-2" role="tablist" aria-label={categoryLabel}>
          <button
            type="button"
            class:btn-primary={selectedHonorType === null}
            class:btn-ghost={selectedHonorType !== null}
            class="btn min-h-11 max-w-full rounded-xl whitespace-normal wrap-break-word"
            role="tab"
            aria-selected={selectedHonorType === null}
            onclick={() => onHonorTypeChange?.(null)}
          >
            {getHonorTypeLabel(null)}
          </button>
          {#each categoryTypes as honorType (honorType)}
            <button
              type="button"
              class:btn-primary={selectedHonorType === honorType}
              class:btn-ghost={selectedHonorType !== honorType}
              class="btn min-h-11 max-w-full rounded-xl whitespace-normal wrap-break-word"
              role="tab"
              aria-selected={selectedHonorType === honorType}
              onclick={() => onHonorTypeChange?.(honorType)}
            >
              {getHonorTypeLabel(honorType)}
            </button>
          {/each}
        </div>
      </div>
    {/if}
    {#if items.length === 0}
      <p
        class="flex min-h-48 items-center justify-center p-4 text-center text-(--archive-text-muted)"
        role="status"
      >
        {frame.labels.empty}
      </p>
    {:else}
      <div class="grid min-w-0 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {#each items as group (group.key)}
          {#if group.members.length > 1}
            {#if dialogViewport}
              <button
                type="button"
                class="content-card-shell block min-w-0 cursor-pointer rounded-2xl p-4 text-left outline-none transition-[transform,border-color,background-color,box-shadow] duration-180 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-(--archive-surface-raised) hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                aria-haspopup="dialog"
                aria-controls={dialogId}
                aria-expanded={activeGroupKey === group.key}
                onclick={(event) => void openDialog(event, group)}
              >
                {@render identity(group)}
              </button>
            {:else}
              <details class="collapse collapse-arrow content-card-shell min-w-0 rounded-2xl">
                <summary
                  class="collapse-title min-h-11 p-4 pe-12 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary"
                >
                  {@render identity(group)}
                </summary>
                <div class="collapse-content min-w-0 px-4">
                  <div class="border-t border-(--archive-border-subtle) pt-4">
                    {@render members(group)}
                  </div>
                </div>
              </details>
            {/if}
          {:else}
            <article class="card content-card-shell min-w-0 gap-4 p-4">
              <header>{@render identity(group)}</header>
              <div class="min-w-0 border-t border-(--archive-border-subtle) pt-4">
                {@render members(group)}
              </div>
            </article>
          {/if}
        {/each}
      </div>

      {#if dialogViewport}
        <dialog
          bind:this={dialog}
          id={dialogId}
          class="modal"
          aria-labelledby={dialogTitleId}
          onclose={handleDialogClose}
          onkeydown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeDialog();
            }
          }}
          onclick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            class="modal-box flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)]"
          >
            {#if activeGroup}
              <header
                class="flex shrink-0 items-start justify-between gap-4 border-b border-(--archive-border-subtle) p-4 sm:p-5"
              >
                <div class="min-w-0">
                  <h2
                    id={dialogTitleId}
                    class="wrap-anywhere text-xl font-bold text-(--archive-text-strong)"
                  >
                    {activeGroup.name}
                  </h2>
                  <p class="mt-1 text-sm text-(--archive-text-muted)">{activeGroup.countLabel}</p>
                </div>
                <button
                  type="button"
                  class="btn btn-circle btn-ghost btn-sm min-h-11 w-11 shrink-0"
                  aria-label={closeLabel}
                  title={closeLabel}
                  onclick={closeDialog}
                >
                  <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
                </button>
              </header>
              <div class="min-h-0 overflow-y-auto p-4 sm:p-5">
                {@render members(activeGroup)}
              </div>
            {/if}
          </div>
          <form
            method="dialog"
            class="modal-backdrop"
            onsubmit={(event) => {
              event.preventDefault();
              closeDialog();
            }}
          >
            <button type="submit" aria-label={closeLabel}></button>
          </form>
        </dialog>
      {/if}
    {/if}
  {/key}
</CatalogueFrame>
