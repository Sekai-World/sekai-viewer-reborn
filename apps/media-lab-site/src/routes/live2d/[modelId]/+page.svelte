<script lang="ts">
  import { navigating } from "$app/state";
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import Live2dModelStudio from "$lib/components/Live2dModelStudio.svelte";
  import {
    createLive2dModelViewer,
    type Live2dModelViewerState
  } from "$lib/live2d/model-viewer";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));
  const catalog = $derived(data.catalog);
  const model = $derived(catalog?.status === "ready" ? catalog.model : null);
  const descriptor = $derived(catalog?.status === "ready" ? catalog.descriptor : null);
  const isLoading = $derived(navigating.to?.url.pathname.startsWith("/live2d/") ?? false);

  // Viewer selection state. The model player adapter consumes these values once
  // it mounts into the studio stage; until then the stage stays reserved and
  // the controls render disabled.
  let selectedMotion = $state("");
  let selectedExpression = $state("");
  let idleMotion = $state(true);
  let playbackLoop = $state(false);
  let playbackSpeed = $state(1);

  // Catalog readiness is not player readiness. Preserve the lifecycle seam,
  // but do not attempt to load a descriptor into a nonexistent browser adapter.
  const viewer = createLive2dModelViewer({
    load: async () => {
      throw new Error("No browser model adapter is configured");
    }
  });
  let viewerState = $state<Live2dModelViewerState>(viewer.getState());

  const playerAdapter = $derived({
    controlsEnabled: viewerState.status === "ready",
    motions: viewerState.status === "ready" ? viewerState.descriptor.motions.map(({ id }) => id) : [],
    expressions:
      viewerState.status === "ready" ? viewerState.descriptor.expressions.map(({ id }) => id) : [],
    applyMotion: () => void viewer.playMotion(selectedMotion),
    applyExpression: () => void viewer.playExpression(selectedExpression),
    pause: () => void viewer.pause(),
    reset: () => void viewer.reset(),
    reload: () => void viewer.reload()
  });

  const isUnavailable = $derived(!descriptor);

  onMount(() => {
    const unsubscribe = viewer.subscribe((nextState) => {
      viewerState = nextState;
    });
    void viewer.load(null);

    return () => {
      unsubscribe();
      void viewer.destroy();
    };
  });

  // Command synchronization for the playback-state controls: option changes
  // flow into the imperative controller without racing its ready state. The
  // controller ignores commands after destroy, so no cleanup is needed.
  $effect(() => {
    viewer.setPlaybackOptions({ loop: playbackLoop, speed: playbackSpeed });
    void viewer.setIdle(idleMotion);
  });

  const studioLabels = $derived({
    controlsTitle: translate("live2d.modelViewer.controls.title"),
    motion: translate("live2d.modelViewer.controls.motion"),
    motionEmpty: translate("live2d.modelViewer.controls.motionEmpty"),
    expression: translate("live2d.modelViewer.controls.expression"),
    expressionEmpty: translate("live2d.modelViewer.controls.expressionEmpty"),
    noneLoaded: translate("live2d.modelViewer.controls.noneLoaded"),
    apply: translate("live2d.modelViewer.controls.apply"),
    pause: translate("live2d.modelViewer.controls.pause"),
    loop: translate("live2d.modelViewer.controls.loop"),
    speed: translate("live2d.modelViewer.controls.speed"),
    idleBreath: translate("live2d.modelViewer.controls.idleBreath"),
    reload: translate("live2d.modelViewer.controls.reload"),
    reset: translate("live2d.modelViewer.controls.reset"),
    controlsHint: translate("live2d.modelViewer.controls.hint")
  });
</script>

<svelte:head>
  <title>{translate("live2d.modelViewer.title")}</title>
</svelte:head>

<section aria-labelledby="live2d-model-viewer-title" aria-busy={isLoading} class="flex min-w-0 flex-col gap-6">
  <nav class="text-sm">
    <a
      class="link link-hover inline-flex min-h-11 items-center gap-2 rounded-lg text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href="/live2d"
    >
      <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
      {translate("live2d.backToLive2d")}
    </a>
  </nav>

  <header class="flex flex-col gap-3">
    <p class="text-sm font-semibold text-primary">{translate("live2d.kicker")}</p>
    <h1
      id="live2d-model-viewer-title"
      class="text-3xl font-bold tracking-tight break-all text-base-content"
    >
      {model?.modelName ?? translate("live2d.modelViewer.title")}
    </h1>
    <p class="max-w-2xl text-base/7 text-base-content/75">
      {translate("live2d.modelViewer.status.description")}
    </p>
  </header>

  {#if isLoading}
    <p role="status" class="text-sm text-base-content/70">
      {translate("live2d.modelViewer.title")}…
    </p>
  {/if}

  {#if catalog?.status === "error"}
    <div class="alert alert-error alert-soft" role="alert">
      <Icon icon="mdi:alert-circle-outline" class="size-5 shrink-0" aria-hidden="true" />
      <div>
        <h2 class="font-semibold">
          {translate("live2d.modelSelector.title")} — {translate("errorPage.title")}
        </h2>
        <p class="mt-1 text-sm/6">{translate("errorPage.description")}</p>
      </div>
      <a
        href={`/live2d/${encodeURIComponent(data.identity.modelId)}`}
        data-sveltekit-reload
        class="btn btn-outline min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >{translate("errorPage.retryAction")}</a>
    </div>
  {/if}

  <dl class="grid gap-3 sm:grid-cols-2">
    <div class="min-w-0 rounded-xl border border-base-content/10 bg-base-100 p-4">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {translate("live2d.modelViewer.modelIdLabel")}
      </dt>
      <dd class="mt-1 font-mono text-sm break-all">{data.identity.modelId}</dd>
    </div>
    <div class="min-w-0 rounded-xl border border-base-content/10 bg-base-100 p-4">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {translate("live2d.modelViewer.status.label")}
      </dt>
      <dd class="mt-1 font-semibold">
        {isUnavailable
          ? translate("live2d.modelViewer.status.unavailable")
          : translate("live2d.modelViewer.status.awaitingAdapter")}
      </dd>
    </div>
  </dl>

  {#if model}
    <section
      aria-labelledby="model-catalog-title"
      class="card min-w-0 border border-base-content/10 bg-base-100"
    >
      <div class="card-body gap-4 p-5 sm:p-6">
        <h2 id="model-catalog-title" class="card-title text-lg">
          {translate("live2d.modelSelector.title")}
        </h2>
        <div class="min-w-0 rounded-xl border border-base-content/10 bg-base-200 p-4">
          <p class="font-mono text-sm font-semibold break-all">{model.modelBase}</p>
          <p class="mt-2 font-mono text-sm/6 break-all text-base-content/75">
            {model.modelPath}
          </p>
          <p class="mt-2 font-mono text-xs/6 break-all text-base-content/70">
            {descriptor?.modelUrl}
          </p>
        </div>
        <h3 class="font-semibold">{translate("live2d.modelViewer.controls.motion")}</h3>
        {#each model.motionSets as motionSet (motionSet.motionSetId)}
          <details class="min-w-0 rounded-xl border border-base-content/10 bg-base-200">
            <summary
              class="min-h-11 cursor-pointer rounded-xl p-4 font-mono text-sm break-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >{motionSet.motionSetId}</summary>
            <div class="grid min-w-0 gap-4 border-t border-base-content/10 p-4 md:grid-cols-2">
              <!-- Keep body and facial file groups distinct. Facial motion3
                   files are metadata, not playable Cubism expressions. -->
              {#each [{ path: motionSet.motionPath, files: motionSet.motionFiles }, { path: motionSet.facialPath, files: motionSet.facialFiles }] as group, index (index)}
                <div class="min-w-0">
                  <h4 class="font-mono text-sm/6 font-semibold break-all">{group.path}</h4>
                  <ul class="mt-3 space-y-2 text-base-content/75" role="list">
                    {#each group.files as file (file)}
                      <li class="font-mono text-xs/6 break-all">{file}</li>
                    {:else}
                      <li class="text-sm/6">{translate("live2d.modelViewer.controls.noneLoaded")}</li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          </details>
        {:else}
          <p role="status" class="rounded-xl bg-base-200 p-4 text-sm/6 text-base-content/75">
            {translate("live2d.modelViewer.controls.noneLoaded")}
          </p>
        {/each}
      </div>
    </section>
  {/if}

  <div class="alert alert-warning alert-soft" role="status">
    <Icon icon="mdi:progress-wrench" class="size-5 shrink-0" aria-hidden="true" />
    <div>
      <p class="font-semibold">
        {isUnavailable
          ? translate("live2d.modelViewer.status.unavailableTitle")
          : translate("live2d.modelViewer.status.title")}
      </p>
      <p class="text-sm/6 opacity-80">
        {isUnavailable
          ? translate("live2d.modelViewer.status.unavailableDescription")
          : translate("live2d.modelViewer.status.description")}
      </p>
    </div>
  </div>

  <Live2dModelStudio
    labels={studioLabels}
    statusLine={
      isUnavailable
        ? translate("live2d.modelViewer.stage.unavailable")
        : translate("live2d.modelViewer.stage.reserved")
    }
    controlsEnabled={playerAdapter.controlsEnabled}
    motions={playerAdapter.motions}
    expressions={playerAdapter.expressions}
    stage={modelStage}
    onApplyMotion={playerAdapter.applyMotion}
    onApplyExpression={playerAdapter.applyExpression}
    onPause={playerAdapter.pause}
    onReset={playerAdapter.reset}
    onReload={playerAdapter.reload}
    bind:selectedMotion
    bind:selectedExpression
    bind:idleMotion
    bind:loop={playbackLoop}
    bind:speed={playbackSpeed}
  />
</section>

{#snippet modelStage()}
  <div
    class="absolute inset-0 grid place-items-center p-4"
    data-live2d-stage={data.identity.modelId}
    data-model-id={data.identity.modelId}
    aria-hidden="true"
  >
    <div class="flex max-w-sm flex-col items-center gap-3 text-center">
      <Icon icon="mdi:progress-wrench" class="size-8 opacity-60" />
      <p class="text-sm/6">{translate("live2d.modelViewer.status.awaitingAdapter")}</p>
    </div>
  </div>
{/snippet}
