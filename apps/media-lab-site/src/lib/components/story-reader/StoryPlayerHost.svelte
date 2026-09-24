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
      tapToLoad: string;
      tapToPlay: string;
      tapToContinue: string;
      rotateToPlay: string;
      previous: string;
      next: string;
      autoplay: string;
      fullscreen: string;
      textAnimation: string;
      voiceVolume: string;
      bgmVolume: string;
      seVolume: string;
      loading: string;
      loadFailed: string;
      retry: string;
      warnings: string;
      phaseAssets: string;
      phaseModels: string;
      phaseModelFiles: string;
      phaseMotions: string;
      phaseStage: string;
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
  let stageContainer: HTMLDivElement | undefined = $state();
  // Raw state: the session wraps pixi/Howler internals that must not be
  // deep-proxied; only reassignment (mount/cleanup) needs to be reactive.
  let session: StoryPlayerSession | null = $state.raw(null);
  let playerState = $state<StoryPlayerSessionState>("loading");
  let loadFailed = $state(false);
  // Loading is opt-in: the stage shows "Click to load" until the user asks
  // for it, so a story only downloads its assets when actually opened.
  let loadStarted = $state(false);
  let startLoading: () => void = () => {};
  let isFullscreen = $state(false);
  // True only on touch devices held upright (pointer: coarse keeps desktop
  // narrow windows unaffected); playback is landscape-only there.
  let isPortraitCoarse = $state(false);
  /* Per-phase load progress (media / model data / model files / motions),
     keyed by Live2DLoadProgressType. Phases start at different times, so an
     aggregate count/total would jump backwards whenever a new phase's total
     joins the denominator; each phase gets its own monotonically filling
     bar instead. */
  let loadBuckets = $state<Record<string, { count: number; total: number }>>({});
  let currentLoadItem = $state("");
  let warnings = $state<string[]>([]);
  let autoplay = $state(false);
  let textAnimation = $state(true);
  let voiceVolume = $state(0.8);
  let bgmVolume = $state(0.5);
  let seVolume = $state(0.8);
  // SimpleSelectable overlay: the parked effect's choice labels; the picked
  // one highlights briefly before playback resumes. The choice is purely
  // cosmetic — the scenario carries no branch data behind it.
  let selectableChoices = $state<string[] | null>(null);
  let chosenChoice = $state<number | null>(null);
  let selectableTimer: ReturnType<typeof setTimeout> | null = null;

  // Derived so a layout-triggered reload (locale or region switch) that
  // refreshes `voiceCharacters` is seen by a session created afterwards.
  const voiceCharacterLookup = $derived(
    new Map(
      voiceCharacters.map((entry) => [
        entry.character2dId,
        { assetName: entry.assetName, unit: entry.unit }
      ])
    )
  );

  const stageSizeFor = (element: HTMLElement): [number, number] => {
    const width = element.clientWidth || 960;
    const height = Math.round((width * 9) / 16);
    return [width, height];
  };

  const pushWarning = (reason: string): void => {
    warnings = [...warnings.slice(-9), reason];
  };

  const dismissSelectable = (): void => {
    if (selectableTimer !== null) {
      clearTimeout(selectableTimer);
      selectableTimer = null;
    }
    selectableChoices = null;
    chosenChoice = null;
  };

  const chooseSelectable = (index: number): void => {
    if (!selectableChoices || chosenChoice !== null) return;
    chosenChoice = index;
    selectableTimer = setTimeout(() => {
      selectableTimer = null;
      dismissSelectable();
      void session?.nextStep();
    }, 600);
  };

  /* Fullscreen playback on the stage container; locking the orientation to
     landscape is best-effort — Android honours it inside fullscreen, iOS
     Safari exposes neither API and just ignores it. */
  const lockLandscape = async (): Promise<void> => {
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      await orientation.lock?.("landscape");
    } catch {
      // Unsupported or denied; fullscreen alone is still fine.
    }
  };

  const unlockOrientation = (): void => {
    try {
      (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
    } catch {
      // Nothing to unlock.
    }
  };

  const enterStageFullscreen = async (): Promise<void> => {
    const element = stageContainer as
      (HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }) | undefined;
    if (!element) return;
    try {
      if (element.requestFullscreen) await element.requestFullscreen();
      else await element.webkitRequestFullscreen?.();
      await lockLandscape();
    } catch {
      // Fullscreen denied; stay in the normal layout.
    }
  };

  const toggleFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement) {
      unlockOrientation();
      try {
        await document.exitFullscreen();
      } catch {
        // Already gone.
      }
      return;
    }
    await enterStageFullscreen();
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
        const [{ createStoryPlayerSession }, { createStoryRegionAssetUrls }] = await Promise.all([
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
              currentLoadItem = info ?? "";
              loadBuckets = { ...loadBuckets, [type]: { count, total } };
            },
            onWarning: pushWarning,
            onStateChange: (state) => {
              playerState = state;
            },
            onSelectable: (choices) => {
              selectableChoices = choices;
              chosenChoice = null;
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
    startLoading = (): void => {
      if (loadStarted) return;
      loadStarted = true;
      void mount();
    };

    const portraitQuery = window.matchMedia("(orientation: portrait) and (pointer: coarse)");
    const syncPortrait = (): void => {
      isPortraitCoarse = portraitQuery.matches;
    };
    const syncFullscreen = (): void => {
      isFullscreen = document.fullscreenElement === stageContainer;
    };
    syncPortrait();
    portraitQuery.addEventListener("change", syncPortrait);
    document.addEventListener("fullscreenchange", syncFullscreen);

    return () => {
      portraitQuery.removeEventListener("change", syncPortrait);
      document.removeEventListener("fullscreenchange", syncFullscreen);
      if (selectableTimer !== null) {
        clearTimeout(selectableTimer);
        selectableTimer = null;
      }
      observer?.disconnect();
      instance?.destroy();
      session = null;
    };
  });

  const onStageClick = (): void => {
    if (!loadStarted) {
      startLoading();
      return;
    }
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

  const phaseOrder = ["media", "model-data", "model-assets", "model-motion", "render-model"];
  const phaseName = (type: string): string =>
    type === "media"
      ? labels.phaseAssets
      : type === "model-data"
        ? labels.phaseModels
        : type === "model-assets"
          ? labels.phaseModelFiles
          : type === "model-motion"
            ? labels.phaseMotions
            : type === "render-model"
              ? labels.phaseStage
              : type;
  const loadPhases = $derived.by(() => {
    return Object.entries(loadBuckets)
      .filter(([, bucket]) => bucket.total > 0)
      .sort((a, b) => {
        const indexA = phaseOrder.indexOf(a[0]);
        const indexB = phaseOrder.indexOf(b[0]);
        return (
          (indexA < 0 ? phaseOrder.length : indexA) - (indexB < 0 ? phaseOrder.length : indexB)
        );
      })
      .map(([type, bucket]) => ({
        type,
        name: phaseName(type),
        count: bucket.count,
        total: bucket.total
      }));
  });
  /* The start affordance sits centered on the still-black stage until the
     user advances for the first time, then never comes back. Playback state
     is not written out anywhere below the stage, matching the game. */
  let hasStarted = $state(false);
  const showStartHint = $derived(playerState === "ready" && !hasStarted);

  $effect(() => {
    if (playerState === "playing") hasStarted = true;
  });

  /* Landscape-only playback on touch devices. Entering the portrait gate
     also stops any running playback so nothing advances while hidden. */
  const portraitGate = $derived(isPortraitCoarse && !isFullscreen);

  $effect(() => {
    if (!portraitGate) return;
    if (autoplay) {
      autoplay = false;
      session?.setAutoplay(false);
    }
    if (playerState === "playing") session?.abort();
  });
</script>

<div class="flex flex-col gap-3">
  <div
    bind:this={stageContainer}
    class="relative aspect-video w-full overflow-hidden rounded-xl border border-base-content/10 bg-black"
  >
    <div
      bind:this={stageHost}
      class="absolute inset-0"
      role="button"
      aria-label={!loadStarted ? labels.tapToLoad : labels.next}
      onclick={onStageClick}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") onStageClick();
      }}
      tabindex="0"
    ></div>
    {#if playerState !== "loading" && !loadFailed}
      <div class="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <button
          type="button"
          class="btn btn-circle size-11! min-h-11! border-0 bg-black/45 text-white shadow-none hover:bg-black/70 disabled:bg-black/45 disabled:text-white/40"
          aria-label={labels.previous}
          title={labels.previous}
          onclick={() => {
            dismissSelectable();
            void session?.prevStep();
          }}
          disabled={!session || !session.canGoBack || loadFailed}
        >
          <Icon icon="mdi:skip-previous" class="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`btn btn-circle size-11! min-h-11! border-0 text-xs font-bold tracking-wide shadow-none disabled:bg-black/45 disabled:text-white/40 ${
            autoplay ? "btn-success" : "bg-black/45 text-white hover:bg-black/70"
          }`}
          aria-pressed={autoplay}
          aria-label={labels.autoplay}
          title={labels.autoplay}
          onclick={() => {
            autoplay = !autoplay;
            session?.setAutoplay(autoplay);
          }}
          disabled={!session || loadFailed}
        >
          AUTO
        </button>
        <button
          type="button"
          class="btn btn-circle size-11! min-h-11! border-0 bg-black/45 text-white shadow-none hover:bg-black/70 disabled:bg-black/45 disabled:text-white/40"
          aria-label={labels.next}
          title={labels.next}
          onclick={() => {
            dismissSelectable();
            if (playerState === "playing") session?.abort();
            else void session?.nextStep();
          }}
          disabled={!session || playerState === "finished" || loadFailed}
        >
          <Icon icon="mdi:skip-next" class="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn btn-circle size-11! min-h-11! border-0 bg-black/45 text-white shadow-none hover:bg-black/70"
          aria-label={labels.fullscreen}
          title={labels.fullscreen}
          aria-pressed={isFullscreen}
          onclick={() => void toggleFullscreen()}
        >
          <Icon
            icon={isFullscreen ? "mdi:fullscreen-exit" : "mdi:fullscreen"}
            class="size-5"
            aria-hidden="true"
          />
        </button>
      </div>
    {/if}
    <!-- Choices surface only once the parked step fully settled (voices
         included): picking while the engine is still busy would get the
         follow-up nextStep dropped by its busy guard. -->
    {#if selectableChoices && playerState === "ready"}
      <div class="absolute inset-0 z-5 grid place-items-center bg-black/45 px-4">
        <div class="flex max-w-full flex-col items-center gap-2">
          {#each selectableChoices as choice, index (choice)}
            <button
              type="button"
              class={`btn min-h-11 max-w-xs truncate rounded-full border-0 shadow-none ${
                chosenChoice === index ? "btn-primary" : "bg-black/60 text-white hover:bg-black/80"
              }`}
              onclick={() => chooseSelectable(index)}
            >
              {choice}
            </button>
          {/each}
        </div>
      </div>
    {/if}
    {#if loadFailed}
      <div class="absolute inset-0 grid place-items-center bg-black/70 text-base-100">
        <div class="flex flex-col items-center gap-3 px-6 text-center">
          <p class="flex items-center gap-2 text-sm" role="alert">
            <Icon icon="mdi:alert-circle-outline" class="size-5" aria-hidden="true" />
            {labels.loadFailed}
          </p>
          <button
            type="button"
            class="btn btn-outline min-h-11 border-white/40 text-white hover:border-white hover:bg-white/10 hover:text-white"
            onclick={() => startLoading()}
          >
            <Icon icon="mdi:reload" class="size-4" aria-hidden="true" />
            {labels.retry}
          </button>
        </div>
      </div>
    {:else if portraitGate}
      <div class="absolute inset-0 z-20 grid place-items-center bg-black/80 text-base-100">
        <div class="flex flex-col items-center gap-4 px-6 text-center">
          <Icon
            icon="mdi:phone-rotate-landscape"
            class="size-14 text-white/90"
            aria-hidden="true"
          />
          <p class="text-sm text-white/90">{labels.rotateToPlay}</p>
          <button
            type="button"
            class="btn btn-circle size-12! min-h-12! border-0 bg-white/15 text-white shadow-none hover:bg-white/25"
            aria-label={labels.fullscreen}
            title={labels.fullscreen}
            onclick={() => {
              void enterStageFullscreen();
              startLoading();
            }}
          >
            <Icon icon="mdi:fullscreen" class="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    {:else if !loadStarted}
      <div class="pointer-events-none absolute inset-0 grid place-items-center">
        <div class="flex flex-col items-center gap-3 text-white/90">
          <Icon icon="mdi:download-circle-outline" class="size-16" aria-hidden="true" />
          <span class="text-sm">{labels.tapToLoad}</span>
        </div>
      </div>
    {:else if playerState === "loading"}
      <div
        class="absolute inset-0 grid place-items-center bg-black/70 text-base-100"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="flex w-2/3 max-w-xs flex-col items-center gap-3">
          <span class="loading loading-spinner loading-md" aria-hidden="true"></span>
          <span class="text-sm">{labels.loading}</span>
          {#if loadPhases.length > 0}
            <div class="flex w-full flex-col gap-1.5">
              {#each loadPhases as phase (phase.type)}
                <div class="flex items-center gap-2 text-xs text-base-100/80">
                  <span class="w-20 shrink-0 truncate text-right">{phase.name}</span>
                  <progress
                    class="progress progress-primary h-2 grow"
                    value={phase.count}
                    max={phase.total}
                  ></progress>
                  <span class="w-14 shrink-0 tabular-nums">{phase.count}/{phase.total}</span>
                </div>
              {/each}
            </div>
            <p class="w-full truncate text-center text-xs text-base-100/70">
              {currentLoadItem}
            </p>
          {/if}
        </div>
      </div>
    {:else if showStartHint}
      <div class="pointer-events-none absolute inset-0 grid place-items-center">
        <div class="flex flex-col items-center gap-3 text-white/90">
          <Icon icon="mdi:play-circle-outline" class="size-16" aria-hidden="true" />
          <span class="text-sm">{labels.tapToPlay}</span>
        </div>
      </div>
    {/if}
    {#if playerState !== "loading" && !loadFailed && !portraitGate}
      {#if autoplay}
        <span
          class="badge badge-success pointer-events-none absolute right-3 bottom-3 font-bold tracking-wide"
          aria-hidden="true"
        >
          AUTO
        </span>
      {:else if playerState === "ready" && !selectableChoices}
        <span
          class="pointer-events-none absolute right-3 bottom-3 rounded-field bg-black/45 px-2 py-0.5 text-xs text-white/80"
          aria-hidden="true"
        >
          {labels.tapToContinue}
        </span>
      {/if}
    {/if}
  </div>

  <div class="grid gap-4 rounded-xl border border-base-content/10 bg-base-100 p-4 sm:grid-cols-2">
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
