<script lang="ts">
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { VirtualLiveSetlist } from "$lib/domain/virtual-live";

  let {
    setlists,
    region,
    title,
    countLabel,
    previewLabel,
    viewFullLabel,
    closeLabel,
    musicLabel,
    vocalLabel,
    stageLabel,
    assetLabel,
    character3dLabel,
    unavailableLabel,
    formatType
  }: {
    setlists: VirtualLiveSetlist[];
    region: SupportedRegion;
    title: string;
    countLabel: string;
    previewLabel: string;
    viewFullLabel: string;
    closeLabel: string;
    musicLabel: string;
    vocalLabel: string;
    stageLabel: string;
    assetLabel: string;
    character3dLabel: string;
    unavailableLabel: string;
    formatType: (value: string | null) => string;
  } = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  const dialogId = "virtual-live-setlist-dialog";
  const titleId = `${dialogId}-title`;
  const orderedSetlists = $derived(
    [...setlists].sort(
      (left, right) =>
        (left.seq ?? Number.MAX_SAFE_INTEGER) - (right.seq ?? Number.MAX_SAFE_INTEGER)
    )
  );
  const previewItems = $derived(orderedSetlists.slice(0, 3));
  const formatCount = (): string => countLabel.replace("{count}", String(setlists.length));
  const getCharacter3dIds = (setlist: VirtualLiveSetlist): number[] =>
    [
      setlist.character3dId1,
      setlist.character3dId2,
      setlist.character3dId3,
      setlist.character3dId4,
      setlist.character3dId5,
      setlist.character3dId6
    ].filter((id): id is number => id !== null);
  const close = (): void => dialog?.close();
  const closeFromBackdrop = (event: MouseEvent): void => {
    if (event.target === event.currentTarget) close();
  };
</script>

<div class="content-card-inset overflow-hidden rounded-xl">
  <div class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
    <div class="min-w-0">
      <p class="text-sm font-semibold">{formatCount()}</p>
      <p class="mt-0.5 text-xs opacity-55">{previewLabel}</p>
    </div>
    <button
      type="button"
      class="btn btn-primary btn-sm shrink-0 gap-1.5"
      aria-haspopup="dialog"
      aria-controls={dialogId}
      onclick={() => dialog?.showModal()}
    >
      {viewFullLabel}
      <Icon icon="mdi:playlist-check" class="size-4" aria-hidden="true" />
    </button>
  </div>

  <ol class="border-t border-base-content/8 px-3 py-2 sm:px-4">
    {#each previewItems as setlist, index (setlist.id ?? index)}
      <li class="flex min-w-0 items-center gap-2 py-1.5 text-xs">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full bg-base-100 font-mono text-[0.65rem] font-bold opacity-65"
        >
          {setlist.seq ?? index + 1}
        </span>
        <span class="badge badge-sm shrink-0 font-semibold"
          >{formatType(setlist.virtualLiveSetlistType)}</span
        >
        <span class="min-w-0 truncate opacity-60">
          {setlist.musicId !== null
            ? `${musicLabel} #${setlist.musicId}`
            : (setlist.assetBundleName ?? unavailableLabel)}
        </span>
      </li>
    {/each}
  </ol>
</div>

<dialog
  bind:this={dialog}
  id={dialogId}
  class="modal"
  aria-labelledby={titleId}
  onclick={closeFromBackdrop}
>
  <div
    class="modal-box flex max-h-[min(92dvh,52rem)] w-[calc(100%-1rem)] max-w-4xl flex-col overflow-hidden p-0 sm:w-[calc(100%-2rem)]"
  >
    <header
      class="flex shrink-0 items-start justify-between gap-4 border-b border-base-content/10 p-4 sm:px-5"
    >
      <div>
        <h2 id={titleId} class="text-lg font-bold sm:text-xl">{title}</h2>
        <p class="mt-0.5 text-xs opacity-55">{formatCount()}</p>
      </div>
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-sm"
        aria-label={closeLabel}
        onclick={close}
      >
        <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
      </button>
    </header>

    <ol class="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 sm:p-5">
      {#each orderedSetlists as setlist, index (setlist.id ?? index)}
        {@const characterIds = getCharacter3dIds(setlist)}
        <li class="content-card-inset rounded-xl p-3">
          <div class="flex min-w-0 items-center gap-2">
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full bg-base-100 font-mono text-xs font-bold"
            >
              {setlist.seq ?? index + 1}
            </span>
            <span
              class={`badge badge-sm font-semibold ${setlist.virtualLiveSetlistType === "music" ? "badge-primary" : "badge-outline"}`}
            >
              {formatType(setlist.virtualLiveSetlistType)}
            </span>
            {#if setlist.musicId !== null}
              <a
                href={resolve("/music/[region]/[id]", { region, id: String(setlist.musicId) })}
                class="min-w-0 truncate text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
                >{musicLabel} #{setlist.musicId}</a
              >
            {/if}
          </div>

          {#if setlist.musicVocalId !== null || setlist.virtualLiveStageId !== null || setlist.assetBundleName || characterIds.length > 0}
            <dl
              class="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-base-content/8 pt-2 text-[0.68rem] opacity-60"
            >
              {#if setlist.musicVocalId !== null}<div class="flex gap-1">
                  <dt>{vocalLabel}</dt>
                  <dd class="font-mono">#{setlist.musicVocalId}</dd>
                </div>{/if}
              {#if setlist.virtualLiveStageId !== null}<div class="flex gap-1">
                  <dt>{stageLabel}</dt>
                  <dd class="font-mono">#{setlist.virtualLiveStageId}</dd>
                </div>{/if}
              {#if setlist.assetBundleName}<div class="flex min-w-0 gap-1">
                  <dt>{assetLabel}</dt>
                  <dd class="wrap-break-word font-mono">{setlist.assetBundleName}</dd>
                </div>{/if}
              {#if characterIds.length > 0}<div class="flex gap-1">
                  <dt>{character3dLabel}</dt>
                  <dd class="font-mono">{characterIds.map((id) => `#${id}`).join(", ")}</dd>
                </div>{/if}
            </dl>
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</dialog>
