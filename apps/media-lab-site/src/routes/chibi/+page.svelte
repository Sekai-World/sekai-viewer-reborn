<script lang="ts">
  import { navigating } from "$app/state";
  import Icon from "@iconify/svelte";
  import {
    describeChibiModelName,
    getChibiModelTitle,
    type ChibiCatalog,
    type ChibiCatalogModel
  } from "#lib/chibi/chibi-catalog.js";
  import { createI18nTranslator } from "#lib/i18n/runtime.js";
  import { createPageTitle } from "#lib/page-title.js";
  import { getRovingTabIndex } from "#lib/roving-tabs.js";
  import { tick } from "svelte";
  import type { PageData } from "./$types";

  type CatalogSection = "characters" | "others";
  type CharacterGroup = { id: number; name: string; models: ChibiCatalogModel[] };

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));
  const formatCount = (count: number) =>
    translate("chibi.catalog.modelCount").replace("{count}", String(count));

  let catalog = $state<ChibiCatalog | null>(null);
  $effect(() => {
    let cancelled = false;
    catalog = null;

    // SvelteKit unwraps streamed fields in generated PageData types, but the
    // runtime value is still a promise during the initial streamed render.
    void Promise.resolve(data.catalog as unknown as ChibiCatalog | PromiseLike<ChibiCatalog>).then(
      (nextCatalog) => {
        if (!cancelled) catalog = nextCatalog;
      },
      () => {
        if (!cancelled) catalog = { status: "error" };
      }
    );

    return () => {
      cancelled = true;
    };
  });

  const readyCatalog = $derived(catalog?.status === "ready" ? catalog : null);
  const characterGroups = $derived.by((): CharacterGroup[] => {
    if (!readyCatalog) return [];
    return readyCatalog.characters
      .map((character) => ({
        ...character,
        models: readyCatalog.models.filter((model) => model.characterId === character.id)
      }))
      .filter((group) => group.models.length > 0);
  });
  const otherModels = $derived(
    readyCatalog?.models.filter((model) => model.characterId === null) ?? []
  );
  const sections = $derived.by((): CatalogSection[] => [
    ...(characterGroups.length > 0 ? (["characters"] as const) : []),
    ...(otherModels.length > 0 ? (["others"] as const) : [])
  ]);

  let requestedSection = $state<CatalogSection>("characters");
  const selectedSection = $derived(
    sections.includes(requestedSection) ? requestedSection : sections[0]
  );
  let requestedCharacterId = $state<number | null>(null);
  const selectedCharacter = $derived(
    characterGroups.find((group) => group.id === requestedCharacterId) ?? characterGroups[0]
  );
  const visibleModels = $derived(
    selectedSection === "characters" ? (selectedCharacter?.models ?? []) : otherModels
  );

  const handleSectionKeydown = async (event: KeyboardEvent, index: number) => {
    const nextIndex = getRovingTabIndex(event.key, index, sections.length);
    if (nextIndex === null) return;
    event.preventDefault();
    requestedSection = sections[nextIndex];
    await tick();
    document.getElementById(`chibi-section-tab-${sections[nextIndex]}`)?.focus();
  };
  const handleCharacterKeydown = async (event: KeyboardEvent, index: number) => {
    const nextIndex = getRovingTabIndex(event.key, index, characterGroups.length);
    if (nextIndex === null) return;
    event.preventDefault();
    requestedCharacterId = characterGroups[nextIndex].id;
    await tick();
    document.getElementById(`chibi-character-tab-${characterGroups[nextIndex].id}`)?.focus();
  };

  const sectionLabels = $derived<Record<CatalogSection, string>>({
    characters: translate("chibi.catalog.section.characters"),
    others: translate("chibi.catalog.section.others")
  });
  const isLoading = $derived(catalog === null || navigating.to?.url.pathname === "/chibi");
  const isError = $derived(catalog !== null && catalog.status !== "ready");
  const getModelLabel = (model: ChibiCatalogModel): string =>
    model.characterId === null
      ? getChibiModelTitle(model.modelName)
      : describeChibiModelName(model.modelName).variant;
  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
</script>

<svelte:head>
  <title>{createPageTitle(translate("chibi.title"))}</title>
</svelte:head>

<section aria-labelledby="chibi-title" class="flex min-w-0 flex-col gap-6">
  <header>
    <h1 id="chibi-title" class="text-3xl font-bold tracking-tight text-base-content">
      {translate("chibi.kicker")}
    </h1>
  </header>

  <article
    class="card min-w-0 overflow-hidden border border-base-content/10 bg-base-100/90 shadow-sm"
    aria-labelledby="chibi-catalog-title"
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
            <Icon icon="mdi:human-child" class="size-6" aria-hidden="true" />
          </span>
          <h2 id="chibi-catalog-title" class="card-title text-lg">
            {translate("chibi.catalog.title")}
          </h2>
        </div>
        {#if readyCatalog}
          <span class="badge badge-ghost h-8 shrink-0 px-3 font-mono tabular-nums">
            {formatCount(readyCatalog.models.length)}
          </span>
        {/if}
      </div>
      {#if isLoading}
        <p
          role="status"
          class="border-b border-base-content/10 px-5 py-3 text-sm text-base-content/70 sm:px-6"
        >
          {translate("chibi.catalog.loading")}
        </p>
      {/if}
      {#if readyCatalog && selectedSection}
        <div class="border-b border-base-content/10 bg-base-200/25 p-4 sm:p-6">
          <div
            class="tabs tabs-box flex w-full flex-wrap gap-1 p-1"
            role="tablist"
            aria-label={translate("chibi.catalog.sectionNavigation")}
          >
            {#each sections as section, index (section)}
              <button
                type="button"
                role="tab"
                id={`chibi-section-tab-${section}`}
                aria-selected={selectedSection === section}
                aria-controls="chibi-section-panel"
                tabindex={selectedSection === section ? 0 : -1}
                class:tab-active={selectedSection === section}
                class={`tab min-h-11 flex-1 px-4 sm:flex-none ${focusRing}`}
                onclick={() => (requestedSection = section)}
                onkeydown={(event) => handleSectionKeydown(event, index)}
                >{sectionLabels[section]}</button
              >
            {/each}
          </div>
        </div>
        <div
          id="chibi-section-panel"
          role="tabpanel"
          aria-labelledby={`chibi-section-tab-${selectedSection}`}
          class="p-4 sm:p-6"
        >
          {#if selectedSection === "characters" && selectedCharacter}
            <div
              class="mb-5 flex max-w-full min-w-0 gap-2 overflow-x-auto border-b border-base-content/10 pb-3"
              role="tablist"
              aria-label={translate("chibi.catalog.section.characters")}
            >
              {#each characterGroups as group, index (group.id)}
                <button
                  type="button"
                  role="tab"
                  id={`chibi-character-tab-${group.id}`}
                  aria-selected={selectedCharacter.id === group.id}
                  aria-controls="chibi-model-list"
                  tabindex={selectedCharacter.id === group.id ? 0 : -1}
                  class:btn-primary={selectedCharacter.id === group.id}
                  class={`btn btn-sm min-h-11 shrink-0 rounded-full border border-base-content/10 px-4 ${focusRing}`}
                  onclick={() => (requestedCharacterId = group.id)}
                  onkeydown={(event) => handleCharacterKeydown(event, index)}
                  >{group.name}
                  <span class="text-xs opacity-70">{group.models.length}</span>
                </button>
              {/each}
            </div>
          {/if}
          <div
            id="chibi-model-list"
            role={selectedSection === "characters" ? "tabpanel" : undefined}
            aria-labelledby={selectedSection === "characters" && selectedCharacter
              ? `chibi-character-tab-${selectedCharacter.id}`
              : undefined}
          >
            <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {#each visibleModels as model (model.modelName)}
                <li class="min-w-0">
                  <a
                    href={`/chibi/${model.modelName}`}
                    class={`group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-200/65 p-4 shadow-sm transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-base-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${focusRing}`}
                  >
                    <span class="flex min-w-0 flex-wrap items-center gap-2">
                      <span class="font-semibold wrap-break-word text-base-content"
                        >{getModelLabel(model)}</span
                      >
                      {#if model.family === "v2"}
                        <span class="badge badge-outline badge-sm shrink-0"
                          >{translate("chibi.catalog.updatedModel")}</span
                        >
                      {/if}
                    </span>
                    <Icon
                      icon="mdi:arrow-right"
                      class="size-5 shrink-0 text-primary transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      {:else if catalog === null}
        <div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3" aria-hidden="true">
          {#each [0, 1, 2, 3, 4, 5] as slot (slot)}
            <div
              class="flex min-h-16 items-center rounded-xl border border-base-content/10 bg-base-200/65 p-4"
            >
              <div class="h-5 w-2/3 rounded bg-base-300"></div>
            </div>
          {/each}
        </div>
      {:else}
        <div
          class="m-5 flex min-h-48 flex-col items-start justify-center gap-4 rounded-xl border border-base-content/10 bg-base-200 p-5 sm:m-6 sm:p-6"
        >
          <div role={isError ? "alert" : "status"} class="flex items-start gap-3">
            <Icon
              icon={isError ? "mdi:alert-circle-outline" : "mdi:cube-outline"}
              class="mt-1 size-5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p class="font-semibold">
                {isError
                  ? translate("chibi.catalog.error.title")
                  : translate("chibi.catalog.empty.title")}
              </p>
              <p class="mt-2 text-sm/6 text-base-content/75">
                {isError
                  ? translate("chibi.catalog.error.description")
                  : translate("chibi.catalog.empty.description")}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            <a href="/chibi" data-sveltekit-reload class={`btn btn-outline min-h-11 ${focusRing}`}
              >{translate("errorPage.retryAction")}</a
            >
            <a href="/" class={`btn btn-ghost min-h-11 ${focusRing}`}
              >{translate("errorPage.homeAction")}</a
            >
          </div>
        </div>
      {/if}
    </div>
  </article>
</section>
