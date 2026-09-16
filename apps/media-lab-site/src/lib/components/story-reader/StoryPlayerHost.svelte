<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onMount } from "svelte";
  import type { IScenarioData } from "$lib/story/scenario-types";
  import type {
    StoryPlayerSession,
    StoryPlayerSessionState
  } from "$lib/story/story-player-session";

  /**
   * Browser-only Live2D story player host. Mounts the ported playback engine
   * into a 16:9 stage and exposes click-to-advance plus a controls deck.
   * Pixi, Howler, and the Cubism runtime are only imported here, in the
   * browser, after hydration.
   */
  interface Props {
    scenarioData: IScenarioData;
    voiceCharacters: { character2dId: number; assetName?: string; unit?: string }[];
    region: string;
    assetBase: string;
    regionBucket: string;
    isCardStory: boolean;
    isActionSet: boolean;
    labels: {
      tapToPlay: string;
      playing: string;
      finished: string;
      next: string;
      autoplay: string;
      textAnimation: string;
      voiceVolume: string;
      bgmVolume: string;
      seVolume: string;
      loading: string;
      loadFailed: string;
      warnings: string;
      stateReady: string;
    };
  }

  let {
    scenarioData,
    voiceCharacters,
    region,
    assetBase,
    regionBucket,
    isCardStory,
    isActionSet,
    labels
  }: Props = $props();

  let stageHost: HTMLDivElement | undefined = $state();
  // Raw state: the session wraps pixi/Howler internals that must not be
  // deep-proxied; only reassignment (mount/cleanup) needs to be reactive.
  let session: StoryPlayerSession | null = $state.raw(null);
  let playerState = $state<StoryPlayerSessionState>("loading");
  let loadFailed = $state(false);
  let progress = $state({ count: 0, total: 0, label: "" });
  let warnings = $state<string[]>([]);
  let autoplay = $state(true);
  let textAnimation = $state(true);
  let voiceVolume = $state(0.8);
  let bgmVolume = $state(0.5);
  let seVolume = $state(0.8);

  const voiceCharacterLookup = new Map(
    voiceCharacters.map((entry) => [
      entry.character2dId,
      { assetName: entry.assetName, unit: entry.unit }
    ])
  );

  const stageSizeFor = (element: HTMLElement): [number, number] => {
    const width = element.clientWidth || 960;
    const height = Math.round((width * 9) / 16);
    return [width, height];
  };

  const pushWarning = (reason: string): void => {
    warnings = [...warnings.slice(-9), reason];
  };

  onMount(() => {
    let instance: StoryPlayerSession | null = null;
    let observer: ResizeObserver | null = null;

    const mount = async (): Promise<void> => {
      if (!stageHost) return;
      try {
        // The player engine statically imports the pixi-live2d-display
        // plugin, which requires window.Live2DCubismCore while its module
        // evaluates; load the Cubism Core runtime before anything else.
        const { ensureCubismCore } = await import("$lib/live2d/cubism-core");
        await ensureCubismCore();
        const [{ createStoryPlayerSession }, { createStoryRegionAssetUrls }] =
          await Promise.all([
            import("$lib/story/story-player-session"),
            import("$lib/story/story-urls")
          ]);
        const urls = createStoryRegionAssetUrls(() => assetBase, region as "jp");
        const [width, height] = stageSizeFor(stageHost);
        instance = await createStoryPlayerSession({
          host: stageHost,
          stageSize: [width, height],
          scenarioData,
          isCardStory,
          isActionSet,
          regionBucket,
          regionBase: assetBase,
          regionUrl: urls.region,
          live2dUrl: urls.live2d,
          voiceCharacters: voiceCharacterLookup,
          settings: {
            voiceVolume,
            bgmVolume,
            seVolume,
            autoplay,
            textAnimation
          },
          callbacks: {
            onProgress: (type, count, total, info) => {
              progress = { count, total, label: info ?? type };
            },
            onWarning: pushWarning,
            onStateChange: (state) => {
              playerState = state;
            }
          }
        });
        session = instance;
        observer = new ResizeObserver(() => {
          if (!stageHost || !instance) return;
          const [nextWidth, nextHeight] = stageSizeFor(stageHost);
          instance.resize(nextWidth, nextHeight);
        });
        observer.observe(stageHost);
      } catch (error) {
        console.error("story player failed to mount", error);
        loadFailed = true;
        playerState = "error";
      }
    };
    void mount();

    return () => {
      observer?.disconnect();
      instance?.destroy();
      session = null;
    };
  });

  const onStageClick = (): void => {
    if (!session) return;
    if (playerState === "playing") {
      session.abort();
      return;
    }
    if (playerState === "ready") {
      void session.nextStep();
    }
  };

  const applyVolume = (): void => {
    session?.setVolume({
      voiceVolume,
      bgmVolume,
      seVolume
    });
  };

  const stateLabel = $derived(
    playerState === "playing"
      ? labels.playing
      : playerState === "finished"
        ? labels.finished
        : playerState === "ready"
          ? labels.stateReady
          : labels.loading
  );
  const progressPercent = $derived(
    progress.total > 0
      ? Math.min(100, Math.round((progress.count / progress.total) * 100))
      : 0
  );
  /* Only the pre-start affordance stays on the stage; once playback has
     begun, the state row below the stage carries progress, per product
     decision to keep the video area clean. */
  const stageHint = $derived(playerState === "ready" ? labels.tapToPlay : "");
</script>

<div class="flex flex-col gap-3">
  <div
    class="relative aspect-video w-full overflow-hidden rounded-xl border border-base-content/10 bg-black"
  >
    <div
      bind:this={stageHost}
      class="absolute inset-0"
      role="button"
      aria-label={labels.next}
      onclick={onStageClick}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") onStageClick();
      }}
      tabindex="0"
    ></div>
    {#if playerState === "loading" || loadFailed}
      <div class="absolute inset-0 grid place-items-center bg-black/70 text-base-100">
        {#if loadFailed}
          <p class="flex items-center gap-2 text-sm" role="alert">
            <Icon icon="mdi:alert-circle-outline" class="size-5" aria-hidden="true" />
            {labels.loadFailed}
          </p>
        {:else}
          <div class="flex w-2/3 max-w-xs flex-col items-center gap-3">
            <span class="loading loading-spinner loading-md" aria-hidden="true"></span>
            <span class="text-sm">{labels.loading}</span>
            {#if progress.total > 0}
              <progress
                class="progress progress-primary w-full"
                value={progressPercent}
                max="100"
              ></progress>
            {/if}
          </div>
        {/if}
      </div>
    {:else if stageHint}
      <p
        class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80"
        role="status"
      >
        {stageHint}
      </p>
    {/if}
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="btn btn-primary btn-sm min-h-11! px-4"
      onclick={() => (playerState === "playing" ? session?.abort() : session?.nextStep())}
      disabled={!session || playerState === "finished" || playerState === "loading" || loadFailed}
    >
      <Icon icon="mdi:skip-next" class="size-4" aria-hidden="true" />
      {labels.next}
      <span class="sr-only">({stateLabel})</span>
    </button>
    <span class="text-sm text-base-content/60" role="status">{stateLabel}</span>
  </div>

  <div class="grid gap-4 rounded-xl border border-base-content/10 bg-base-100 p-4 sm:grid-cols-2">
    <label class="flex items-center justify-between gap-3">
      <span class="text-sm text-base-content/70">{labels.autoplay}</span>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={autoplay}
        onchange={() => session?.setAutoplay(autoplay)}
      />
    </label>
    <label class="flex items-center justify-between gap-3">
      <span class="text-sm text-base-content/70">{labels.textAnimation}</span>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={textAnimation}
        onchange={() => session?.setTextAnimation(textAnimation)}
      />
    </label>
    <label class="flex items-center gap-3">
      <span class="w-20 shrink-0 text-sm text-base-content/70">{labels.voiceVolume}</span>
      <input
        type="range"
        class="range range-primary range-sm grow"
        min="0"
        max="1"
        step="0.05"
        bind:value={voiceVolume}
        oninput={applyVolume}
      />
    </label>
    <label class="flex items-center gap-3">
      <span class="w-20 shrink-0 text-sm text-base-content/70">{labels.bgmVolume}</span>
      <input
        type="range"
        class="range range-primary range-sm grow"
        min="0"
        max="1"
        step="0.05"
        bind:value={bgmVolume}
        oninput={applyVolume}
      />
    </label>
    <label class="flex items-center gap-3">
      <span class="w-20 shrink-0 text-sm text-base-content/70">{labels.seVolume}</span>
      <input
        type="range"
        class="range range-primary range-sm grow"
        min="0"
        max="1"
        step="0.05"
        bind:value={seVolume}
        oninput={applyVolume}
      />
    </label>
  </div>

  {#if warnings.length > 0}
    <details class="collapse collapse-arrow rounded-xl border border-base-content/10 bg-base-100">
      <summary class="collapse-title text-sm font-semibold">
        <span class="badge badge-warning badge-sm mr-2">{warnings.length}</span>
        {labels.warnings}
      </summary>
      <div class="collapse-content">
        <ul class="flex list-disc flex-col gap-1 pl-5 text-xs text-base-content/60">
          {#each warnings as warning (warning)}
            <li class="break-all">{warning}</li>
          {/each}
        </ul>
      </div>
    </details>
  {/if}
</div>
