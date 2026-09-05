<script lang="ts">
  import Icon from "@iconify/svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));

  // Mode targets stay on the documented sample story address so both actions
  // deep-link into the same validated route identity.
  const sampleStoryHref = "/story-reader/jp/unit/1";
  const samplePlayerHref = "/live2d/story-reader/jp/unit/1";
</script>

<svelte:head>
  <title>{translate("storyReader.landing.title")}</title>
</svelte:head>

<section aria-labelledby="story-reader-landing-title" class="flex flex-col gap-6">
  <header class="max-w-2xl">
    <p class="text-sm font-semibold text-primary">{translate("storyReader.kicker")}</p>
    <h1
      id="story-reader-landing-title"
      class="mt-1 text-3xl font-bold tracking-tight text-base-content"
    >
      {translate("storyReader.landing.title")}
    </h1>
    <p class="mt-3 text-base/7 text-base-content/75">
      {translate("storyReader.landing.description")}
    </p>
  </header>

  <div class="grid gap-4 md:grid-cols-2">
    <article class="card h-full bg-base-100 shadow-sm ring-1 ring-base-content/10">
      <div class="card-body gap-4 p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon icon="mdi:script-text-outline" class="size-6" aria-hidden="true" />
          </span>
          <span class="badge badge-outline badge-primary">
            {translate("storyReader.modes.textOnly.badge")}
          </span>
        </div>
        <div>
          <h2 class="card-title text-lg">
            {translate("storyReader.modes.textOnly.title")}
          </h2>
          <p class="mt-2 text-sm/6 text-base-content/70">
            {translate("storyReader.modes.textOnly.description")}
          </p>
        </div>
        <div class="card-actions mt-auto flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <a class="btn btn-primary btn-sm min-h-11! px-4" href={sampleStoryHref}>
            {translate("storyReader.modes.textOnly.action")}
            <Icon icon="mdi:arrow-right" class="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>

    <article class="card h-full bg-base-100 shadow-sm ring-1 ring-base-content/10">
      <div class="card-body gap-4 p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon icon="mdi:drama-masks" class="size-6" aria-hidden="true" />
          </span>
          <span class="badge badge-outline badge-primary">
            {translate("storyReader.modes.live2dPlayer.badge")}
          </span>
        </div>
        <div>
          <h2 class="card-title text-lg">
            {translate("storyReader.modes.live2dPlayer.title")}
          </h2>
          <p class="mt-2 text-sm/6 text-base-content/70">
            {translate("storyReader.modes.live2dPlayer.description")}
          </p>
        </div>
        <div class="card-actions mt-auto flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <a class="btn btn-primary btn-sm min-h-11! px-4" href={samplePlayerHref}>
            {translate("storyReader.modes.live2dPlayer.action")}
            <Icon icon="mdi:arrow-right" class="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  </div>

  <p class="text-sm/6 text-base-content/60" role="note">
    {translate("storyReader.modes.sampleNote")}
  </p>
</section>
