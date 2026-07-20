<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import Icon from "@iconify/svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { VirtualLiveSetlist } from "$lib/domain/virtual-live";
  import type { VirtualLiveTimelineDocument } from "$lib/domain/virtual-live-timeline";
  import VirtualLiveSetlistMusicPlayer from "$lib/components/virtual-live/VirtualLiveSetlistMusicPlayer.svelte";
  import VirtualLiveTimelinePanel from "$lib/components/virtual-live/VirtualLiveTimelinePanel.svelte";

  type TimelineState = {
    status: "loading" | "error" | "ready";
    document: VirtualLiveTimelineDocument | null;
  };

  let {
    setlists,
    region,
    virtualLiveId,
    title,
    closeLabel,
    t,
    formatType
  }: {
    setlists: VirtualLiveSetlist[];
    region: SupportedRegion;
    virtualLiveId: string;
    title: string;
    closeLabel: string;
    t: (key: string, fallback?: string) => string;
    formatType: (value: string | null) => string;
  } = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  let expandedId = $state<number | null>(null);
  let timelineStates = $state<Record<number, TimelineState>>({});
  let timelineController: AbortController | null = null;
  let lastTrigger: HTMLElement | null = null;
  const dialogId = "virtual-live-setlist-dialog";
  const titleId = `${dialogId}-title`;
  const orderedSetlists = $derived(
    [...setlists].sort(
      (a, b) => (a.seq ?? Number.MAX_SAFE_INTEGER) - (b.seq ?? Number.MAX_SAFE_INTEGER)
    )
  );
  const countText = $derived(
    t("virtualLiveSetlistItemCount").replace("{count}", String(setlists.length))
  );
  const getRowId = (setlist: VirtualLiveSetlist, index: number): number =>
    setlist.id ?? -(index + 1);
  const hasTimeline = (setlist: VirtualLiveSetlist): boolean =>
    setlist.virtualLiveSetlistType === "mc" || setlist.virtualLiveSetlistType === "mc_timeline";
  const getTitle = (setlist: VirtualLiveSetlist): string => {
    if (setlist.music?.title) return setlist.music.title;
    if (setlist.virtualLiveSetlistType === "mc_timeline")
      return t("virtualLiveSetlistTimelineTitle");
    return formatType(setlist.virtualLiveSetlistType);
  };
  const open = (event: MouseEvent): void => {
    lastTrigger = event.currentTarget as HTMLElement;
    dialog?.showModal();
  };
  const close = (): void => dialog?.close();
  const handleClose = (): void => {
    timelineController?.abort();
    timelineController = null;
    expandedId = null;
    void tick().then(() => lastTrigger?.focus());
  };
  const loadTimeline = async (setlistId: number, force = false): Promise<void> => {
    if (!force && timelineStates[setlistId]?.status === "ready") return;
    timelineController?.abort();
    const controller = new AbortController();
    timelineController = controller;
    timelineStates = { ...timelineStates, [setlistId]: { status: "loading", document: null } };
    try {
      const response = await fetch(
        `/virtual-live/${region}/${virtualLiveId}/timeline/${setlistId}`,
        {
          signal: controller.signal
        }
      );
      if (!response.ok) throw new Error("timeline");
      const document = (await response.json()) as VirtualLiveTimelineDocument;
      if (!controller.signal.aborted) {
        timelineStates = { ...timelineStates, [setlistId]: { status: "ready", document } };
      }
    } catch {
      if (!controller.signal.aborted) {
        timelineStates = { ...timelineStates, [setlistId]: { status: "error", document: null } };
      }
    } finally {
      if (timelineController === controller) timelineController = null;
    }
  };
  const toggle = (setlist: VirtualLiveSetlist, index: number): void => {
    const rowId = getRowId(setlist, index);
    if (expandedId === rowId) {
      timelineController?.abort();
      timelineController = null;
      expandedId = null;
      return;
    }
    timelineController?.abort();
    timelineController = null;
    expandedId = rowId;
    if (hasTimeline(setlist) && setlist.id !== null) {
      void loadTimeline(setlist.id);
    }
  };

  onDestroy(() => timelineController?.abort());
</script>

<div class="content-card-inset overflow-hidden rounded-xl">
  <div class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
    <div>
      <p class="text-sm font-semibold">{countText}</p>
      <p class="mt-0.5 text-xs opacity-55">{t("virtualLiveSetlistPreviewLabel")}</p>
    </div>
    <button
      type="button"
      class="btn btn-primary btn-sm"
      aria-haspopup="dialog"
      aria-controls={dialogId}
      onclick={open}
    >
      {t("virtualLiveSetlistViewFullButton")}<Icon
        icon="mdi:playlist-check"
        class="size-4"
        aria-hidden="true"
      />
    </button>
  </div>
  <ol class="border-t border-base-content/8 px-3 py-2 sm:px-4">
    {#each orderedSetlists.slice(0, 3) as setlist, index (getRowId(setlist, index))}
      <li class="flex items-center gap-2 py-1.5 text-xs">
        <span class="font-mono font-bold opacity-55">{setlist.seq ?? index + 1}</span><span
          class="truncate font-medium">{getTitle(setlist)}</span
        >
      </li>
    {/each}
  </ol>
</div>

<dialog
  bind:this={dialog}
  id={dialogId}
  class="modal"
  aria-labelledby={titleId}
  onclose={handleClose}
  onclick={(event) => {
    if (event.target === event.currentTarget) close();
  }}
>
  <div
    class="modal-box flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-5xl flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)]"
  >
    <header
      class="flex items-start justify-between gap-4 border-b border-base-content/10 p-4 sm:px-5"
    >
      <div>
        <h2 id={titleId} class="text-xl font-bold">{title}</h2>
        <p class="text-xs opacity-55">{countText}</p>
      </div>
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-sm"
        aria-label={closeLabel}
        onclick={close}><Icon icon="mdi:close" class="size-5" aria-hidden="true" /></button
      >
    </header>
    <ol class="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 sm:p-5">
      {#each orderedSetlists as setlist, index (getRowId(setlist, index))}
        {@const rowId = getRowId(setlist, index)}
        {@const expanded = expandedId === rowId}
        <li
          class={`rounded-xl border transition-colors ${expanded ? "border-primary/30 bg-primary/[0.035]" : "border-base-content/10 bg-base-100/40"}`}
        >
          <button
            type="button"
            class="flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left"
            aria-label={expanded
              ? t("virtualLiveSetlistCollapseStep")
              : t("virtualLiveSetlistExpandStep")}
            aria-expanded={expanded}
            aria-controls={`${dialogId}-row-${rowId}`}
            onclick={() => toggle(setlist, index)}
          >
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full bg-base-200 font-mono text-xs font-bold"
              >{setlist.seq ?? index + 1}</span
            >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{getTitle(setlist)}</p>
              <p class="text-xs opacity-55">{formatType(setlist.virtualLiveSetlistType)}</p>
            </div>
            <span class="btn btn-circle btn-ghost btn-sm pointer-events-none" aria-hidden="true">
              <Icon icon={expanded ? "mdi:chevron-up" : "mdi:chevron-down"} class="size-5" />
            </span>
          </button>
          {#if expanded}
            <div id={`${dialogId}-row-${rowId}`} class="border-t border-base-content/8 p-3 sm:p-4">
              {#if setlist.music}
                <VirtualLiveSetlistMusicPlayer music={setlist.music} {region} {t} />
              {:else if hasTimeline(setlist) && setlist.id !== null}
                {@const state = timelineStates[setlist.id] ?? {
                  status: "loading" as const,
                  document: null
                }}
                <VirtualLiveTimelinePanel
                  document={state.document}
                  status={state.status}
                  retry={() => void loadTimeline(setlist.id!, true)}
                  {t}
                />
              {:else}
                <p class="text-sm opacity-60">{t("virtualLiveSetlistNoDetails")}</p>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</dialog>
