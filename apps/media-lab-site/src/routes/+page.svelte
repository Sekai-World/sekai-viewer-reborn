<script lang="ts">
  import Icon from "@iconify/svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import { pickerStoryTypeIcons, pickerStoryTypes } from "$lib/story/story-picker";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));
</script>

<svelte:head>
  <title>{translate("shell.title")}</title>
</svelte:head>

<section class="flex flex-col gap-6">
  <p class="mx-auto max-w-xl text-center text-base/7 text-base-content/75">
    {translate("home.tagline")}
  </p>

  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <article class="card h-full bg-base-100 shadow-sm ring-1 ring-base-content/10">
      <div class="card-body gap-4 p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon icon="mdi:book-open-variant" class="size-6" aria-hidden="true" />
          </span>
          <span class="badge badge-outline">
            {translate("home.tracks.storyReader.badge")}
          </span>
        </div>
        <div>
          <h2 class="card-title text-lg">{translate("home.tracks.storyReader.title")}</h2>
          <p class="mt-2 text-sm/6 text-base-content/70">
            {translate("home.tracks.storyReader.description")}
          </p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          {#each pickerStoryTypes as type (type)}
            <a class="btn btn-outline btn-xs border-base-content/20" href={`/story-reader/${type}`}>
              <Icon icon={pickerStoryTypeIcons[type]} class="size-3.5" aria-hidden="true" />
              {translate(`storyReader.storyType.${type}`)}
            </a>
          {/each}
        </div>
        <div class="card-actions mt-auto">
          <a class="btn btn-primary btn-sm min-h-11! px-4" href="/story-reader/unit">
            {translate("home.tracks.storyReader.action")}
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
          <span class="badge badge-outline">
            {translate("home.tracks.live2d.badge")}
          </span>
        </div>
        <div>
          <h2 class="card-title text-lg">{translate("home.tracks.live2d.title")}</h2>
          <p class="mt-2 text-sm/6 text-base-content/70">
            {translate("home.tracks.live2d.description")}
          </p>
        </div>
        <div class="card-actions mt-auto">
          <a class="btn btn-primary btn-sm min-h-11! px-4" href="/live2d">
            {translate("home.tracks.live2d.action")}
            <Icon icon="mdi:arrow-right" class="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>

    <article class="card h-full bg-base-100 shadow-sm ring-1 ring-base-content/10">
      <div class="card-body gap-4 p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-xl border border-base-content/15 bg-base-content/5 text-base-content/70"
          >
            <Icon icon="mdi:cube-outline" class="size-6" aria-hidden="true" />
          </span>
          <span class="badge badge-ghost">{translate("home.tracks.assetViewer.badge")}</span>
        </div>
        <div>
          <h2 class="card-title text-lg">{translate("home.tracks.assetViewer.title")}</h2>
          <p class="mt-2 text-sm/6 text-base-content/70">
            {translate("home.tracks.assetViewer.description")}
          </p>
        </div>
        <div class="card-actions mt-auto">
          <button type="button" class="btn btn-sm min-h-11! px-4" disabled>
            {translate("home.tracks.assetViewer.pending")}
          </button>
        </div>
      </div>
    </article>
  </div>
</section>
