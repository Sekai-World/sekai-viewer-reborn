<script lang="ts">
  import { navigating } from "$app/state";
  import Icon from "@iconify/svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import { getLive2dCharacterGroupKey } from "$lib/live2d/character-grouping";
  import { tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import type { PageData } from "./$types";

  type CharacterOption = {
    id: number | string | null;
    characterType?: string | null;
    name?: string;
    modelCount?: number;
  };
  type Live2dPageData = PageData & { characters?: readonly CharacterOption[] };
  let { data }: { data: Live2dPageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));
  const format = (key: string, token: string, value: string | number) =>
    translate(key).replace(`{${token}}`, String(value));

  const catalog = $derived(data.catalog);
  type CatalogModel = (typeof data.catalog.models)[number];
  type Group = {
    id: string;
    characterId: string | null;
    characterType: string | null;
    name?: string;
    models: CatalogModel[];
  };
  const characterOptions = $derived(data.characters ?? []);
  const getMetadata = (
    model: CatalogModel,
    key: "characterId" | "character2dId" | "characterType"
  ) => {
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

    for (const model of catalog.models) {
      const characterId = getMetadata(model, "characterId");
      const characterType = getMetadata(model, "characterType");
      const id = getLive2dCharacterGroupKey(characterId, characterType);
      const option = characterOptions.find(
        (candidate) =>
          candidate.id !== null &&
          candidate.id !== undefined &&
          getLive2dCharacterGroupKey(String(candidate.id), candidate.characterType ?? null) === id
      );
      const group =
        groups.get(id) ?? { id, characterId, characterType, name: option?.name, models: [] };
      group.models.push(model);
      groups.set(id, group);
    }
    return [...groups.values()].filter((group) => group.models.length > 0);
  });
  const getGroupLabel = (group: Group): string =>
    group.name?.trim() ||
    (group.characterId
      ? `#${group.characterId}`
      : translate("live2d.modelSelector.characterGroupUncategorized"));
  let selectedGroupId = $state("");
  const selectedGroup = $derived(
    groupedModels.find((group) => group.id === selectedGroupId) ?? groupedModels[0]
  );
  $effect(() => {
    if (selectedGroup && !groupedModels.some((group) => group.id === selectedGroupId)) {
      selectedGroupId = selectedGroup.id;
    }
  });
  const selectGroupByOffset = async (index: number) => {
    const group = groupedModels[index];
    if (!group) return;
    selectedGroupId = group.id;
    await tick();
    document.getElementById(group.id)?.focus();
  };
  const handleGroupKeydown = (event: KeyboardEvent, index: number) => {
    if (groupedModels.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % groupedModels.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + groupedModels.length) % groupedModels.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = groupedModels.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    void selectGroupByOffset(nextIndex);
  };
  const isLoading = $derived(navigating.to?.url.pathname.startsWith("/live2d") ?? false);
  const emptyTitle = $derived.by(() => {
    if (catalog?.status === "error") return translate("errorPage.title");
    if (catalog?.status === "ready") return translate("live2d.modelSelector.empty");
    return translate("live2d.modelViewer.status.unavailable");
  });
</script>

<svelte:head>
  <title>{translate("live2d.title")}</title>
</svelte:head>

<section aria-labelledby="live2d-title" class="flex flex-col gap-6">
  <header class="max-w-2xl">
    <p class="text-sm font-semibold text-primary">{translate("live2d.kicker")}</p>
    <h1 id="live2d-title" class="mt-1 text-3xl font-bold tracking-tight text-base-content">
      {translate("live2d.title")}
    </h1>
    <p class="mt-3 text-base/7 text-base-content/75">
      {translate("live2d.modelViewer.status.description")}
    </p>
  </header>

  <article
    class="card min-w-0 border border-base-content/10 bg-base-100"
    aria-labelledby="catalog-title"
    aria-busy={isLoading}
  >
    <div class="card-body gap-4 p-5 sm:p-6">
      <div class="flex items-start gap-4">
        <span
          class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
        >
          <Icon icon="mdi:flask-outline" class="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 id="catalog-title" class="card-title text-lg">
            {translate("live2d.modelSelector.title")}
          </h2>
          {#if catalog?.status === "ready"}
            <p class="mt-1 text-sm text-base-content/70">
              {catalog.models.length.toLocaleString(data.uiLocale)}
            </p>
          {/if}
        </div>
      </div>
      {#if isLoading}
        <p role="status" class="text-sm text-base-content/70">
          {translate("live2d.modelSelector.title")}…
        </p>
      {/if}
      {#if catalog?.status === "ready" && catalog.models.length > 0}
        <div class="rounded-xl border border-base-content/10 bg-base-200/60 p-3">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-base-content/60">
            {translate("live2d.modelSelector.characterNavigation")}
          </p>
          <p class="mt-1 text-sm text-base-content/70">
            {translate("live2d.modelSelector.characterNavigationDescription")}
          </p>
          <div
            class="mt-3 flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label={translate("live2d.modelSelector.characterNavigation")}
          >
            {#each groupedModels as group (group.id)}
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
                onkeydown={(event) => handleGroupKeydown(event, groupedModels.indexOf(group))}
                >{getGroupLabel(group)}
                <span class="text-xs opacity-70">{group.models.length}</span>
              </button>
            {/each}
          </div>
        </div>
        {#if selectedGroup}
          <div id={`${selectedGroup.id}-panel`} role="tabpanel" aria-labelledby={selectedGroup.id}>
            <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="text-lg font-semibold">
                {getGroupLabel(selectedGroup)}
              </h3>
              <p class="text-sm text-base-content/65">
                {format("live2d.modelSelector.modelCount", "count", selectedGroup.models.length)}
              </p>
            </div>
            <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {#each selectedGroup.models as model (model.id)}
                <li class="min-w-0">
                  <a
                    href={`/live2d/${encodeURIComponent(model.id)}`}
                    class="flex h-full flex-col gap-3 rounded-xl border border-base-content/10 bg-base-200 p-4 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <h3 class="min-w-0 font-semibold break-all">{model.modelName}</h3>
                      <Icon
                        icon="mdi:arrow-right"
                        class="size-5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    </div>
                    <p class="font-mono text-sm break-all text-base-content/75">
                      {model.modelBase}
                    </p>
                    <p class="font-mono text-xs/6 break-all text-base-content/70">
                      {model.modelPath}
                    </p>
                    {#if getMetadata(model, "character2dId")}
                      {@const character2dId = getMetadata(model, "character2dId")}
                      <p class="text-xs text-base-content/65">
                        <span class="font-semibold"
                          >{translate("live2d.modelSelector.character2dId")}:</span
                        > <span class="font-mono break-all">{character2dId}</span>
                      </p>
                    {/if}
                    <div
                      class="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-base-content/10 pt-3 text-sm"
                    >
                      <span class="min-w-0 font-mono break-all text-base-content/70">
                        {model.id}
                      </span>
                      <span class="font-semibold text-primary">
                        {translate("live2d.modelSelector.inputAction")}
                      </span>
                    </div>
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {:else if !catalog && isLoading}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {#each [0, 1, 2] as slot (slot)}
            <div
              class="flex min-h-48 flex-col gap-4 rounded-xl border border-base-content/10 bg-base-200 p-4"
            >
              <div class="h-5 w-2/3 rounded bg-base-300"></div>
              <div class="h-4 w-1/2 rounded bg-base-300"></div>
              <div class="mt-auto h-4 w-full rounded bg-base-300"></div>
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="flex min-h-48 flex-col items-start justify-center gap-4 rounded-xl border border-base-content/10 bg-base-200 p-5 sm:p-6"
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
