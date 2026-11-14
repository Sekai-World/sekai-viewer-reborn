<script lang="ts">
  import Icon from "@iconify/svelte";
  import ChibiAnimationPicker from "#lib/components/ChibiAnimationPicker.svelte";
  import { getChibiModelTitle, pickDefaultChibiAnimation } from "#lib/chibi/chibi-catalog.js";
  import {
    ChibiAssetLoadError,
    createChibiPlayer,
    type ChibiModelResource,
    type ChibiPlayer
  } from "#lib/chibi/chibi-player.js";
  import { createChibiRuntimeFacade } from "#lib/chibi/chibi-spine-runtime.js";
  import { createI18nTranslator } from "#lib/i18n/runtime.js";
  import { createPageTitle } from "#lib/page-title.js";
  import type { PageData } from "./$types";

  type ViewerStatus = "loading" | "ready" | "unavailable" | "error";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));
  const title = $derived(getChibiModelTitle(data.descriptor.modelName));

  let stageHost = $state<HTMLDivElement>();
  let status = $state<ViewerStatus>("loading");
  let animations = $state<readonly string[]>([]);
  let selectedAnimation = $state("");
  let attempt = $state(0);

  let player: ChibiPlayer | undefined;
  let resource: ChibiModelResource | undefined;

  // SvelteKit may reuse this page for another model, so the load follows the
  // descriptor; `attempt` reruns it for Retry.
  $effect(() => {
    const host = stageHost;
    const descriptor = data.descriptor;
    void attempt;
    if (!host) return;

    const controller = new AbortController();
    let loaded: ChibiModelResource | undefined;
    status = "loading";
    animations = [];
    selectedAnimation = "";
    player ??= createChibiPlayer(createChibiRuntimeFacade());
    player.load(descriptor, host, controller.signal).then(
      (next) => {
        if (controller.signal.aborted) {
          next.destroy();
          return;
        }
        loaded = next;
        resource = next;
        try {
          const defaultAnimation = pickDefaultChibiAnimation(next.animations);
          if (defaultAnimation) next.setAnimation(defaultAnimation);
          animations = next.animations;
          selectedAnimation = defaultAnimation;
          status = "ready";
        } catch {
          status = "error";
        }
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        // The asset host has no atlas for some catalog names. A missing family
        // skeleton is an outage instead, so it stays a retryable error.
        const hasNoAtlas =
          cause instanceof ChibiAssetLoadError && cause.asset === "atlas" && cause.status === 404;
        status = hasNoAtlas ? "unavailable" : "error";
      }
    );

    return () => {
      controller.abort();
      loaded?.destroy();
      if (resource === loaded) resource = undefined;
    };
  });

  $effect(() => {
    const host = stageHost;
    if (!host) return;

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      if (clientWidth > 0 && clientHeight > 0) resource?.resize(clientWidth, clientHeight);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(host);
    if (!observer) window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resize);
    };
  });

  const selectAnimation = (animation: string) => {
    if (resource?.setAnimation(animation)) selectedAnimation = animation;
  };

  const statusLabels = $derived<Record<ViewerStatus, string>>({
    loading: translate("chibi.viewer.status.loading"),
    ready: translate("chibi.viewer.status.ready"),
    unavailable: translate("chibi.viewer.status.unavailable"),
    error: translate("chibi.viewer.status.error")
  });
  const pickerLabels = $derived({
    title: translate("chibi.viewer.animation.title"),
    filterLabel: translate("chibi.viewer.animation.filterLabel"),
    filterPlaceholder: translate("chibi.viewer.animation.filterPlaceholder"),
    noMatches: translate("chibi.viewer.animation.noMatches"),
    count: translate("chibi.viewer.animation.count")
  });
  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
</script>

<svelte:head>
  <title>{createPageTitle(title, translate("chibi.title"))}</title>
</svelte:head>

<section
  aria-labelledby="chibi-viewer-title"
  aria-busy={status === "loading"}
  class="flex min-w-0 flex-col gap-5"
>
  <nav class="text-sm">
    <a
      class={`link inline-flex min-h-11 items-center gap-2 rounded-lg text-primary link-hover ${focusRing}`}
      href="/chibi"
    >
      <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
      {translate("chibi.backToChibi")}
    </a>
  </nav>

  <header class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm font-semibold text-primary">{translate("chibi.kicker")}</p>
      <span
        class="badge h-8 gap-2 badge-outline px-3 text-xs font-semibold"
        data-testid="chibi-viewer-status"
        data-status={status}
      >
        <span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
        {statusLabels[status]}
      </span>
    </div>
    <h1
      id="chibi-viewer-title"
      class="text-3xl font-bold tracking-tight wrap-break-word text-base-content sm:text-4xl"
    >
      {title}
    </h1>
  </header>

  <div class="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
    <div
      class="relative aspect-4/5 min-h-88 w-full overflow-hidden rounded-xl border border-base-content/10 bg-base-200 sm:aspect-4/3 sm:min-h-0"
    >
      <div
        class="absolute inset-0 overflow-hidden [&_canvas]:block [&_canvas]:size-full"
        bind:this={stageHost}
        role="img"
        aria-label={title}
      ></div>
      {#if status !== "ready"}
        <div class="absolute inset-0 grid place-items-center overflow-auto bg-base-200/95 p-4">
          <div class="flex max-w-sm flex-col items-center gap-3 text-center">
            {#if status === "loading"}
              <span class="loading loading-md loading-spinner text-primary" aria-hidden="true"
              ></span>
              <p class="text-sm/6" role="status">{statusLabels.loading}</p>
            {:else if status === "unavailable"}
              <Icon icon="mdi:progress-wrench" class="size-6" aria-hidden="true" />
              <div role="status">
                <p class="font-semibold">{translate("chibi.viewer.unavailable.title")}</p>
                <p class="mt-1 text-sm/6 text-base-content/75">
                  {translate("chibi.viewer.unavailable.description")}
                </p>
              </div>
              <a href="/chibi" class={`btn min-h-11 btn-outline ${focusRing}`}
                >{translate("chibi.backToChibi")}</a
              >
            {:else}
              <Icon icon="mdi:alert-circle-outline" class="size-6" aria-hidden="true" />
              <div role="alert">
                <p class="font-semibold">{translate("chibi.viewer.error.title")}</p>
                <p class="mt-1 text-sm/6 text-base-content/75">
                  {translate("chibi.viewer.error.description")}
                </p>
              </div>
              <button
                type="button"
                class={`btn min-h-11 btn-outline ${focusRing}`}
                onclick={() => (attempt += 1)}>{translate("errorPage.retryAction")}</button
              >
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <ChibiAnimationPicker
      {animations}
      selected={selectedAnimation}
      labels={pickerLabels}
      disabled={status !== "ready"}
      onSelect={selectAnimation}
    />
  </div>
</section>
