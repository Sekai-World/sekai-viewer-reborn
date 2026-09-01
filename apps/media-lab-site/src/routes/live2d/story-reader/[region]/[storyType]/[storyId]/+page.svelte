<script lang="ts">
  import Icon from "@iconify/svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import type { StoryRouteStoryType } from "$lib/live2d/story-route";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));

  const storyTypeLabels = $derived({
    unit: translate("storyReader.storyType.unit"),
    event: translate("storyReader.storyType.event"),
    character: translate("storyReader.storyType.character"),
    card: translate("storyReader.storyType.card"),
    "area-talk": translate("storyReader.storyType.area-talk"),
    special: translate("storyReader.storyType.special"),
    profile: translate("storyReader.storyType.profile")
  }) satisfies Record<StoryRouteStoryType, string>;
</script>

<svelte:head>
  <title>{translate("storyReader.title")}</title>
</svelte:head>

<section aria-labelledby="story-reader-title" class="flex flex-col gap-6">
  <nav class="text-sm">
    <a class="link link-hover inline-flex items-center gap-1 text-primary" href="/live2d">
      <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
      {translate("storyReader.backToLive2d")}
    </a>
  </nav>

  <header class="flex flex-col gap-3">
    <p class="text-sm font-semibold text-primary">{translate("storyReader.kicker")}</p>
    <h1 id="story-reader-title" class="text-3xl font-bold tracking-tight text-base-content">
      {translate("storyReader.title")}
    </h1>
    <p class="max-w-2xl text-base/7 text-base-content/75">{translate("storyReader.description")}</p>
  </header>

  <dl class="grid gap-3 sm:grid-cols-3">
    <div class="rounded-xl border border-base-content/10 bg-base-100 p-3 shadow-sm">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {translate("storyReader.meta.region")}
      </dt>
      <dd class="mt-1 font-semibold">{translate(`region.${data.identity.region}`)}</dd>
    </div>
    <div class="rounded-xl border border-base-content/10 bg-base-100 p-3 shadow-sm">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {translate("storyReader.meta.storyType")}
      </dt>
      <dd class="mt-1 font-semibold">{storyTypeLabels[data.identity.storyType]}</dd>
    </div>
    <div class="rounded-xl border border-base-content/10 bg-base-100 p-3 shadow-sm">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {translate("storyReader.meta.storyId")}
      </dt>
      <dd class="mt-1 font-mono text-sm break-all">{data.identity.storyId}</dd>
    </div>
  </dl>

  <div class="alert alert-soft" role="status">
    <Icon icon="mdi:progress-wrench" class="size-5 shrink-0" aria-hidden="true" />
    <div>
      <p class="font-semibold">{translate("storyReader.status.title")}</p>
      <p class="text-sm/6 opacity-80">{translate("storyReader.status.description")}</p>
    </div>
  </div>

  <div class="flex flex-col gap-2">
    <div
      class="relative aspect-video w-full overflow-hidden rounded-2xl border border-base-content/10 bg-base-200/60"
      aria-hidden="true"
    >
      <div class="absolute inset-0 grid place-items-center">
        <div class="flex w-2/3 max-w-sm flex-col gap-3">
          <div class="h-3 w-1/3 rounded-full bg-base-content/10"></div>
          <div class="h-3 w-full rounded-full bg-base-content/10"></div>
          <div class="h-3 w-5/6 rounded-full bg-base-content/10"></div>
        </div>
      </div>
    </div>
    <p class="text-sm text-base-content/60" role="status">
      {translate("storyReader.loading.label")}
    </p>
  </div>
</section>
