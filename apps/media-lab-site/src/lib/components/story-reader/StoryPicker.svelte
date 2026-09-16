<script lang="ts">
  import Icon from "@iconify/svelte";
  import { resolveUnitLogoUrl } from "@platform/ui-shell";
  import { goto } from "$app/navigation";
  import { useRegionSelection } from "$lib/region-selection.svelte";
  import { localCharacterAvatarUrl } from "$lib/story/character-avatar";
  import {
    readRememberedStoryReaderMode,
    rememberStoryReaderMode,
    type StoryReaderMode
  } from "$lib/story/story-reader-mode";

  /**
   * Story picker for one story type sub-page. The region follows the shared
   * primary-region setting; type navigation lives in the sidebar. Unit
   * stories use a two-level picker (unit blocks → story lines of episode
   * cards); event stories filter by event type; character stories list
   * avatar tiles; card stories list card-art tiles with a character filter;
   * area talks list area cards with a drill-down into the talks of one area;
   * special stories link single-episode entries directly and keep expandable
   * groups only where a story has several episodes. Opening a story asks for
   * the reader mode in a dialog unless the user chose to remember one.
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
    eventType?: string | null;
  }

  interface StoryCharacterEntry {
    characterId: number;
    storyId: string;
    name: string | null;
    avatarUrl: string | null;
  }

  interface StoryCardEpisodeLink {
    storyId: string;
    label: string;
  }

  interface StoryCardEntry {
    cardId: number;
    cardName: string;
    characterId?: number;
    characterName?: string;
    thumbnailUrl: string | null;
    episodes: StoryCardEpisodeLink[];
  }

  interface StoryAreaTalkView {
    storyId: string;
    scenarioId?: string;
    scriptId?: string;
    characterIds: number[];
  }

  interface StoryAreaEntry {
    areaId: number;
    name: string | null;
    subName?: string;
    thumbnailUrl: string | null;
    talks: StoryAreaTalkView[];
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
      filterEventType: string;
      eventTypeAll: string;
      eventTypeMarathon: string;
      eventTypeCheerfulCarnival: string;
      eventTypeWorldBloom: string;
      filterCharacter: string;
      characterAll: string;
      backToAreas: string;
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
  let characters = $state<StoryCharacterEntry[]>([]);
  let cards = $state<StoryCardEntry[]>([]);
  let areas = $state<StoryAreaEntry[]>([]);
  let units = $state<StoryUnitCatalogView[]>([]);
  let selectedUnit = $state<string | null>(null);
  let selectedAreaId = $state<number | null>(null);
  let eventTypeFilter = $state("all");
  let cardCharacterFilter = $state("all");
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
        characters?: StoryCharacterEntry[];
        cards?: StoryCardEntry[];
        areas?: StoryAreaEntry[];
        units?: StoryUnitCatalogView[];
      };
      if (seq !== loadSeq) return;
      groups = payload.groups ?? [];
      characters = payload.characters ?? [];
      cards = payload.cards ?? [];
      areas = payload.areas ?? [];
      units = payload.units ?? [];
    } catch {
      if (seq !== loadSeq) return;
      groups = [];
      characters = [];
      cards = [];
      areas = [];
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
    // A region or story-type change drops the unit/area drill-downs and filters.
    void regionSelection.primary;
    void storyType;
    selectedUnit = null;
    selectedAreaId = null;
    eventTypeFilter = "all";
    cardCharacterFilter = "all";
  });

  const normalizedQuery = $derived(query.trim().toLowerCase());

  const queryMatches = (text: string): boolean =>
    text.toLowerCase().includes(normalizedQuery);

  const filteredGroups = $derived.by(() => {
    let list = groups;
    if (storyType === "event" && eventTypeFilter !== "all") {
      list = list.filter((group) => group.eventType === eventTypeFilter);
    }
    if (normalizedQuery) {
      list = list
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              queryMatches(item.label) || queryMatches(item.storyId)
          )
        }))
        .filter((group) => group.items.length > 0);
    }
    return list;
  });
  const totalMatches = $derived(
    filteredGroups.reduce((sum, group) => sum + group.items.length, 0)
  );

  const filteredCharacters = $derived(
    normalizedQuery
      ? characters.filter(
          (character) =>
            queryMatches(character.name ?? "") ||
            queryMatches(character.storyId)
        )
      : characters
  );

  const filteredAreas = $derived.by(() => {
    let list = areas;
    if (normalizedQuery) {
      list = list
        .map((area) => ({
          ...area,
          talks: area.talks.filter(
            (talk) =>
              queryMatches(talk.scriptId ?? "") ||
              queryMatches(talk.scenarioId ?? "") ||
              queryMatches(talk.storyId)
          )
        }))
        .filter(
          (area) =>
            area.talks.length > 0 ||
            queryMatches(area.name ?? "") ||
            queryMatches(area.subName ?? "") ||
            queryMatches(String(area.areaId))
        );
    }
    return list;
  });

  const selectedAreaEntry = $derived(
    storyType === "area-talk" && selectedAreaId !== null
      ? (filteredAreas.find((area) => area.areaId === selectedAreaId) ?? null)
      : null
  );

  const cardCharacterOptions = $derived.by(() => {
    const options: Array<{ id: number; name: string }> = [];
    for (const card of cards) {
      if (card.characterId === undefined) continue;
      if (!options.some((option) => option.id === card.characterId)) {
        options.push({
          id: card.characterId,
          name: card.characterName ?? `#${card.characterId}`
        });
      }
    }
    return options.sort((a, b) => a.id - b.id);
  });

  const filteredCards = $derived.by(() => {
    let list = cards;
    if (cardCharacterFilter !== "all") {
      list = list.filter((card) => String(card.characterId) === cardCharacterFilter);
    }
    if (normalizedQuery) {
      list = list.filter(
        (card) =>
          queryMatches(card.cardName) ||
          queryMatches(card.characterName ?? "") ||
          queryMatches(String(card.cardId))
      );
    }
    return list;
  });

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
                    queryMatches(episode.title) ||
                    queryMatches(episode.storyId)
                )
              }))
              .filter((group) => group.episodes.length > 0)
          }))
          .filter(
            (unit) =>
              unit.groups.length > 0 ||
              queryMatches(unit.unitName) ||
              queryMatches(unit.unit)
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

{#snippet groupedList(list: StoryCatalogGroup[], matchCount: number, known: boolean)}
  {#if list.length === 0}
    <p class="text-sm text-base-content/60" role="status">
      {matchCount === 0 && known ? labels.noMatch : labels.empty}
    </p>
  {:else}
    <div class="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[60vh]">
      {#each list as group (group.key)}
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
{/snippet}

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
    {:else if storyType === "event"}
      <label class="flex w-full max-w-64 items-center gap-2 text-sm text-base-content/70">
        <span class="shrink-0">{labels.filterEventType}</span>
        <select class="select select-bordered select-sm grow" bind:value={eventTypeFilter}>
          <option value="all">{labels.eventTypeAll}</option>
          <option value="marathon">{labels.eventTypeMarathon}</option>
          <option value="cheerful_carnival">{labels.eventTypeCheerfulCarnival}</option>
          <option value="world_bloom">{labels.eventTypeWorldBloom}</option>
        </select>
      </label>
      {@render groupedList(filteredGroups, totalMatches, groups.length > 0)}
    {:else if storyType === "character" && characters.length > 0}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {#each filteredCharacters as character (character.characterId)}
          <a
            class="group flex flex-col items-center gap-2 rounded-xl border border-base-content/10 bg-base-200/40 px-3 py-4 outline-none transition-[border-color,background-color,transform] duration-180 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
            href={storyHref(character.storyId, "text")}
            onclick={(event) => openStory(event, character.storyId)}
          >
            {#if character.avatarUrl}
              <img
                src={character.avatarUrl}
                alt=""
                loading="lazy"
                class="size-16 rounded-full object-cover object-top transition-[filter] duration-180 ease-out group-hover:brightness-105"
              />
            {:else}
              <span
                class="flex size-16 items-center justify-center rounded-full bg-base-300 text-base-content/50"
                aria-hidden="true"
              >
                <Icon icon="mdi:account" class="size-8" />
              </span>
            {/if}
            <span
              class="w-full truncate text-center text-sm font-semibold transition-colors duration-180 group-hover:text-primary"
              >{character.name ?? `#${character.characterId}`}</span
            >
          </a>
        {/each}
      </div>
      {#if filteredCharacters.length === 0}
        <p class="text-sm text-base-content/60" role="status">
          {characters.length > 0 ? labels.noMatch : labels.empty}
        </p>
      {/if}
    {:else if storyType === "card" && cards.length > 0}
      <label class="flex w-full max-w-64 items-center gap-2 text-sm text-base-content/70">
        <span class="shrink-0">{labels.filterCharacter}</span>
        <select class="select select-bordered select-sm grow" bind:value={cardCharacterFilter}>
          <option value="all">{labels.characterAll}</option>
          {#each cardCharacterOptions as option (option.id)}
            <option value={String(option.id)}>{option.name}</option>
          {/each}
        </select>
      </label>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {#each filteredCards as card (card.cardId)}
          <article class="flex flex-col gap-2 rounded-xl border border-base-content/10 bg-base-100 p-3">
            <div class="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-base-200/50">
              {#if card.thumbnailUrl}
                <img
                  src={card.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  class="size-full object-contain"
                />
              {:else}
                <Icon icon="mdi:image-outline" class="size-8 text-base-content/30" aria-hidden="true" />
              {/if}
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold" title={card.cardName}>{card.cardName}</p>
              <p class="truncate text-xs text-base-content/60">
                {card.characterName ?? `#${card.cardId}`}
              </p>
            </div>
            <div class="mt-auto flex flex-col gap-1">
              {#each card.episodes as episode (episode.storyId)}
                <a
                  class="max-w-full truncate rounded-md border border-base-content/15 px-2 py-1 text-center text-xs outline-none hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                  href={storyHref(episode.storyId, "text")}
                  onclick={(event) => openStory(event, episode.storyId)}
                  title={episode.label}
                >
                  {episode.label}
                </a>
              {/each}
            </div>
          </article>
        {/each}
      </div>
      {#if filteredCards.length === 0}
        <p class="text-sm text-base-content/60" role="status">
          {cards.length > 0 ? labels.noMatch : labels.empty}
        </p>
      {/if}
    {:else if storyType === "special"}
      {#if filteredGroups.length === 0}
        <p class="text-sm text-base-content/60" role="status">
          {totalMatches === 0 && groups.length > 0 ? labels.noMatch : labels.empty}
        </p>
      {:else}
        <div class="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[60vh]">
          {#each filteredGroups as group (group.key)}
            {@const singleEpisode =
              group.items.length === 1 ? group.items[0] : null}
            {#if singleEpisode}
              <a
                class="flex items-center justify-between gap-2 rounded-xl border border-base-content/10 bg-base-200/40 px-3 py-2.5 text-sm outline-none hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/60"
                href={storyHref(singleEpisode.storyId, "text")}
                onclick={(event) => openStory(event, singleEpisode.storyId)}
              >
                <span class="min-w-0 truncate font-semibold">{group.label}</span>
                {#if singleEpisode.sublabel}
                  <span class="shrink-0 font-mono text-xs text-base-content/50">{singleEpisode.sublabel}</span>
                {/if}
              </a>
            {:else}
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
            {/if}
          {/each}
        </div>
      {/if}
    {:else if storyType === "area-talk" && areas.length > 0}
      {#if selectedAreaEntry}
        <div class="flex flex-col gap-4">
          <button
            type="button"
            class="btn btn-ghost btn-sm -ml-2 self-start"
            onclick={() => (selectedAreaId = null)}
          >
            <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
            {labels.backToAreas}
          </button>
          <div class="flex items-baseline gap-2">
            <h3 class="text-base font-semibold">
              {selectedAreaEntry.name ?? `#${selectedAreaEntry.areaId}`}
            </h3>
            {#if selectedAreaEntry.subName}
              <span class="text-sm text-base-content/60">{selectedAreaEntry.subName}</span>
            {/if}
            <span class="text-sm text-base-content/50">({selectedAreaEntry.talks.length})</span>
          </div>
          <div class="flex flex-col gap-1">
            {#each selectedAreaEntry.talks as talk, index (talk.storyId)}
              <a
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/60"
                href={storyHref(talk.storyId, "text")}
                onclick={(event) => openStory(event, talk.storyId)}
              >
                <span class="flex shrink-0 items-center -space-x-2" aria-hidden="true">
                  {#if talk.characterIds.length > 0}
                    {#each talk.characterIds.slice(0, 6) as castId (castId)}
                      <img
                        src={localCharacterAvatarUrl(castId) ?? undefined}
                        alt=""
                        loading="lazy"
                        class="size-8 rounded-full border-2 border-base-100 object-cover object-top"
                      />
                    {/each}
                  {:else}
                    <span
                      class="flex size-8 items-center justify-center rounded-full bg-base-300 text-xs font-bold text-base-content/60"
                    >
                      {index + 1}
                    </span>
                  {/if}
                </span>
                <span class="min-w-0 truncate">
                  {talk.scriptId ?? talk.scenarioId ?? `#${talk.storyId}`}
                </span>
                <span class="ml-auto shrink-0 font-mono text-xs text-base-content/50">{talk.storyId}</span>
              </a>
            {/each}
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {#each filteredAreas as area (area.areaId)}
            <button
              type="button"
              class="group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-base-content/10 bg-base-200/40 p-3 outline-none transition-[border-color,background-color,transform] duration-180 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
              onclick={() => (selectedAreaId = area.areaId)}
            >
              <div
                class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-base-200/50"
              >
                <Icon
                  icon="mdi:map-marker-outline"
                  class="absolute size-8 text-base-content/30"
                  aria-hidden="true"
                />
                {#if area.thumbnailUrl}
                  <img
                    src={area.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    class="absolute inset-0 size-full object-cover transition-[filter] duration-180 ease-out group-hover:brightness-105"
                    onerror={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                {/if}
              </div>
              <span
                class="w-full truncate text-center text-sm font-semibold transition-colors duration-180 group-hover:text-primary"
                >{area.name ?? `#${area.areaId}`}</span
              >
              {#if area.subName}
                <span class="-mt-1.5 w-full truncate text-center text-xs text-base-content/60">{area.subName}</span>
              {/if}
            </button>
          {/each}
        </div>
        {#if filteredAreas.length === 0}
          <p class="text-sm text-base-content/60" role="status">
            {areas.length > 0 ? labels.noMatch : labels.empty}
          </p>
        {/if}
      {/if}
    {:else}
      {@render groupedList(filteredGroups, totalMatches, groups.length > 0)}
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
