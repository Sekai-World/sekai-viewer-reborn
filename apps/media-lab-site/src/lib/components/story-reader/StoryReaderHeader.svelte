<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { StoryRouteIdentity } from "$lib/live2d/story-route";

  /** Shared reader page header: navigation, titles, and story identity meta. */
  interface Props {
    identity: StoryRouteIdentity;
    backHref: string;
    backLabel: string;
    kicker?: string;
    title: string;
    description?: string;
    metaLabels: { region: string; storyType: string; storyId: string };
    regionLabel: string;
    storyTypeLabel: string;
    /** Chapter/episode title resolved from master data. */
    subtitle?: string;
    bannerUrl?: string;
    /** Optional link to the other reading mode for the same story address. */
    switchModeHref?: string;
    switchModeLabel?: string;
  }

  let {
    identity,
    backHref,
    backLabel,
    kicker,
    title,
    description,
    metaLabels,
    regionLabel,
    storyTypeLabel,
    subtitle,
    bannerUrl,
    switchModeHref,
    switchModeLabel
  }: Props = $props();

  const uid = $props.id();
  const showSwitchMode = $derived(Boolean(switchModeHref && switchModeLabel));
</script>

<section aria-labelledby={`${uid}-title`} class="flex flex-col gap-5">
  <nav class="flex flex-wrap items-center justify-between gap-2 text-sm">
    <a class="link link-hover inline-flex items-center gap-1 text-primary" href={backHref}>
      <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
      {backLabel}
    </a>
    {#if showSwitchMode}
      <a
        class="link link-hover inline-flex items-center gap-1 text-primary"
        href={switchModeHref}
      >
        <Icon icon="mdi:swap-horizontal" class="size-4" aria-hidden="true" />
        {switchModeLabel}
      </a>
    {/if}
  </nav>

  <!-- Episode banners are small fixed-size thumbnails (e.g. 280x144); they sit
       beside the title row on wide screens and wrap below it on mobile. -->
  <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
    <header class="flex min-w-0 flex-col gap-3">
      {#if kicker}
        <p class="text-sm font-semibold text-primary">{kicker}</p>
      {/if}
      <h1 id={`${uid}-title`} class="text-3xl font-bold tracking-tight text-base-content">
        {title}
      </h1>
      {#if subtitle}
        <p class="max-w-3xl text-lg/7 font-medium text-base-content/85">{subtitle}</p>
      {/if}
      {#if description}
        <p class="max-w-2xl text-base/7 text-base-content/75">{description}</p>
      {/if}
    </header>

    {#if bannerUrl}
      <img
        src={bannerUrl}
        alt=""
        class="mx-auto size-auto max-h-56 max-w-full self-center rounded-xl border border-base-content/10 lg:mx-0 lg:shrink-0 lg:self-start"
        loading="lazy"
      />
    {/if}
  </div>

  <dl class="grid gap-3 sm:grid-cols-3">
    <div class="rounded-xl border border-base-content/10 bg-base-100 p-3 shadow-sm">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {metaLabels.region}
      </dt>
      <dd class="mt-1 font-semibold">{regionLabel}</dd>
    </div>
    <div class="rounded-xl border border-base-content/10 bg-base-100 p-3 shadow-sm">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {metaLabels.storyType}
      </dt>
      <dd class="mt-1 font-semibold">{storyTypeLabel}</dd>
    </div>
    <div class="rounded-xl border border-base-content/10 bg-base-100 p-3 shadow-sm">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {metaLabels.storyId}
      </dt>
      <dd class="mt-1 font-mono text-sm break-all">{identity.storyId}</dd>
    </div>
  </dl>
</section>
