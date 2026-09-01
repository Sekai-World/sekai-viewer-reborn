<script lang="ts">
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

  // Viewer selection state. The model player adapter consumes these values once
  // it mounts into the studio stage; until then the stage stays reserved and
  // the controls render disabled.
  let selectedMotion = $state("");
  let selectedExpression = $state("");
  let idleMotion = $state(true);
  let playbackLoop = $state(false);
  let playbackSpeed = $state(1);

  // The approved catalog has not supplied a resolved model3.json URL yet. Keep
  // the controller mounted through the browser lifecycle anyway, so the page
  // exercises the same cancellation and teardown seam as the future Pixi /
  // Cubism adapter without guessing an asset path.
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

  const hasUnavailableDescriptor = $derived(viewerState.status === "unavailable");
  const isUnavailable = $derived(
    hasUnavailableDescriptor || data.viewerStatus === "unavailable-model-contract"
  );

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

<section aria-labelledby="live2d-model-viewer-title" class="flex flex-col gap-6">
  <nav class="text-sm">
    <a class="link link-hover inline-flex items-center gap-1 text-primary" href="/live2d">
      <Icon icon="mdi:arrow-left" class="size-4" aria-hidden="true" />
      {translate("live2d.backToLive2d")}
    </a>
  </nav>

  <header class="flex flex-col gap-3">
    <p class="text-sm font-semibold text-primary">{translate("live2d.kicker")}</p>
    <h1 id="live2d-model-viewer-title" class="text-3xl font-bold tracking-tight text-base-content">
      {translate("live2d.modelViewer.title")}
    </h1>
    <p class="max-w-2xl text-base/7 text-base-content/75">
      {translate("live2d.modelViewer.description")}
    </p>
  </header>

  <dl class="grid gap-3 sm:grid-cols-2">
    <div class="rounded-xl border border-base-content/10 bg-base-100 p-3 shadow-sm">
      <dt class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
        {translate("live2d.modelViewer.modelIdLabel")}
      </dt>
      <dd class="mt-1 font-mono text-sm break-all">{data.identity.modelId}</dd>
    </div>
    <div class="rounded-xl border border-base-content/10 bg-base-100 p-3 shadow-sm">
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

  <div class="alert alert-soft" role="status">
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
    class="absolute inset-0"
    data-live2d-stage={data.identity.modelId}
    data-model-id={data.identity.modelId}
    aria-hidden="true"
  ></div>
{/snippet}
