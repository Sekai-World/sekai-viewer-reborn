<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { StoryRouteIdentity } from "#lib/live2d/story-route.js";

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
  // The story's own name leads the page when master data resolved one; the
  // reader mode (kicker, or the mode title) becomes the small label above it.
  const heading = $derived(subtitle ?? title);
  const eyebrow = $derived(subtitle ? (kicker ?? title) : kicker);
</script>

<section aria-labelledby={`${uid}-title`} class="flex flex-col gap-5">
  <nav class="flex flex-wrap items-center justify-between gap-2 text-sm">
    <a class="link link-hover inline-flex items-center gap-1 text-primary" href={backHref}>
      <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
      {backLabel}
    </a>
    {#if showSwitchMode}
      <a class="link link-hover inline-flex items-center gap-1 text-primary" href={switchModeHref}>
        <Icon icon="mdi:swap-horizontal" class="size-4" aria-hidden="true" />
        {switchModeLabel}
      </a>
    {/if}
  </nav>

  <!-- Episode banners are small fixed-size thumbnails (e.g. 280x144). On narrow
       screens they shrink into a thumbnail beside the title; from `lg` up they
       sit at the right edge at their natural size. -->
  <div class="flex items-start gap-4 lg:justify-between lg:gap-8">
    {#if bannerUrl}
      <img
        src={bannerUrl}
        alt=""
        class="h-auto w-24 shrink-0 rounded-lg border border-base-content/10 sm:w-36 lg:order-last lg:w-auto lg:max-h-56 lg:max-w-sm lg:rounded-xl"
        loading="lazy"
      />
    {/if}
    <header class="flex min-w-0 flex-1 flex-col gap-2 lg:flex-none">
      {#if eyebrow}
        <p class="text-sm font-semibold text-primary">{eyebrow}</p>
      {/if}
      <h1
        id={`${uid}-title`}
        class="text-2xl font-bold tracking-tight text-balance text-base-content [word-break:auto-phrase] sm:text-3xl"
      >
        {heading}
      </h1>
      {#if description}
        <p class="max-w-2xl text-base/7 text-base-content/75">{description}</p>
      {/if}
    </header>
  </div>

  <dl class="flex flex-wrap gap-2 text-sm">
    <div
      class="inline-flex items-center rounded-full border border-base-content/10 bg-base-100 px-3 py-1 shadow-sm"
    >
      <dt class="sr-only">{metaLabels.region}</dt>
      <dd class="font-semibold">{regionLabel}</dd>
    </div>
    <div
      class="inline-flex items-center rounded-full border border-base-content/10 bg-base-100 px-3 py-1 shadow-sm"
    >
      <dt class="sr-only">{metaLabels.storyType}</dt>
      <dd class="font-semibold">{storyTypeLabel}</dd>
    </div>
    <div
      class="inline-flex items-center rounded-full border border-base-content/10 bg-base-100 px-3 py-1 shadow-sm"
    >
      <dt class="sr-only">{metaLabels.storyId}</dt>
      <dd class="font-mono break-all">{identity.storyId}</dd>
    </div>
  </dl>
</section>
