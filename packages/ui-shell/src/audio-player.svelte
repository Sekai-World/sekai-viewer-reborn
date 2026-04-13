<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onMount, untrack } from "svelte";

  type HowlInstance = import("howler").Howl;
  type DownloadOption = {
    label: string;
    href: string;
    progressHref?: string;
    downloadName?: string;
  };
  type DownloadProgressSnapshot = {
    state: "waiting" | "fetching" | "tagging" | "finalizing" | "done" | "error";
    progress: number;
    detail: string;
    updatedAt: number;
  };
  type DownloadProgressMessages = {
    preparing: string;
    fetchingAudio: string;
    fetchingCover: string;
    writingMetadata: string;
    finalizing: string;
    ready: string;
    failed: string;
    cancelled: string;
  };

  let {
    src,
    label,
    title,
    downloadOptions = [],
    downloadProgressMessages,
    subtitle = "",
    downloadName = "audio.mp3",
    playLabel,
    pauseLabel,
    downloadLabel,
    downloadCloseLabel,
    volumeLabel,
    seekLabel,
    unavailableLabel
  }: {
    src: string | null;
    label: string;
    title: string;
    downloadOptions?: DownloadOption[];
    downloadProgressMessages: DownloadProgressMessages;
    subtitle?: string;
    downloadName?: string;
    playLabel: string;
    pauseLabel: string;
    downloadLabel: string;
    downloadCloseLabel: string;
    volumeLabel: string;
    seekLabel: string;
    unavailableLabel: string;
  } = $props();

  let howl: HowlInstance | null = null;
  let metadataAudio: HTMLAudioElement | null = null;
  let currentTime = $state(0);
  let duration = $state(0);
  let volume = $state(0.85);
  let isReady = $state(false);
  let isPlaying = $state(false);
  let isLoading = $state(false);
  let isMetadataLoading = $state(false);
  let isDownloadLoading = $state(false);
  let downloadProgress = $state(0);
  let activeDownloadName = $state("");
  let activeDownloadDetail = $state("");
  let activeDownloadTaskId = $state("");
  let activeDownloadProgressHref = $state("");
  let hasError = $state(false);
  let isSeeking = $state(false);
  let pendingSeekTime = $state<number | null>(null);
  let progressAnimationFrameId = 0;
  let lastProgressSyncAt = 0;
  let setupVersion = 0;
  let metadataVersion = 0;
  let mounted = $state(false);
  let requestedPlayback = false;
  let downloadProgressSource: EventSource | null = null;

  const normalizedSrc = $derived(src?.trim() ?? "");
  const hasSource = $derived(normalizedSrc.length > 0);
  const displayedCurrentTime = $derived(isSeeking && pendingSeekTime !== null ? pendingSeekTime : currentTime);
  const normalizedDownloadOptions = $derived(
    (() => {
      const seenKeys = new Set<string>();
      const items = downloadOptions
        .map((option) => ({
          label: option.label.trim(),
          href: option.href.trim(),
          progressHref: option.progressHref?.trim() || undefined,
          downloadName: option.downloadName?.trim() || undefined
        }))
        .filter((option) => option.label.length > 0 && option.href.length > 0)
        .filter((option) => {
          const key = `${option.label}\u0000${option.href}\u0000${option.progressHref ?? ""}\u0000${option.downloadName ?? ""}`;
          if (seenKeys.has(key)) {
            return false;
          }

          seenKeys.add(key);
          return true;
        });

      if (items.length > 0) {
        return items;
      }

      if (!normalizedSrc) {
        return [];
      }

      return [
        {
          label: "MP3",
          href: normalizedSrc,
          downloadName
        } satisfies DownloadOption
      ];
    })()
  );
  const hasDownloadOptions = $derived(normalizedDownloadOptions.length > 0);

  const closeDownloadMenu = (): void => {
    (document.activeElement as HTMLElement | null)?.blur();
  };

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

  const buildDownloadRequestUrl = (href: string, taskId: string): string => {
    const requestUrl = new URL(href, window.location.href);
    requestUrl.searchParams.set("taskId", taskId);
    return requestUrl.toString();
  };

  const getDownloadProgressMessage = (detail: string): string => {
    if (detail === "preparing") {
      return downloadProgressMessages.preparing;
    }

    if (detail === "fetching-audio") {
      return downloadProgressMessages.fetchingAudio;
    }

    if (detail === "fetching-cover") {
      return downloadProgressMessages.fetchingCover;
    }

    if (detail === "writing-metadata") {
      return downloadProgressMessages.writingMetadata;
    }

    if (detail === "finalizing") {
      return downloadProgressMessages.finalizing;
    }

    if (detail === "ready") {
      return downloadProgressMessages.ready;
    }

    if (detail === "failed") {
      return downloadProgressMessages.failed;
    }

    if (detail === "cancelled") {
      return downloadProgressMessages.cancelled;
    }

    return detail;
  };

  const cancelActiveDownload = (): void => {
    const taskId = activeDownloadTaskId;
    const progressHref = activeDownloadProgressHref;
    if (!taskId || !progressHref) {
      return;
    }

    const cancelUrl = buildDownloadRequestUrl(progressHref, taskId);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(cancelUrl);
      return;
    }

    void fetch(cancelUrl, {
      method: "POST",
      keepalive: true
    });
  };

  const startDownloadProgress = (option: DownloadOption, taskId: string): void => {
    downloadProgressSource?.close();
    downloadProgressSource = null;
    downloadProgress = 0;
    activeDownloadName = option.downloadName ?? "audio.bin";
    activeDownloadDetail = "";
    activeDownloadTaskId = taskId;
    activeDownloadProgressHref = option.progressHref ?? "";

    if (!option.progressHref) {
      return;
    }

    const progressUrl = buildDownloadRequestUrl(option.progressHref, taskId);
    const source = new EventSource(progressUrl);
    downloadProgressSource = source;

    source.onmessage = (event) => {
      try {
        const snapshot = JSON.parse(event.data) as DownloadProgressSnapshot;
        downloadProgress = Math.max(0, Math.min(100, snapshot.progress));
        activeDownloadDetail = getDownloadProgressMessage(snapshot.detail);

        if (snapshot.state === "done" || snapshot.state === "error") {
          source.close();
          if (downloadProgressSource === source) {
            downloadProgressSource = null;
          }
        }
      } catch (progressError) {
        console.error("Failed to parse download progress event.", progressError);
      }
    };

    source.onerror = () => {
      source.close();
      if (downloadProgressSource === source) {
        downloadProgressSource = null;
      }
    };
  };

  const handleDownload = async (option: DownloadOption): Promise<void> => {
    if (isDownloadLoading) {
      return;
    }

    const taskId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    closeDownloadMenu();
    isDownloadLoading = true;
    downloadProgress = 0;
    activeDownloadName = option.downloadName ?? "audio.bin";
    startDownloadProgress(option, taskId);
    let downloadCompleted = false;

    try {
      const response = await fetch(buildDownloadRequestUrl(option.href, taskId));
      if (!response.ok) {
        throw new Error(`Failed to download ${option.href}: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = option.downloadName ?? "audio.bin";
      anchor.rel = "noopener";
      anchor.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 0);
      downloadCompleted = true;
    } catch (downloadError) {
      console.error("Failed to download audio.", downloadError);
    } finally {
      downloadProgress = downloadCompleted ? 100 : 0;
      downloadProgressSource?.close();
      downloadProgressSource = null;
      activeDownloadTaskId = "";
      activeDownloadProgressHref = "";
      if (!downloadCompleted) {
        activeDownloadName = "";
        activeDownloadDetail = "";
      }
      isDownloadLoading = false;
    }
  };

  const closeDownloadDialog = (): void => {
    if (isDownloadLoading) {
      cancelActiveDownload();
      downloadProgressSource?.close();
      downloadProgressSource = null;
      downloadProgress = 0;
      activeDownloadTaskId = "";
      activeDownloadProgressHref = "";
      activeDownloadName = "";
      activeDownloadDetail = "";
      isDownloadLoading = false;
    }
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

  const teardownMetadataPreload = (): void => {
    metadataAudio?.pause();
    metadataAudio?.removeAttribute("src");
    metadataAudio?.load();
    metadataAudio = null;
    isMetadataLoading = false;
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

  const preloadMetadata = (source: string, version: number): void => {
    if (typeof Audio === "undefined") {
      return;
    }

    const audio = new Audio();
    metadataAudio = audio;
    isMetadataLoading = true;
    audio.preload = "metadata";

    const finalize = (): void => {
      if (metadataAudio !== audio) {
        return;
      }

      metadataAudio = null;
      isMetadataLoading = false;
    };

    const handleLoadedMetadata = (): void => {
      if (version !== metadataVersion) {
        return;
      }

      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (Math.abs(nextDuration - duration) >= 0.05) {
        duration = nextDuration;
      }

      finalize();
    };

    const handleError = (): void => {
      if (version !== metadataVersion) {
        return;
      }

      finalize();
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.src = source;
    audio.load();
  };

  $effect(() => {
    if (!mounted) {
      return;
    }

    const source = normalizedSrc;
    setupVersion += 1;
    metadataVersion += 1;

    untrack(() => {
      teardownPlayer();
      teardownMetadataPreload();
    });

    if (source) {
      const version = metadataVersion;
      untrack(() => {
        preloadMetadata(source, version);
      });
    }

    return () => {
      setupVersion += 1;
      metadataVersion += 1;
      untrack(() => {
        teardownPlayer();
        teardownMetadataPreload();
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
    const handlePageHide = (): void => {
      if (isDownloadLoading) {
        cancelActiveDownload();
      }
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      if (isDownloadLoading) {
        cancelActiveDownload();
      }
      window.removeEventListener("pagehide", handlePageHide);
      teardownPlayer();
      teardownMetadataPreload();
      downloadProgressSource?.close();
      downloadProgressSource = null;
      mounted = false;
      setupVersion += 1;
      metadataVersion += 1;
    };
  });
</script>

<article class="card content-card-shell overflow-hidden shadow-sm">
  <div class="card-body gap-4 p-5">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">{label}</p>
    </div>

    <div class="content-card-inset flex min-h-36 flex-1 rounded-[1.75rem] p-4">
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

          <div class="dropdown dropdown-end shrink-0">
            <button
              type="button"
              tabindex="0"
              class={`btn btn-outline btn-square btn-sm ${!hasDownloadOptions ? "pointer-events-none opacity-50" : ""}`}
              aria-label={downloadLabel}
              title={downloadLabel}
              disabled={!hasDownloadOptions || isDownloadLoading}
            >
              {#if isDownloadLoading}
                <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
              {:else}
                <Icon icon="mdi:download" class="h-4 w-4" />
              {/if}
            </button>
            <ul
              class="dropdown-content menu z-10 mt-2 w-32 rounded-box border border-base-content/10 bg-base-100 p-2 shadow-lg"
            >
              {#each normalizedDownloadOptions as option}
                <li>
                  <button
                    type="button"
                    class="font-mono uppercase"
                    disabled={isDownloadLoading}
                    onclick={() => {
                      void handleDownload(option);
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              {/each}
            </ul>
          </div>
          </div>

          <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            <div class="min-w-0 flex-1">
              <div class="mb-2 flex items-center justify-between gap-3 text-xs font-medium opacity-70">
                <span class="font-mono tabular-nums">{formatTime(displayedCurrentTime)}</span>
                <span class="flex items-center gap-2 font-mono tabular-nums">
                  {#if isMetadataLoading && duration <= 0}
                    <span class="loading loading-spinner loading-xs opacity-60" aria-hidden="true"></span>
                  {/if}
                  <span>{formatTime(duration)}</span>
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 0}
                step="0.1"
                value={displayedCurrentTime}
                class="audio-player-range range range-primary range-sm w-full"
                disabled={!isReady}
                aria-label={seekLabel}
                title={seekLabel}
                oninput={handleSeekInput}
                onchange={commitSeek}
                onblur={cancelSeekPreview}
              />
            </div>

            <div class="w-full md:w-auto md:shrink-0">
              <div class="flex w-full items-center gap-2 rounded-full border border-base-content/10 bg-base-100/70 px-3 py-2 shadow-sm md:w-auto">
                <Icon icon="mdi:volume-high" class="h-4 w-4 shrink-0 opacity-75" aria-hidden="true" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  class="audio-player-range range range-primary range-sm min-w-0 flex-1 md:w-24 md:flex-none"
                  aria-label={volumeLabel}
                  title={volumeLabel}
                  oninput={handleVolumeChange}
                />
                <span class="w-9 text-right text-[0.7rem] font-medium tabular-nums opacity-70">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</article>

{#if isDownloadLoading}
  <div class="pointer-events-none fixed inset-x-3 bottom-3 z-50 md:inset-x-auto md:right-4 md:bottom-4 md:w-[22rem]">
    <div class="pointer-events-auto rounded-[1.5rem] border border-base-content/10 bg-base-100/94 px-4 py-4 shadow-2xl backdrop-blur">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">{downloadLabel}</p>
          <p class="mt-1 truncate text-sm font-semibold">{activeDownloadName}</p>
          {#if activeDownloadDetail}
            <p class="mt-1 text-xs opacity-65">{activeDownloadDetail}</p>
          {/if}
        </div>
        <div class="flex items-start gap-2">
          <span class="pt-0.5 text-sm font-semibold tabular-nums">{Math.round(downloadProgress)}%</span>
          <button
            type="button"
            class="btn btn-ghost btn-square btn-xs"
            aria-label={downloadCloseLabel}
            title={downloadCloseLabel}
            onclick={closeDownloadDialog}
          >
            <Icon icon="mdi:close" class="h-4 w-4" />
          </button>
        </div>
      </div>
      <progress class="progress progress-primary h-2 w-full" max="100" value={downloadProgress}></progress>
    </div>
  </div>
{/if}

<style>
  :global(.audio-player-range) {
    --range-bg: color-mix(in oklab, var(--color-base-content) 14%, transparent);
  }

  :global(:root[data-theme="dark"]) .audio-player-range:disabled {
    opacity: 1;
  }
</style>
