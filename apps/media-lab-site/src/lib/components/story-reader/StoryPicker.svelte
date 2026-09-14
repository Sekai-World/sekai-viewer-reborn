<script lang="ts">
  import Icon from "@iconify/svelte";

  /**
   * Story picker for the reader landing page. Lists load lazily per region
   * and story type from the reader API; items link into the reading mode
   * selected by `modeBase`.
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

  interface Props {
    regions: { value: string; label: string }[];
    storyTypes: { value: string; label: string }[];
    modeBase: string;
    labels: {
      region: string;
      type: string;
      search: string;
      loading: string;
      loadFailed: string;
      empty: string;
      noMatch: string;
      open: string;
    };
  }

  let { regions, storyTypes, modeBase, labels }: Props = $props();

  let region = $state(regions[0]?.value ?? "jp");
  let storyType = $state(storyTypes[0]?.value ?? "unit");
  let query = $state("");
  let groups = $state<StoryCatalogGroup[]>([]);
  let loading = $state(false);
  let loadFailed = $state(false);
  let loadSeq = 0;

  const fetchGroups = async (nextRegion: string, nextType: string): Promise<void> => {
    const seq = ++loadSeq;
    loading = true;
    loadFailed = false;
    try {
      const response = await fetch(`/story-reader/api/stories/${nextRegion}/${nextType}`);
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { groups?: StoryCatalogGroup[] };
      if (seq !== loadSeq) return;
      groups = payload.groups ?? [];
    } catch {
      if (seq !== loadSeq) return;
      groups = [];
      loadFailed = true;
    } finally {
      if (seq === loadSeq) loading = false;
    }
  };

  $effect(() => {
    void fetchGroups(region, storyType);
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

  const itemHref = (storyId: string): string =>
    `${modeBase}/${region}/${storyType}/${storyId}`;
</script>

<section class="card bg-base-100 shadow-sm ring-1 ring-base-content/10" aria-label={labels.open}>
  <div class="card-body gap-4 p-5">
    <h2 class="card-title text-lg">{labels.open}</h2>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="form-control">
        <span class="label-text mb-1 block text-xs font-semibold tracking-wide text-base-content/60 uppercase">
          {labels.region}
        </span>
        <select class="select select-bordered min-h-11 w-full" bind:value={region}>
          {#each regions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label class="form-control">
        <span class="label-text mb-1 block text-xs font-semibold tracking-wide text-base-content/60 uppercase">
          {labels.type}
        </span>
        <select class="select select-bordered min-h-11 w-full" bind:value={storyType}>
          {#each storyTypes as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
    </div>

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
    {:else if filteredGroups.length === 0}
      <p class="text-sm text-base-content/60" role="status">
        {totalMatches === 0 && groups.length > 0 ? labels.noMatch : labels.empty}
      </p>
    {:else}
      <div class="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
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
                  href={itemHref(item.storyId)}
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
  </div>
</section>
