<script lang="ts">
  import { navigating } from "$app/state";
  import Icon from "@iconify/svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import type { Live2dCatalogRouteData } from "$lib/live2d/catalog-route-data";
  import {
    getLive2dCharacterGroupKey,
    getLive2dCharacterTypeKey,
    type Live2dCharacterType
  } from "$lib/live2d/character-grouping";
  import { tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import type { PageData } from "./$types";

  type CharacterOption = {
    id: number | string | null;
    characterType?: string | null;
    name?: string;
    modelCount?: number;
  };
  type CatalogModel = Extract<Live2dCatalogRouteData, { status: "ready" }>["models"][number];
  type CharacterPayload = {
    models: readonly CatalogModel[];
    characters: readonly CharacterOption[];
  };
  type Live2dPageData = Omit<PageData, "characters"> & {
    characters?: CharacterPayload | PromiseLike<CharacterPayload>;
  };
  let { data }: { data: Live2dPageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));
  const format = (key: string, token: string, value: string | number) =>
    translate(key).replace(`{${token}}`, String(value));

  let catalog = $state<Live2dCatalogRouteData | null>(null);
  let characterOptions = $state<readonly CharacterOption[]>([]);
  let models = $state<readonly CatalogModel[]>([]);
  type Group = {
    id: string;
    characterId: string | null;
    characterType: string | null;
    name?: string;
    models: CatalogModel[];
  };
  type CharacterTypeGroup = {
    key: Live2dCharacterType;
    groups: Group[];
  };
  $effect(() => {
    let cancelled = false;
    catalog = null;
    models = [];
    characterOptions = [];

    // SvelteKit unwraps streamed fields in generated PageData types, but the
    // runtime value is still a promise during the initial streamed render.
    // Promise.resolve also handles already-resolved values on client navigation.
    const catalogPromise = Promise.resolve(
      data.catalog as unknown as Live2dCatalogRouteData | PromiseLike<Live2dCatalogRouteData>
    );
    void catalogPromise.then(
      (nextCatalog) => {
        if (cancelled) return;
        catalog = nextCatalog;
        if (nextCatalog.status !== "ready") return;
        models = nextCatalog.models;

        const charactersPromise = Promise.resolve(
          data.characters as unknown as CharacterPayload | PromiseLike<CharacterPayload> | undefined
        );
        void charactersPromise.then(
          (nextCharacters) => {
            if (cancelled) return;
            models = nextCharacters?.models ?? nextCatalog.models;
            characterOptions = nextCharacters?.characters ?? [];
          },
          () => {
            if (cancelled) return;
            models = nextCatalog.models;
            characterOptions = [];
          }
        );
      },
      () => {
        if (!cancelled) {
          catalog = {
            status: "error",
            reason: "Live2D catalog request failed",
            models: []
          };
        }
      }
    );

    return () => {
      cancelled = true;
    };
  });

  const getMetadata = (model: CatalogModel, key: "characterId" | "characterType") => {
    const value = (model as CatalogModel & Record<string, unknown>)[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : null;
  };
  const groupedModels = $derived.by((): Group[] => {
    if (catalog?.status !== "ready") return [];
    const groups = new SvelteMap<string, Group>();

    for (const option of characterOptions) {
      if (option.id === null || option.id === undefined) continue;
      const characterId = String(option.id);
      const characterType = option.characterType ?? null;
      const id = getLive2dCharacterGroupKey(characterId, characterType);
      groups.set(id, {
        id,
        characterId,
        characterType,
        name: option.name,
        models: []
      });
    }

    for (const model of models) {
      const characterId = getMetadata(model, "characterId");
      const characterType = getMetadata(model, "characterType");
      const id = getLive2dCharacterGroupKey(characterId, characterType);
      const option = characterOptions.find(
        (candidate) =>
          candidate.id !== null &&
          candidate.id !== undefined &&
          getLive2dCharacterGroupKey(String(candidate.id), candidate.characterType ?? null) === id
      );
      const group = groups.get(id) ?? {
        id,
        characterId,
        characterType,
        name: option?.name,
        models: []
      };
      group.models.push(model);
      groups.set(id, group);
    }
    return [...groups.values()].filter((group) => group.models.length > 0);
  });
  const characterTypeOrder: readonly Live2dCharacterType[] = [
    "game_character",
    "sub_game_character",
    "mob"
  ];
  const groupedCharacterTypes = $derived.by((): CharacterTypeGroup[] =>
    characterTypeOrder
      .map((key) => ({
        key,
        groups: groupedModels.filter(
          (group) => getLive2dCharacterTypeKey(group.characterType) === key
        )
      }))
      .filter((group) => group.groups.length > 0)
  );
  const getCharacterTypeLabel = (key: Live2dCharacterType): string =>
    translate(`live2d.modelSelector.characterType.${key}`);
  const getGroupLabel = (group: Group): string =>
    group.name?.trim() ||
    (group.characterId
      ? `#${group.characterId}`
      : translate("live2d.modelSelector.characterGroupUncategorized"));
  let selectedCharacterType = $state<Live2dCharacterType>("game_character");
  const selectedCharacterTypeGroup = $derived(
    groupedCharacterTypes.find((group) => group.key === selectedCharacterType) ??
      groupedCharacterTypes[0]
  );
  $effect(() => {
    if (selectedCharacterTypeGroup && selectedCharacterType !== selectedCharacterTypeGroup.key) {
      selectedCharacterType = selectedCharacterTypeGroup.key;
    }
  });
  let selectedGroupId = $state("");
  const selectedGroup = $derived(
    selectedCharacterTypeGroup?.groups.find((group) => group.id === selectedGroupId) ??
      selectedCharacterTypeGroup?.groups[0]
  );
  $effect(() => {
    if (
      selectedCharacterTypeGroup &&
      selectedCharacterTypeGroup.groups.length > 0 &&
      !selectedCharacterTypeGroup.groups.some((group) => group.id === selectedGroupId)
    ) {
      selectedGroupId = selectedGroup.id;
    }
  });
  const selectCharacterTypeByOffset = async (index: number) => {
    const characterTypeGroup = groupedCharacterTypes[index];
    if (!characterTypeGroup) return;
    selectedCharacterType = characterTypeGroup.key;
    await tick();
    document.getElementById(`character-type-tab-${characterTypeGroup.key}`)?.focus();
  };
  const handleCharacterTypeKeydown = (event: KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % groupedCharacterTypes.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + groupedCharacterTypes.length) % groupedCharacterTypes.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = groupedCharacterTypes.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    void selectCharacterTypeByOffset(nextIndex);
  };
  const selectGroupByOffset = async (index: number) => {
    const group = selectedCharacterTypeGroup?.groups[index];
    if (!group) return;
    selectedGroupId = group.id;
    await tick();
    document.getElementById(group.id)?.focus();
  };
  const handleGroupKeydown = (event: KeyboardEvent, index: number) => {
    const groups = selectedCharacterTypeGroup?.groups ?? [];
    if (groups.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % groups.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + groups.length) % groups.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = groups.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    void selectGroupByOffset(nextIndex);
  };
  const isLoading = $derived(
    catalog === null || (navigating.to?.url.pathname.startsWith("/live2d") ?? false)
  );
  const emptyTitle = $derived.by(() => {
    if (catalog?.status === "error") return translate("errorPage.title");
    if (catalog?.status === "ready") return translate("live2d.modelSelector.empty");
    return translate("live2d.modelViewer.status.unavailable");
  });
</script>

<svelte:head>
  <title>{translate("live2d.title")}</title>
</svelte:head>

<section aria-labelledby="live2d-title" class="flex min-w-0 flex-col gap-6">
  <header>
    <h1 id="live2d-title" class="text-3xl font-bold tracking-tight text-primary">
      {translate("live2d.kicker")}
    </h1>
  </header>

  <article
    class="card min-w-0 overflow-hidden border border-base-content/10 bg-base-100/90 shadow-sm"
    aria-labelledby="catalog-title"
    aria-busy={isLoading}
  >
    <div class="card-body gap-0 p-0">
      <div
        class="flex flex-col gap-4 border-b border-base-content/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div class="flex items-center gap-4">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon icon="mdi:flask-outline" class="size-6" aria-hidden="true" />
          </span>
          <h2 id="catalog-title" class="card-title text-lg">
            {translate("live2d.modelSelector.title")}
          </h2>
        </div>
        {#if catalog?.status === "ready"}
          <span class="badge badge-ghost h-8 shrink-0 px-3 font-mono tabular-nums">
            {format("live2d.modelSelector.modelCount", "count", catalog.models.length)}
          </span>
        {/if}
      </div>
      {#if isLoading}
        <p
          role="status"
          class="border-b border-base-content/10 px-5 py-3 text-sm text-base-content/70 sm:px-6"
        >
          {translate("live2d.modelSelector.title")}…
        </p>
      {/if}
      {#if catalog?.status === "ready" && catalog.models.length > 0}
        <div class="border-b border-base-content/10 bg-base-200/25 p-4 sm:p-6">
          <div
            class="tabs tabs-box flex w-full flex-wrap gap-1 p-1"
            role="tablist"
            aria-label={translate("live2d.modelSelector.characterNavigation")}
          >
            {#each groupedCharacterTypes as characterTypeGroup (characterTypeGroup.key)}
              <button
                type="button"
                role="tab"
                id={`character-type-tab-${characterTypeGroup.key}`}
                aria-selected={selectedCharacterType === characterTypeGroup.key}
                aria-controls={`character-type-panel-${characterTypeGroup.key}`}
                tabindex={selectedCharacterType === characterTypeGroup.key ? 0 : -1}
                class:tab-active={selectedCharacterType === characterTypeGroup.key}
                class="tab min-h-11 flex-1 px-4 sm:flex-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onclick={() => (selectedCharacterType = characterTypeGroup.key)}
                onkeydown={(event) =>
                  handleCharacterTypeKeydown(
                    event,
                    groupedCharacterTypes.indexOf(characterTypeGroup)
                  )}>{getCharacterTypeLabel(characterTypeGroup.key)}</button
              >
            {/each}
          </div>
        </div>
        {#if selectedCharacterTypeGroup}
          <div
            id={`character-type-panel-${selectedCharacterTypeGroup.key}`}
            role="tabpanel"
            aria-labelledby={`character-type-tab-${selectedCharacterTypeGroup.key}`}
            class="p-4 sm:p-6"
          >
            <div
              class="flex min-w-0 max-w-full gap-2 overflow-x-auto border-b border-base-content/10 pb-3"
              role="tablist"
              aria-label={getCharacterTypeLabel(selectedCharacterTypeGroup.key)}
            >
              {#each selectedCharacterTypeGroup.groups as group (group.id)}
                <button
                  type="button"
                  role="tab"
                  id={group.id}
                  aria-selected={selectedGroup?.id === group.id}
                  aria-controls={selectedGroup?.id === group.id ? `${group.id}-panel` : undefined}
                  tabindex={selectedGroup?.id === group.id ? 0 : -1}
                  class:btn-primary={selectedGroup?.id === group.id}
                  class="btn btn-sm min-h-11 shrink-0 rounded-full border border-base-content/10 px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onclick={() => (selectedGroupId = group.id)}
                  onkeydown={(event) =>
                    handleGroupKeydown(event, selectedCharacterTypeGroup.groups.indexOf(group))}
                  >{getGroupLabel(group)}
                  <span class="text-xs opacity-70">{group.models.length}</span>
                </button>
              {/each}
            </div>
            {#if selectedGroup}
              <div
                id={`${selectedGroup.id}-panel`}
                role="tabpanel"
                aria-labelledby={selectedGroup.id}
              >
                <div class="flex flex-wrap items-end justify-between gap-3 py-5">
                  <div>
                    <p
                      class="text-xs font-semibold uppercase tracking-[0.12em] text-base-content/55"
                    >
                      {getCharacterTypeLabel(selectedCharacterTypeGroup.key)}
                    </p>
                    <h3 class="mt-1 text-lg font-semibold">{getGroupLabel(selectedGroup)}</h3>
                  </div>
                  <p class="text-sm text-base-content/65">
                    {format(
                      "live2d.modelSelector.modelCount",
                      "count",
                      selectedGroup.models.length
                    )}
                  </p>
                </div>
                <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
                  {#each selectedGroup.models as model (model.id)}
                    <li class="min-w-0">
                      <a
                        href={`/live2d/${encodeURIComponent(model.id)}`}
                        class="group flex flex-col gap-4 rounded-xl border border-base-content/10 bg-base-200/65 p-4 shadow-sm transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <p
                              class="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-base-content/50"
                            >
                              {translate("live2d.modelSelector.previewBadge")}
                            </p>
                            <h3 class="font-semibold break-all text-base-content">
                              {model.modelName}
                            </h3>
                          </div>
                          <Icon
                            icon="mdi:arrow-right"
                            class="size-5 shrink-0 text-primary transition-transform duration-150 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </div>
                        <p
                          class="border-t border-base-content/10 pt-3 font-mono text-sm break-all text-base-content/75"
                        >
                          {model.modelBase}
                        </p>
                      </a>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/if}
      {:else if !catalog && isLoading}
        <div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3" aria-hidden="true">
          {#each [0, 1, 2] as slot (slot)}
            <div
              class="flex min-h-36 flex-col gap-4 rounded-xl border border-base-content/10 bg-base-200/65 p-4"
            >
              <div class="h-5 w-2/3 rounded bg-base-300"></div>
              <div class="h-4 w-1/2 rounded bg-base-300"></div>
              <div class="mt-auto h-4 w-full rounded bg-base-300"></div>
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="m-5 flex min-h-48 flex-col items-start justify-center gap-4 rounded-xl border border-base-content/10 bg-base-200 p-5 sm:m-6 sm:p-6"
        >
          <div
            role={catalog?.status === "error" ? "alert" : "status"}
            class="flex items-start gap-3"
          >
            <Icon
              icon={catalog?.status === "error" ? "mdi:alert-circle-outline" : "mdi:cube-outline"}
              class="mt-1 size-5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p class="font-semibold">{emptyTitle}</p>
              <p class="mt-2 text-sm/6 text-base-content/75">
                {catalog?.status === "error"
                  ? translate("errorPage.description")
                  : translate("live2d.modelViewer.controls.noneLoaded")}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            <a
              href="/live2d"
              data-sveltekit-reload
              class="btn btn-outline min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >{translate("errorPage.retryAction")}</a
            >
            <a
              href="/"
              class="btn btn-ghost min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >{translate("errorPage.homeAction")}</a
            >
          </div>
        </div>
      {/if}
    </div>
  </article>
</section>
