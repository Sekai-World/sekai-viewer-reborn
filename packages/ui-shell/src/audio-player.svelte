<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onMount, untrack } from "svelte";

  type HowlInstance = import("howler").Howl;

  let {
    src,
    label,
    title,
    subtitle = "",
    badge = "",
    downloadName = "audio.mp3",
    playLabel,
    pauseLabel,
    downloadLabel,
    volumeLabel,
    seekLabel,
    unavailableLabel
  }: {
    src: string | null;
    label: string;
    title: string;
    subtitle?: string;
    badge?: string;
    downloadName?: string;
    playLabel: string;
    pauseLabel: string;
    downloadLabel: string;
    volumeLabel: string;
    seekLabel: string;
    unavailableLabel: string;
  } = $props();

  let howl: HowlInstance | null = null;
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(0.85);
  let isReady = $state(false);
  let isPlaying = $state(false);
  let isLoading = $state(false);
  let hasError = $state(false);
  let isSeeking = $state(false);
  let pendingSeekTime = $state<number | null>(null);
  let progressAnimationFrameId = 0;
  let lastProgressSyncAt = 0;
  let setupVersion = 0;
  let mounted = $state(false);
  let requestedPlayback = false;

  const normalizedSrc = $derived(src?.trim() ?? "");
  const hasSource = $derived(normalizedSrc.length > 0);
  const displayedCurrentTime = $derived(isSeeking && pendingSeekTime !== null ? pendingSeekTime : currentTime);

  const formatTime = (secondsValue: number): string => {
    const safeSeconds = Math.max(0, Math.floor(secondsValue));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const syncPlaybackState = (): void => {
    if (!howl) {
      currentTime = 0;
      duration = 0;
      isPlaying = false;
      return;
    }

    const nextCurrentTime = (() => {
      const seekValue = howl.seek();
      return typeof seekValue === "number" ? seekValue : 0;
    })();
    const nextDuration = Number.isFinite(howl.duration()) ? howl.duration() : 0;
    const nextIsPlaying = howl.playing();

    if (Math.abs(nextCurrentTime - currentTime) >= 0.05) {
      currentTime = nextCurrentTime;
    }

    if (Math.abs(nextDuration - duration) >= 0.05) {
      duration = nextDuration;
    }

    if (nextIsPlaying !== isPlaying) {
      isPlaying = nextIsPlaying;
    }
  };

  const resetSeekPreview = (): void => {
    isSeeking = false;
    pendingSeekTime = null;
  };

  const stopProgressLoop = (): void => {
    if (progressAnimationFrameId) {
      window.cancelAnimationFrame(progressAnimationFrameId);
      progressAnimationFrameId = 0;
    }
    lastProgressSyncAt = 0;
  };

  const startProgressLoop = (): void => {
    if (!mounted || progressAnimationFrameId) {
      return;
    }

    const tick = (timestamp: number): void => {
      if (!mounted || !howl?.playing()) {
        progressAnimationFrameId = 0;
        lastProgressSyncAt = 0;
        return;
      }

      if (lastProgressSyncAt === 0 || timestamp - lastProgressSyncAt >= 125) {
        lastProgressSyncAt = timestamp;
        syncPlaybackState();
      }

      progressAnimationFrameId = window.requestAnimationFrame(tick);
    };

    progressAnimationFrameId = window.requestAnimationFrame((timestamp) => {
      lastProgressSyncAt = timestamp;
      syncPlaybackState();
      progressAnimationFrameId = window.requestAnimationFrame(tick);
    });
  };

  const teardownPlayer = (): void => {
    stopProgressLoop();
    howl?.unload();
    howl = null;
    currentTime = 0;
    duration = 0;
    isReady = false;
    isPlaying = false;
    isLoading = false;
    hasError = false;
    requestedPlayback = false;
    resetSeekPreview();
  };

  const initializePlayer = async (source: string, version: number): Promise<void> => {
    try {
      const { Howl } = await import("howler");
      if (version !== setupVersion) {
        return;
      }

      const instance = new Howl({
        src: [source],
        html5: true,
        preload: true,
        volume,
        format: ["mp3"],
        onload: () => {
          if (version !== setupVersion) {
            return;
          }

          isReady = true;
          isLoading = false;
          hasError = false;
          syncPlaybackState();

          if (requestedPlayback) {
            requestedPlayback = false;
            instance.play();
          }
        },
        onloaderror: () => {
          if (version !== setupVersion) {
            return;
          }

          isReady = false;
          isLoading = false;
          hasError = true;
        },
        onplay: () => {
          syncPlaybackState();
          startProgressLoop();
        },
        onpause: () => {
          syncPlaybackState();
          stopProgressLoop();
        },
        onstop: () => {
          syncPlaybackState();
          stopProgressLoop();
        },
        onend: () => {
          syncPlaybackState();
          stopProgressLoop();
        },
        onseek: () => {
          syncPlaybackState();
        }
      });

      howl = instance;
    } catch {
      if (version !== setupVersion) {
        return;
      }

      isReady = false;
      isLoading = false;
      hasError = true;
    }
  };

  $effect(() => {
    if (!mounted) {
      return;
    }

    normalizedSrc;
    setupVersion += 1;

    untrack(() => {
      teardownPlayer();
    });

    return () => {
      setupVersion += 1;
      untrack(() => {
        teardownPlayer();
      });
    };
  });

  const requestPlayerLoad = (): void => {
    const source = normalizedSrc;
    if (!source || howl || isLoading || hasError) {
      return;
    }

    setupVersion += 1;
    const version = setupVersion;
    isLoading = true;

    untrack(() => {
      void initializePlayer(source, version);
    });
  };

  const togglePlayback = (): void => {
    if (hasError) {
      return;
    }

    if (!howl) {
      requestedPlayback = true;
      requestPlayerLoad();
      return;
    }

    if (!isReady) {
      requestedPlayback = true;
      return;
    }

    if (howl.playing()) {
      requestedPlayback = false;
      howl.pause();
      return;
    }

    requestedPlayback = false;
    howl.play();
  };

  const handleSeekInput = (event: Event): void => {
    if (!isReady || hasError) {
      return;
    }

    const nextTime = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(nextTime)) {
      return;
    }

    isSeeking = true;
    pendingSeekTime = nextTime;
  };

  const commitSeek = (event: Event): void => {
    if (!howl || !isReady || hasError) {
      resetSeekPreview();
      return;
    }

    const nextTime = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(nextTime)) {
      resetSeekPreview();
      return;
    }

    howl.seek(nextTime);
    currentTime = nextTime;
    resetSeekPreview();
  };

  const cancelSeekPreview = (): void => {
    if (!isSeeking) {
      return;
    }

    resetSeekPreview();
  };

  const handleVolumeChange = (event: Event): void => {
    const nextVolume = Number((event.currentTarget as HTMLInputElement).value);
    volume = nextVolume;
    howl?.volume(nextVolume);
  };

  onMount(() => {
    mounted = true;

    return () => {
      teardownPlayer();
      mounted = false;
      setupVersion += 1;
    };
  });
</script>

<article class="card content-card-shell overflow-hidden shadow-sm">
  <div class="card-body gap-5 p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">{label}</p>
        <h2 class="mt-2 text-xl font-semibold leading-tight">{title}</h2>
        {#if subtitle}
          <p class="mt-1 text-sm opacity-70">{subtitle}</p>
        {/if}
      </div>
      {#if badge}
        <span class="badge badge-primary badge-lg border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
          {badge}
        </span>
      {/if}
    </div>

    <div class="content-card-inset flex min-h-44 flex-1 rounded-[1.75rem] p-5">
      {#if !hasSource || hasError}
        <div class="flex min-h-full w-full flex-1 flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-base-content/15 px-6 text-center">
          <Icon icon="mdi:music-off" class="h-10 w-10 opacity-55" aria-hidden="true" />
          <p class="text-sm font-medium opacity-75">{unavailableLabel}</p>
        </div>
      {:else}
        <div class="w-full">
          <div class="flex items-center gap-4">
          <button
            type="button"
            class="btn btn-primary btn-circle btn-lg shrink-0"
            onclick={togglePlayback}
            disabled={!hasSource || hasError || isLoading}
            aria-label={isPlaying ? pauseLabel : playLabel}
            title={isPlaying ? pauseLabel : playLabel}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
            {:else}
              <Icon icon={isPlaying ? "mdi:pause" : "mdi:play"} class="h-6 w-6" />
            {/if}
          </button>

          <div class="min-w-0 flex-1">
            <p class="truncate text-base font-semibold">{title}</p>
            {#if subtitle}
              <p class="mt-1 truncate text-sm opacity-70">{subtitle}</p>
            {/if}
          </div>

          <a
            href={normalizedSrc}
            download={downloadName}
            class={`btn btn-outline btn-sm shrink-0 ${!hasSource ? "pointer-events-none opacity-50" : ""}`}
            aria-label={downloadLabel}
            title={downloadLabel}
          >
            <Icon icon="mdi:download" class="h-4 w-4" />
            <span class="hidden sm:inline">{downloadLabel}</span>
          </a>
          </div>

          <div class="mt-5">
            <div class="mb-2 flex items-center justify-between gap-3 text-xs font-medium opacity-70">
              <span class="font-mono tabular-nums">{formatTime(displayedCurrentTime)}</span>
              <span class="font-mono tabular-nums">{formatTime(duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration > 0 ? duration : 0}
              step="0.1"
              value={displayedCurrentTime}
              class="range range-primary range-sm w-full"
              disabled={!isReady}
              aria-label={seekLabel}
              title={seekLabel}
              oninput={handleSeekInput}
              onchange={commitSeek}
              onblur={cancelSeekPreview}
            />
          </div>

          <div class="mt-4 flex items-center gap-3">
            <Icon icon="mdi:volume-high" class="h-5 w-5 shrink-0 opacity-75" aria-hidden="true" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              class="range range-xs flex-1"
              aria-label={volumeLabel}
              title={volumeLabel}
              oninput={handleVolumeChange}
            />
            <span class="w-10 text-right text-xs font-medium tabular-nums opacity-70">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</article>
