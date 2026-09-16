<script lang="ts">
  import Icon from "@iconify/svelte";
  import { resolveUnitLogoUrl } from "@platform/ui-shell";
  import { goto } from "$app/navigation";
  import { useRegionSelection } from "$lib/region-selection.svelte";
  import {
    readRememberedStoryReaderMode,
    rememberStoryReaderMode,
    type StoryReaderMode
  } from "$lib/story/story-reader-mode";

  /**
   * Story picker for one story type sub-page. The region follows the shared
   * primary-region setting; type navigation lives in the sidebar. Unit
   * stories use a two-level picker (unit blocks → story lines of episode
   * cards); the other types keep a grouped searchable list. Opening a story
   * asks for the reader mode in a dialog unless the user chose to remember
   * one.
   */
  interface StoryCatalogItem {
    storyId: string;
    label: string;
    sublabel?: string;
  }

  interface StoryCatalogGroup {
    key: string;
    label: string;
    items: StoryCatalogItem[];
  }

  interface StoryUnitEpisodeCardView {
    storyId: string;
    title: string;
    sublabel?: string;
    bannerUrl: string;
  }

  interface StoryUnitEpisodeGroupView {
    groupId: number;
    categoryUnit: string;
    outline?: string;
    episodes: StoryUnitEpisodeCardView[];
  }

  interface StoryUnitCatalogView {
    unit: string;
    unitName: string;
    groups: StoryUnitEpisodeGroupView[];
  }

  interface Props {
    storyType: string;
    labels: {
      search: string;
      loading: string;
      loadFailed: string;
      empty: string;
      noMatch: string;
      open: string;
      backToUnits: string;
      modeDialogTitle: string;
      textMode: string;
      playerMode: string;
      rememberChoice: string;
      cancel: string;
    };
  }

  let { storyType, labels }: Props = $props();

  /** Reader route prefix per mode; hrefs differ only in this segment. */
  const MODE_BASES: Record<StoryReaderMode, string> = {
    text: "/story-reader",
    player: "/live2d/story-reader"
  };

  const regionSelection = useRegionSelection();

  let query = $state("");
  let groups = $state<StoryCatalogGroup[]>([]);
  let units = $state<StoryUnitCatalogView[]>([]);
  let selectedUnit = $state<string | null>(null);
  let loading = $state(false);
  let loadFailed = $state(false);
  let loadSeq = 0;

  const fetchGroups = async (region: string, nextType: string): Promise<void> => {
    const seq = ++loadSeq;
    loading = true;
    loadFailed = false;
    try {
      const response = await fetch(`/story-reader/api/stories/${region}/${nextType}`);
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as {
        groups?: StoryCatalogGroup[];
        units?: StoryUnitCatalogView[];
      };
      if (seq !== loadSeq) return;
      groups = payload.groups ?? [];
      units = payload.units ?? [];
    } catch {
      if (seq !== loadSeq) return;
      groups = [];
      units = [];
      loadFailed = true;
    } finally {
      if (seq === loadSeq) loading = false;
    }
  };

  $effect(() => {
    void fetchGroups(regionSelection.primary, storyType);
  });

  $effect(() => {
    // A region or story-type change drops the unit drill-down.
    void regionSelection.primary;
    void storyType;
    selectedUnit = null;
  });

  const normalizedQuery = $derived(query.trim().toLowerCase());

  const filteredGroups = $derived(
    normalizedQuery
      ? groups
          .map((group) => ({
            ...group,
            items: group.items.filter(
              (item) =>
                item.label.toLowerCase().includes(normalizedQuery) ||
                item.storyId.toLowerCase().includes(normalizedQuery)
            )
          }))
          .filter((group) => group.items.length > 0)
      : groups
  );
  const totalMatches = $derived(
    filteredGroups.reduce((sum, group) => sum + group.items.length, 0)
  );

  const filteredUnits = $derived(
    normalizedQuery
      ? units
          .map((unit) => ({
            ...unit,
            groups: unit.groups
              .map((group) => ({
                ...group,
                episodes: group.episodes.filter(
                  (episode) =>
                    episode.title.toLowerCase().includes(normalizedQuery) ||
                    episode.storyId.toLowerCase().includes(normalizedQuery)
                )
              }))
              .filter((group) => group.episodes.length > 0)
          }))
          .filter(
            (unit) =>
              unit.groups.length > 0 ||
              unit.unitName.toLowerCase().includes(normalizedQuery) ||
              unit.unit.toLowerCase().includes(normalizedQuery)
          )
      : units
  );

  const selectedUnitEntry = $derived(
    storyType === "unit" && selectedUnit
      ? (filteredUnits.find((unit) => unit.unit === selectedUnit) ?? null)
      : null
  );
  const unitNameBySlug = $derived(
    new Map(units.map((unit) => [unit.unit, unit.unitName] as const))
  );

  const storyHref = (storyId: string, mode: StoryReaderMode): string =>
    `${MODE_BASES[mode]}/${regionSelection.primary}/${storyType}/${storyId}`;

  let modeDialog = $state<HTMLDialogElement | null>(null);
  let pendingStoryId = $state<string | null>(null);
  let rememberChoice = $state(false);

  const openStory = (event: MouseEvent, storyId: string): void => {
    // Modified or middle clicks keep the browser's own link behavior.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const remembered = readRememberedStoryReaderMode();
    if (!remembered && !modeDialog) return;
    event.preventDefault();
    if (remembered) {
      void goto(storyHref(storyId, remembered));
      return;
    }
    pendingStoryId = storyId;
    rememberChoice = false;
    modeDialog?.showModal();
  };

  const chooseMode = (mode: StoryReaderMode): void => {
    if (rememberChoice) rememberStoryReaderMode(mode);
    modeDialog?.close();
    const storyId = pendingStoryId;
    pendingStoryId = null;
    if (storyId) void goto(storyHref(storyId, mode));
  };
</script>

<section class="card bg-base-100 shadow-sm ring-1 ring-base-content/10" aria-label={labels.open}>
  <div class="card-body gap-4 p-5">
    <h2 class="card-title text-lg">{labels.open}</h2>

    <label class="input input-bordered flex min-h-11 items-center gap-2">
      <Icon icon="mdi:magnify" class="size-4 text-base-content/50" aria-hidden="true" />
      <input type="search" class="grow" placeholder={labels.search} bind:value={query} />
    </label>

    {#if loading}
      <p class="flex items-center gap-2 text-sm text-base-content/60" role="status">
        <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
        {labels.loading}
      </p>
    {:else if loadFailed}
      <div class="alert alert-soft alert-warning" role="alert">
        <Icon icon="mdi:alert-circle-outline" class="size-5 shrink-0" aria-hidden="true" />
        <span>{labels.loadFailed}</span>
      </div>
    {:else if storyType === "unit" && selectedUnitEntry}
      <div class="flex flex-col gap-4">
        <button
          type="button"
          class="btn btn-ghost btn-sm -ml-2 self-start"
          onclick={() => (selectedUnit = null)}
        >
          <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
          {labels.backToUnits}
        </button>
        <div class="flex items-center gap-3">
          <img
            src={resolveUnitLogoUrl(selectedUnitEntry.unit) ?? undefined}
            alt=""
            class="h-9 w-auto object-contain"
          />
          <h3 class="text-base font-semibold">{selectedUnitEntry.unitName}</h3>
        </div>
        {#each selectedUnitEntry.groups as group (group.groupId)}
          <section class="flex flex-col gap-2">
            {#if group.categoryUnit !== "none"}
              <h4 class="text-sm font-semibold text-base-content/80">
                {unitNameBySlug.get(group.categoryUnit) ?? group.categoryUnit}
              </h4>
            {/if}
            {#if group.outline}
              <p class="text-sm/6 text-base-content/70">{group.outline}</p>
            {/if}
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {#each group.episodes as episode (episode.storyId)}
                <a
                  class="group overflow-hidden rounded-xl border border-base-content/10 bg-base-100 outline-none transition-[border-color,background-color,transform] duration-180 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
                  href={storyHref(episode.storyId, "text")}
                  onclick={(event) => openStory(event, episode.storyId)}
                >
                  <img
                    src={episode.bannerUrl}
                    alt=""
                    loading="lazy"
                    class="aspect-280/144 w-full object-cover transition-[filter] duration-180 ease-out group-hover:brightness-105"
                  />
                  <div class="flex items-center justify-between gap-2 px-3 py-2">
                    <span
                      class="min-w-0 truncate text-sm transition-colors duration-180 group-hover:text-primary"
                      >{episode.title}</span
                    >
                    {#if episode.sublabel}
                      <span class="shrink-0 text-xs text-base-content/50">{episode.sublabel}</span>
                    {/if}
                  </div>
                </a>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {:else if storyType === "unit"}
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {#each filteredUnits as unit (unit.unit)}
          <button
            type="button"
            class="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-base-content/10 bg-base-200/40 px-4 py-6 outline-none transition-[border-color,background-color,transform] duration-180 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
            onclick={() => (selectedUnit = unit.unit)}
          >
            <img
              src={resolveUnitLogoUrl(unit.unit) ?? undefined}
              alt=""
              class="h-12 w-auto max-w-full object-contain transition-[filter] duration-180 ease-out group-hover:brightness-105"
            />
            <span
              class="text-sm font-semibold transition-colors duration-180 group-hover:text-primary"
              >{unit.unitName}</span
            >
          </button>
        {/each}
        {#if filteredUnits.length === 0}
          <p class="text-sm text-base-content/60" role="status">
            {units.length > 0 ? labels.noMatch : labels.empty}
          </p>
        {/if}
      </div>
    {:else}
      {#if filteredGroups.length === 0}
        <p class="text-sm text-base-content/60" role="status">
          {totalMatches === 0 && groups.length > 0 ? labels.noMatch : labels.empty}
        </p>
      {:else}
        <div class="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[60vh]">
          {#each filteredGroups as group (group.key)}
            <details class="collapse collapse-arrow rounded-xl border border-base-content/10 bg-base-200/40">
              <summary class="collapse-title text-sm font-semibold">
                {group.label}
                <span class="text-base-content/50">({group.items.length})</span>
              </summary>
              <div class="collapse-content flex flex-col gap-1 pl-0">
                {#each group.items as item (item.storyId)}
                  <a
                    class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-base-200"
                    href={storyHref(item.storyId, "text")}
                    onclick={(event) => openStory(event, item.storyId)}
                  >
                    <span class="min-w-0 truncate">{item.label}</span>
                    {#if item.sublabel}
                      <span class="shrink-0 font-mono text-xs text-base-content/50">{item.sublabel}</span>
                    {/if}
                  </a>
                {/each}
              </div>
            </details>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</section>

<dialog bind:this={modeDialog} class="modal" onclose={() => (pendingStoryId = null)}>
  <div class="modal-box max-w-sm">
    <h3 class="text-base font-bold">{labels.modeDialogTitle}</h3>
    <div class="mt-4 grid gap-2">
      <button
        type="button"
        class="btn justify-start gap-3 border-base-content/10 bg-base-100 hover:border-primary/40 hover:bg-primary/5"
        onclick={() => chooseMode("text")}
      >
        <Icon icon="mdi:script-text-outline" class="size-5 text-primary" aria-hidden="true" />
        {labels.textMode}
      </button>
      <button
        type="button"
        class="btn justify-start gap-3 border-base-content/10 bg-base-100 hover:border-primary/40 hover:bg-primary/5"
        onclick={() => chooseMode("player")}
      >
        <Icon icon="mdi:drama-masks" class="size-5 text-primary" aria-hidden="true" />
        {labels.playerMode}
      </button>
    </div>
    <label class="mt-4 flex cursor-pointer items-center gap-2 text-sm text-base-content/80">
      <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" bind:checked={rememberChoice} />
      {labels.rememberChoice}
    </label>
    <div class="modal-action">
      <form method="dialog">
        <button class="btn btn-ghost btn-sm">{labels.cancel}</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label={labels.cancel}></button>
  </form>
</dialog>
