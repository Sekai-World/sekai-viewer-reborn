<script lang="ts">
  import Icon from "@iconify/svelte";
  import { browser } from "$app/environment";
  import { SvelteMap, SvelteURLSearchParams } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import { resolveUnitIconUrl, resolveUnitLogoUrl } from "@platform/ui-shell";
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
   * cards); event stories use a two-level picker too — a paginated event
   * card list (server-side sort/name/type/unit filters, wheel or swipe
   * loads the next page) that drills down into the event's episode cards;
   * character stories list avatar tiles; card stories list card-art tiles
   * with a character filter; area talks list area cards with a drill-down
   * into the talks of one area; special stories link single-episode entries
   * directly and keep expandable groups only where a story has several
   * episodes. Opening a story asks for the reader mode in a dialog unless
   * the user chose to remember one.
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

  interface StoryEventCardView {
    eventId: number;
    name: string;
    eventType: string | null;
    unit: string | null;
    startAt: number | null;
    endAt: number | null;
    bannerUrl: string | null;
  }

  interface StoryEventEpisodeView {
    storyId: string;
    label: string;
    sublabel: string;
    bannerUrl: string | null;
  }

  interface StoryUnitOption {
    value: string;
    label: string;
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
      eventTypeMarathon: string;
      eventTypeCheerfulCarnival: string;
      eventTypeWorldBloom: string;
      filterCharacter: string;
      characterAll: string;
      backToAreas: string;
      backToEvents: string;
      sortByStartAt: string;
      sortById: string;
      filterUnit: string;
      mixedUnit: string;
      loadMoreHint: string;
      loadingMore: string;
      listEnd: string;
      retry: string;
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
  let cardCharacterFilter = $state("all");
  let loading = $state(false);
  let loadFailed = $state(false);
  let loadSeq = 0;

  // Event picker: paginated list + server-side filters, mirroring the
  // content-site event list (sort toggles, type/unit chips, wheel loading).
  const EVENT_PAGE_DEBOUNCE_MS = 300;
  let events = $state<StoryEventCardView[]>([]);
  // Second drill-down level: an event's episodes load from the dedicated
  // event-stories sub-route on open; null means "not loaded yet".
  let selectedEventEpisodes = $state<StoryEventEpisodeView[] | null>(null);
  let episodeLoadFailed = $state(false);
  let episodeLoadSeq = 0;
  const eventEpisodesCache = new SvelteMap<number, StoryEventEpisodeView[]>();
  let eventUnitOptions = $state<StoryUnitOption[]>([]);
  let eventPage = $state(1);
  let eventHasNext = $state(false);
  let eventListLoadingMore = $state(false);
  let eventListFailed = $state(false);
  let selectedEventId = $state<number | null>(null);
  let eventSortBy = $state<"startAt" | "id">("startAt");
  let eventSortOrder = $state<"desc" | "asc">("desc");
  let eventTypeFilters = $state<string[]>([]);
  let eventUnitFilters = $state<string[]>([]);
  let eventLoadSeq = 0;
  let eventSentinel: HTMLDivElement | null = $state(null);
  let eventLoadMoreHintVisible = $state(false);
  let eventLastTouchY: number | null = null;

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
    if (storyType === "event") return; // events use their own paginated fetch below
    void fetchGroups(regionSelection.primary, storyType);
  });

  $effect(() => {
    // A region or story-type change drops the unit/area/event drill-downs and filters.
    void regionSelection.primary;
    void storyType;
    selectedUnit = null;
    selectedAreaId = null;
    selectedEventId = null;
    selectedEventEpisodes = null;
    episodeLoadFailed = false;
    eventEpisodesCache.clear();
    cardCharacterFilter = "all";
    eventTypeFilters = [];
    eventUnitFilters = [];
    eventSortBy = "startAt";
    eventSortOrder = "desc";
  });

  const fetchEventList = async (page: number, append: boolean): Promise<void> => {
    const seq = ++eventLoadSeq;
    if (append) {
      eventListLoadingMore = true;
    } else {
      loading = true;
      eventListFailed = false;
    }
    try {
      const params = new SvelteURLSearchParams({
        page: String(page),
        sort_by: eventSortBy,
        sort_order: eventSortOrder
      });
      if (normalizedQuery) params.set("name", normalizedQuery);
      if (eventTypeFilters.length > 0) params.set("event_type", eventTypeFilters.join(","));
      if (eventUnitFilters.length > 0) params.set("unit", eventUnitFilters.join(","));
      const response = await fetch(
        `/story-reader/api/stories/${regionSelection.primary}/event?${params.toString()}`
      );
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as {
        events?: StoryEventCardView[];
        unitOptions?: StoryUnitOption[];
        pagination?: { page?: number; hasNext?: boolean };
      };
      if (seq !== eventLoadSeq) return;
      events = append ? [...events, ...(payload.events ?? [])] : (payload.events ?? []);
      eventUnitOptions = payload.unitOptions ?? [];
      eventPage = payload.pagination?.page ?? page;
      eventHasNext = payload.pagination?.hasNext === true;
      eventListFailed = false;
    } catch {
      if (seq !== eventLoadSeq) return;
      eventListFailed = true;
      if (!append) events = [];
    } finally {
      if (seq === eventLoadSeq) {
        loading = false;
        eventListLoadingMore = false;
      }
    }
  };

  $effect(() => {
    // Debounced first page: any region / filter / sort / name change reloads
    // the paginated event list from scratch.
    if (storyType !== "event") return;
    void regionSelection.primary;
    void normalizedQuery;
    void eventSortBy;
    void eventSortOrder;
    void eventTypeFilters;
    void eventUnitFilters;
    const timer = setTimeout(() => {
      void fetchEventList(1, false);
    }, EVENT_PAGE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    if (!browser || storyType !== "event" || !eventSentinel || !eventHasNext) return;
    const observer = new IntersectionObserver(
      (entries) => {
        eventLoadMoreHintVisible = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0.96 }
    );
    observer.observe(eventSentinel);
    return () => observer.disconnect();
  });

  $effect(() => {
    // Wheel down or an upward swipe past the sentinel loads the next page,
    // matching the content-site event list behavior.
    if (!browser || storyType !== "event" || !eventHasNext) return;
    const triggerLoadMore = (): void => {
      if (!eventLoadMoreHintVisible || eventListLoadingMore || loading || !eventHasNext) return;
      void fetchEventList(eventPage + 1, true);
    };
    const handleWheel = (event: WheelEvent): void => {
      if (event.deltaY > 0) triggerLoadMore();
    };
    const handleTouchStart = (event: TouchEvent): void => {
      eventLastTouchY = event.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = (event: TouchEvent): void => {
      const nextY = event.touches[0]?.clientY ?? null;
      if (eventLastTouchY === null || nextY === null) {
        eventLastTouchY = nextY;
        return;
      }
      if (eventLastTouchY - nextY > 12) triggerLoadMore();
      eventLastTouchY = nextY;
    };
    const handleTouchEnd = (): void => {
      eventLastTouchY = null;
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  });

  const normalizedQuery = $derived(query.trim().toLowerCase());

  const queryMatches = (text: string): boolean =>
    text.toLowerCase().includes(normalizedQuery);

  const filteredGroups = $derived.by(() => {
    let list = groups;
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

  const selectedEventEntry = $derived(
    storyType === "event" && selectedEventId !== null
      ? (events.find((event) => event.eventId === selectedEventId) ?? null)
      : null
  );

  const fetchEventEpisodes = async (region: string, eventId: number): Promise<void> => {
    const seq = ++episodeLoadSeq;
    selectedEventEpisodes = null;
    episodeLoadFailed = false;
    try {
      const response = await fetch(
        `/story-reader/api/stories/${region}/event-stories/${eventId}`
      );
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { episodes?: StoryEventEpisodeView[] };
      if (seq !== episodeLoadSeq) return;
      selectedEventEpisodes = payload.episodes ?? [];
      eventEpisodesCache.set(eventId, selectedEventEpisodes);
    } catch {
      if (seq !== episodeLoadSeq) return;
      episodeLoadFailed = true;
    }
  };

  const openEvent = (event: StoryEventCardView): void => {
    selectedEventId = event.eventId;
    const cached = eventEpisodesCache.get(event.eventId);
    if (cached) {
      selectedEventEpisodes = cached;
      episodeLoadFailed = false;
      return;
    }
    void fetchEventEpisodes(regionSelection.primary, event.eventId);
  };

  const retryEventEpisodes = (): void => {
    if (selectedEventId === null) return;
    void fetchEventEpisodes(regionSelection.primary, selectedEventId);
  };

  const eventTypeLabel = (value: string): string =>
    value === "marathon"
      ? labels.eventTypeMarathon
      : value === "cheerful_carnival"
        ? labels.eventTypeCheerfulCarnival
        : value === "world_bloom"
          ? labels.eventTypeWorldBloom
          : value;

  const toggleEventTypeFilter = (value: string): void => {
    eventTypeFilters = eventTypeFilters.includes(value)
      ? eventTypeFilters.filter((entry) => entry !== value)
      : [...eventTypeFilters, value];
  };

  const toggleEventUnitFilter = (value: string): void => {
    eventUnitFilters = eventUnitFilters.includes(value)
      ? eventUnitFilters.filter((entry) => entry !== value)
      : [...eventUnitFilters, value];
  };

  const toggleEventSort = (target: "startAt" | "id"): void => {
    if (eventSortBy !== target) {
      eventSortBy = target;
      eventSortOrder = "desc";
    } else {
      eventSortOrder = eventSortOrder === "desc" ? "asc" : "desc";
    }
  };

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

    {#if storyType === "event" && selectedEventId !== null}
      <div class="flex flex-col gap-4">
        <button
          type="button"
          class="btn btn-ghost btn-sm -ml-2 self-start"
          onclick={() => (selectedEventId = null)}
        >
          <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
          {labels.backToEvents}
        </button>
        <div class="flex items-center gap-3">
          {#if selectedEventEntry?.bannerUrl}
            <img
              src={selectedEventEntry.bannerUrl}
              alt=""
              class="h-10 w-auto rounded-lg object-cover"
            />
          {/if}
          <h3 class="text-base font-semibold">
            {selectedEventEntry?.name ?? `#${selectedEventId}`}
          </h3>
        </div>
        {#if episodeLoadFailed}
          <div class="alert alert-soft alert-warning" role="alert">
            <Icon icon="mdi:alert-circle-outline" class="size-5 shrink-0" aria-hidden="true" />
            <span>{labels.loadFailed}</span>
          </div>
          <button
            type="button"
            class="btn btn-outline btn-sm self-start"
            onclick={retryEventEpisodes}
          >
            {labels.retry}
          </button>
        {:else if selectedEventEpisodes === null}
          <p class="flex items-center gap-2 text-sm text-base-content/60" role="status">
            <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
            {labels.loading}
          </p>
        {:else if selectedEventEpisodes.length === 0}
          <p class="text-sm text-base-content/60" role="status">{labels.empty}</p>
        {:else}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {#each selectedEventEpisodes as episode (episode.storyId)}
              <a
                class="group overflow-hidden rounded-xl border border-base-content/10 bg-base-100 outline-none transition-[border-color,background-color,transform] duration-180 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
                href={storyHref(episode.storyId, "text")}
                onclick={(event) => openStory(event, episode.storyId)}
              >
                {#if episode.bannerUrl}
                  <img
                    src={episode.bannerUrl}
                    alt=""
                    loading="lazy"
                    class="aspect-video w-full bg-base-200/60 object-contain transition-[filter] duration-180 ease-out group-hover:brightness-105"
                  />
                {:else if selectedEventEntry?.bannerUrl}
                  <img
                    src={selectedEventEntry.bannerUrl}
                    alt=""
                    loading="lazy"
                    class="aspect-video w-full bg-base-200/60 object-contain transition-[filter] duration-180 ease-out group-hover:brightness-105"
                  />
                {:else}
                  <div
                    class="flex aspect-video w-full items-center justify-center bg-base-200/60 text-base-content/40"
                  >
                    <Icon icon="mdi:image-outline" class="size-8" aria-hidden="true" />
                  </div>
                {/if}
                <div class="flex items-center justify-between gap-2 px-3 py-2">
                  <span
                    class="min-w-0 truncate text-sm transition-colors duration-180 group-hover:text-primary"
                    >{episode.label}</span
                  >
                  <span class="shrink-0 text-xs text-base-content/50">{episode.sublabel}</span>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {:else if storyType === "event"}
      <div class="flex flex-wrap items-center gap-2">
        <div class="join">
          <button
            type="button"
            title={labels.sortByStartAt}
            aria-label={labels.sortByStartAt}
            aria-pressed={eventSortBy === "startAt"}
            class={`btn btn-sm join-item size-9 p-0 ${eventSortBy === "startAt" ? "btn-primary" : "btn-outline border-base-content/20"}`}
            onclick={() => toggleEventSort("startAt")}
          >
            <Icon icon="mdi:clock-start" class="size-4" aria-hidden="true" />
            {#if eventSortBy === "startAt"}
              <Icon
                icon={eventSortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down"}
                class="size-3.5"
                aria-hidden="true"
              />
            {/if}
          </button>
          <button
            type="button"
            title={labels.sortById}
            aria-label={labels.sortById}
            aria-pressed={eventSortBy === "id"}
            class={`btn btn-sm join-item size-9 p-0 ${eventSortBy === "id" ? "btn-primary" : "btn-outline border-base-content/20"}`}
            onclick={() => toggleEventSort("id")}
          >
            <Icon icon="mdi:numeric" class="size-4" aria-hidden="true" />
            {#if eventSortBy === "id"}
              <Icon
                icon={eventSortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down"}
                class="size-3.5"
                aria-hidden="true"
              />
            {/if}
          </button>
        </div>
        <div class="join" role="group" aria-label={labels.filterEventType}>
          {#each ["marathon", "cheerful_carnival", "world_bloom"] as type (type)}
            <button
              type="button"
              title={eventTypeLabel(type)}
              class={`btn btn-sm join-item ${eventTypeFilters.includes(type) ? "btn-primary" : "btn-outline border-base-content/20"}`}
              onclick={() => toggleEventTypeFilter(type)}
            >
              {eventTypeLabel(type)}
            </button>
          {/each}
        </div>
        <div class="join" role="group" aria-label={labels.filterUnit}>
          {#each eventUnitOptions as option (`unit:${option.value}`)}
            <button
              type="button"
              title={option.label}
              class={`btn btn-sm join-item size-9 p-0 ${eventUnitFilters.includes(option.value) ? "btn-primary" : "btn-outline border-base-content/20"}`}
              onclick={() => toggleEventUnitFilter(option.value)}
            >
              <img
                src={resolveUnitIconUrl(option.value) ?? undefined}
                alt={option.label}
                class="size-6 object-contain"
              />
            </button>
          {/each}
          <button
            type="button"
            title={labels.mixedUnit}
            aria-label={labels.mixedUnit}
            class={`btn btn-sm join-item size-9 p-0 ${eventUnitFilters.includes("mixed") ? "btn-primary" : "btn-outline border-base-content/20"}`}
            onclick={() => toggleEventUnitFilter("mixed")}
          >
            <Icon icon="mdi:puzzle" class="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {#if events.length > 0}
        <div class="relative">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {#each events as event (event.eventId)}
              <button
                type="button"
                class="group overflow-hidden rounded-xl border border-base-content/10 bg-base-100 text-left outline-none transition-[border-color,background-color,transform] duration-180 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
                onclick={() => openEvent(event)}
              >
                {#if event.bannerUrl}
                  <img
                    src={event.bannerUrl}
                    alt=""
                    loading="lazy"
                    class="aspect-video w-full bg-base-200/60 object-contain transition-[filter] duration-180 ease-out group-hover:brightness-105"
                  />
                {:else}
                  <div
                    class="flex aspect-video w-full items-center justify-center bg-base-200/60 text-base-content/40"
                  >
                    <Icon icon="mdi:image-outline" class="size-8" aria-hidden="true" />
                  </div>
                {/if}
                <div class="flex flex-col gap-1.5 px-3 py-2">
                  <span
                    class="truncate text-sm font-semibold transition-colors duration-180 group-hover:text-primary"
                    >{event.name}</span
                  >
                  <div class="flex items-center gap-1.5 text-xs text-base-content/60">
                    <span class="font-mono">#{event.eventId}</span>
                    {#if event.eventType}
                      <span class="badge badge-ghost badge-sm">{eventTypeLabel(event.eventType)}</span>
                    {/if}
                    {#if event.unit && event.unit !== "none"}
                      <img
                        src={resolveUnitLogoUrl(event.unit) ?? undefined}
                        alt=""
                        class="ml-auto h-4 w-auto object-contain"
                      />
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          </div>
          {#if loading}
            <div
              class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-base-100/70"
              role="status"
            >
              <span class="loading loading-spinner loading-md" aria-hidden="true"></span>
            </div>
          {/if}
        </div>
      {:else if loading}
        <p class="flex items-center gap-2 text-sm text-base-content/60" role="status">
          <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
          {labels.loading}
        </p>
      {:else if eventListFailed}
        <div class="alert alert-soft alert-warning" role="alert">
          <Icon icon="mdi:alert-circle-outline" class="size-5 shrink-0" aria-hidden="true" />
          <span>{labels.loadFailed}</span>
        </div>
        <button type="button" class="btn btn-outline btn-sm self-start" onclick={() => void fetchEventList(1, false)}>
          {labels.retry}
        </button>
      {:else}
        <p class="text-sm text-base-content/60" role="status">
          {normalizedQuery || eventTypeFilters.length > 0 || eventUnitFilters.length > 0
            ? labels.noMatch
            : labels.empty}
        </p>
      {/if}

      {#if eventHasNext}
        <div
          bind:this={eventSentinel}
          class="flex min-h-20 items-center justify-center rounded-xl py-3"
        >
          {#if eventListLoadingMore}
            <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
            <span class="ml-2 text-sm text-base-content/60">{labels.loadingMore}</span>
          {:else}
            <span class="text-sm text-base-content/50">{labels.loadMoreHint}</span>
          {/if}
        </div>
      {:else if events.length > 0}
        <p class="py-2 text-center text-sm text-base-content/50">{labels.listEnd}</p>
      {/if}

    {:else if loading}
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
