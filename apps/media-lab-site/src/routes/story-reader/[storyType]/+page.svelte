<script lang="ts">
  import Icon from "@iconify/svelte";
  import StoryPicker from "$lib/components/story-reader/StoryPicker.svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));

  // Validated by `+page.ts`; type navigation lives in the sidebar, so the
  // picker itself has no story-type tabs.
  const storyType = $derived(data.storyType);

  let mode = $state<"text" | "player">("text");
  const modeBase = $derived(mode === "text" ? "/story-reader" : "/live2d/story-reader");
</script>

<svelte:head>
  <title>{translate("storyReader.landing.title")}</title>
</svelte:head>

<section aria-labelledby="story-reader-landing-title" class="flex flex-col gap-6">
  <header>
    <h1 id="story-reader-landing-title" class="text-3xl font-bold tracking-tight text-base-content">
      {translate("storyReader.landing.title")}
    </h1>
  </header>

  <div class="grid gap-4 md:grid-cols-2">
    <label
      class="card h-full cursor-pointer bg-base-100 shadow-sm ring-1 ring-base-content/10 transition-colors"
      class:ring-primary={mode === "text"}
    >
      <div class="card-body gap-4 p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon icon="mdi:script-text-outline" class="size-6" aria-hidden="true" />
          </span>
          <input
            type="radio"
            name="story-reader-mode"
            class="radio radio-primary radio-sm"
            aria-label={translate("storyReader.modes.textOnly.title")}
            bind:group={mode}
            value="text"
          />
        </div>
        <div>
          <h2 class="card-title text-lg">
            {translate("storyReader.modes.textOnly.title")}
          </h2>
          <p class="mt-2 text-sm/6 text-base-content/70">
            {translate("storyReader.modes.textOnly.description")}
          </p>
        </div>
      </div>
    </label>

    <label
      class="card h-full cursor-pointer bg-base-100 shadow-sm ring-1 ring-base-content/10 transition-colors"
      class:ring-primary={mode === "player"}
    >
      <div class="card-body gap-4 p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon icon="mdi:drama-masks" class="size-6" aria-hidden="true" />
          </span>
          <input
            type="radio"
            name="story-reader-mode"
            class="radio radio-primary radio-sm"
            aria-label={translate("storyReader.modes.live2dPlayer.title")}
            bind:group={mode}
            value="player"
          />
        </div>
        <div>
          <h2 class="card-title text-lg">
            {translate("storyReader.modes.live2dPlayer.title")}
          </h2>
          <p class="mt-2 text-sm/6 text-base-content/70">
            {translate("storyReader.modes.live2dPlayer.description")}
          </p>
        </div>
      </div>
    </label>
  </div>

  <StoryPicker
    {storyType}
    {modeBase}
    labels={{
      search: translate("storyReader.picker.search"),
      loading: translate("storyReader.picker.loading"),
      loadFailed: translate("storyReader.picker.loadFailed"),
      empty: translate("storyReader.picker.empty"),
      noMatch: translate("storyReader.picker.noMatch"),
      open: translate("storyReader.picker.open"),
      backToUnits: translate("storyReader.picker.backToUnits")
    }}
  />
</section>
