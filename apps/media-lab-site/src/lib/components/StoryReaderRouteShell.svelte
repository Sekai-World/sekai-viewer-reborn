<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { StoryRouteIdentity } from "$lib/live2d/story-route";

  /** Localized labels, resolved by the hosting route's translator. */
  interface Props {
    /** Validated story address returned by the route's server loader. */
    identity: StoryRouteIdentity;
    backHref: string;
    backLabel: string;
    kicker: string;
    title: string;
    description: string;
    metaLabels: { region: string; storyType: string; storyId: string };
    /** Localized region name for `identity.region`. */
    regionLabel: string;
    /** Localized story-type name for `identity.storyType`. */
    storyTypeLabel: string;
    statusTitle: string;
    statusDescription: string;
    /** Status line under the reserved stage. */
    stageNote: string;
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
    statusTitle,
    statusDescription,
    stageNote,
    switchModeHref,
    switchModeLabel
  }: Props = $props();

  const uid = $props.id();
  const showSwitchMode = $derived(Boolean(switchModeHref && switchModeLabel));
</script>

<section aria-labelledby={`${uid}-title`} class="flex flex-col gap-6">
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

  <header class="flex flex-col gap-3">
    <p class="text-sm font-semibold text-primary">{kicker}</p>
    <h1 id={`${uid}-title`} class="text-3xl font-bold tracking-tight text-base-content">
      {title}
    </h1>
    <p class="max-w-2xl text-base/7 text-base-content/75">{description}</p>
  </header>

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

  <div class="alert alert-soft" role="status">
    <Icon icon="mdi:progress-wrench" class="size-5 shrink-0" aria-hidden="true" />
    <div>
      <p class="font-semibold">{statusTitle}</p>
      <p class="text-sm/6 opacity-80">{statusDescription}</p>
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
      {stageNote}
    </p>
  </div>
</section>
