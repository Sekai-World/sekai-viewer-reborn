<script lang="ts">
  import { untrack } from "svelte";
  import { getMusicLongPreviewAssetURL, type AssetServer } from "#lib/assets/index.js";
  import { resolveMusicVideoAssetURL } from "#lib/assets/music-video.js";
  import type { MusicVideoDescriptor, MusicVocal } from "#lib/domain/music-detail.js";

  type LoadState = "loading" | "ready" | "error";

  let {
    descriptors,
    selectedDescriptor,
    selectedDescriptorIndex,
    onDescriptorChange,
    selectedVocal,
    audioServer = "jp",
    embedded = false,
    showVariantControl = true,
    pauseToken = 0,
    onPlayback,
    poster,
    title,
    videoLabel,
    variantLabel,
    originalLabel,
    mv2dLabel,
    duplicateLabel,
    loadingLabel,
    retryLabel,
    noVideoLabel,
    unsupportedLabel,
    audioUnavailableLabel
  }: {
    descriptors: MusicVideoDescriptor[];
    selectedDescriptor: MusicVideoDescriptor | null;
    selectedDescriptorIndex: number;
    onDescriptorChange: (index: number) => void;
    selectedVocal: MusicVocal | null;
    audioServer?: AssetServer;
    embedded?: boolean;
    showVariantControl?: boolean;
    pauseToken?: number;
    onPlayback?: () => void;
    poster?: string;
    title: string;
    videoLabel: string;
    variantLabel: string;
    originalLabel: string;
    mv2dLabel: string;
    duplicateLabel: string;
    loadingLabel: string;
    retryLabel: string;
    noVideoLabel: string;
    unsupportedLabel: string;
    audioUnavailableLabel: string;
  } = $props();

  let retryNonce = $state(0);
  let videoSource = $state<string | null>(null);
  let loadState = $state<LoadState>("loading");
  let mediaError = $state(false);
  let audioError = $state(false);
  let videoElement = $state<HTMLVideoElement | null>(null);
  let audioElement = $state<HTMLAudioElement | null>(null);
  let requestVersion = 0;
  let playbackVersion = 0;
  let wantsPlayback = false;
  let videoWaiting = false;
  let audioWaiting = false;
  let bufferingPause = false;
  let pendingAudioPlay = false;

  const descriptorOptions = $derived(
    descriptors.map((descriptor, index) => {
      const categoryLabel = descriptor.category === "original" ? originalLabel : mv2dLabel;
      const duplicateNumber = descriptors
        .slice(0, index)
        .filter((item) => item.category === descriptor.category).length;
      return {
        value: String(index),
        label:
          duplicateNumber > 0
            ? `${categoryLabel} ${duplicateLabel} ${duplicateNumber + 1}`
            : categoryLabel
      };
    })
  );

  const audioSource = $derived(
    selectedVocal?.assetBundleName
      ? getMusicLongPreviewAssetURL(selectedVocal.assetBundleName, audioServer)
      : null
  );

  const listingKey = $derived(JSON.stringify([selectedDescriptor, audioServer, retryNonce]));

  $effect(() => {
    void listingKey;
    const { descriptor, currentRetry, server } = untrack(() => ({
      descriptor: selectedDescriptor,
      currentRetry: retryNonce,
      server: audioServer
    }));
    if (!descriptor) {
      videoSource = null;
      loadState = "error";
      return;
    }

    const controller = new AbortController();
    const version = ++requestVersion;
    videoSource = null;
    mediaError = false;
    loadState = "loading";

    void untrack(() => resolveMusicVideoAssetURL(descriptor, { signal: controller.signal, server }))
      .then((source) => {
        if (
          version !== requestVersion ||
          controller.signal.aborted ||
          currentRetry !== retryNonce
        ) {
          return;
        }
        videoSource = source;
        loadState = "ready";
      })
      .catch(() => {
        if (
          version !== requestVersion ||
          controller.signal.aborted ||
          currentRetry !== retryNonce
        ) {
          return;
        }
        videoSource = null;
        loadState = "error";
      });

    return () => {
      requestVersion += 1;
      controller.abort();
    };
  });

  const syncAudioTime = (threshold = 0.05): void => {
    if (!videoElement || !audioElement || !Number.isFinite(videoElement.currentTime)) {
      return;
    }

    const nextTime = Math.max(0, videoElement.currentTime);
    if (Math.abs(audioElement.currentTime - nextTime) > threshold) {
      try {
        audioElement.currentTime = nextTime;
      } catch {
        // The audio element may not have loaded metadata yet.
      }
    }
  };

  const startAudio = (): void => {
    syncAudioTime();
    if (
      !videoElement ||
      !audioElement ||
      !audioSource ||
      audioError ||
      !wantsPlayback ||
      videoWaiting ||
      audioWaiting ||
      pendingAudioPlay
    ) {
      return;
    }
    handleVideoRateChange();
    handleVideoVolumeChange();
    const audio = audioElement;
    const version = ++playbackVersion;
    pendingAudioPlay = true;
    void audio
      .play()
      .then(() => {
        if (audio !== audioElement || !wantsPlayback) audio.pause();
      })
      .catch(() => {
        if (version === playbackVersion && audio === audioElement && wantsPlayback) {
          handleAudioError();
        }
      })
      .finally(() => {
        if (version === playbackVersion) pendingAudioPlay = false;
      });
  };

  const stopPlayback = (): void => {
    wantsPlayback = false;
    bufferingPause = false;
    playbackVersion += 1;
    pendingAudioPlay = false;
    videoElement?.pause();
    audioElement?.pause();
  };

  const handleVideoPlay = (): void => {
    onPlayback?.();
    wantsPlayback = true;
    if (!audioSource || audioError) {
      handleAudioError();
      return;
    }
    if (audioWaiting) {
      handleAudioWaiting();
      return;
    }
    startAudio();
  };

  const handleVideoPause = (): void => {
    syncAudioTime();
    if (bufferingPause) {
      bufferingPause = false;
    } else {
      wantsPlayback = false;
    }
    playbackVersion += 1;
    pendingAudioPlay = false;
    audioElement?.pause();
  };

  const handleVideoEnded = (): void => {
    syncAudioTime();
    stopPlayback();
  };

  const handleVideoSeeking = (): void => {
    playbackVersion += 1;
    pendingAudioPlay = false;
    audioElement?.pause();
    syncAudioTime();
  };

  const handleVideoSeeked = (): void => {
    syncAudioTime();
    if (videoElement && !videoElement.paused) startAudio();
  };

  const handleVideoWaiting = (): void => {
    videoWaiting = true;
    playbackVersion += 1;
    pendingAudioPlay = false;
    audioElement?.pause();
  };

  const resumeAfterBuffer = (): void => {
    syncAudioTime();
    if (!wantsPlayback || videoWaiting || audioWaiting || audioError) return;
    const video = videoElement;
    if (video?.paused) {
      const version = playbackVersion;
      void video.play().catch(() => {
        if (version === playbackVersion && video === videoElement) stopPlayback();
      });
    } else {
      startAudio();
    }
  };

  const handleVideoCanPlay = (): void => {
    videoWaiting = false;
    resumeAfterBuffer();
  };

  const handleAudioWaiting = (): void => {
    audioWaiting = true;
    playbackVersion += 1;
    pendingAudioPlay = false;
    if (wantsPlayback && videoElement && !videoElement.paused) {
      bufferingPause = true;
      videoElement.pause();
    }
    audioElement?.pause();
  };

  const handleVideoRateChange = (): void => {
    if (videoElement && audioElement) {
      audioElement.playbackRate = videoElement.playbackRate;
    }
  };

  const handleVideoVolumeChange = (): void => {
    if (videoElement && audioElement) {
      audioElement.volume = videoElement.volume;
      audioElement.muted = videoElement.muted;
    }
  };

  const handleAudioError = (): void => {
    audioError = true;
    stopPlayback();
  };

  const handleAudioCanPlay = (): void => {
    audioError = false;
    audioWaiting = false;
    resumeAfterBuffer();
  };

  const handleVideoError = (): void => {
    mediaError = true;
    loadState = "error";
    stopPlayback();
  };

  const retry = (): void => {
    retryNonce += 1;
    audioError = false;
    mediaError = false;
  };

  $effect(() => {
    const video = videoElement;
    const source = videoSource;
    if (video && source) {
      video.src = source;
      video.load();
    }
    return () => {
      video?.pause();
      video?.removeAttribute("src");
      video?.load();
    };
  });

  $effect(() => {
    const video = videoElement;
    const audio = audioElement;
    const source = audioSource;
    void videoSource;
    untrack(() => {
      stopPlayback();
      videoWaiting = false;
      audioWaiting = false;
      audioError = !source;
      if (audio && source) {
        audio.src = source;
        audio.load();
      }
    });
    // Capture old elements, not bindings which may already point at new media.
    return () =>
      untrack(() => {
        playbackVersion += 1;
        wantsPlayback = false;
        pendingAudioPlay = false;
        video?.pause();
        audio?.pause();
        audio?.removeAttribute("src");
        audio?.load();
      });
  });

  $effect(() => {
    void pauseToken;
    untrack(stopPlayback);
  });
</script>

{#if descriptors.length > 0}
  <svelte:element
    this={embedded ? "section" : "article"}
    class={embedded ? "flex h-full flex-col gap-4" : "card content-card-shell shadow-sm"}
  >
    <div class={embedded ? "flex h-full flex-col gap-4" : "card-body gap-4 p-3 sm:p-5"}>
      {#if showVariantControl && descriptors.length > 1}
        <label class="flex min-h-11 flex-col gap-1 text-sm font-semibold">
          <span>{variantLabel}</span>
          <select
            class="select select-bordered min-h-11 w-full"
            aria-label={variantLabel}
            value={selectedDescriptorIndex}
            onchange={(event) => {
              onDescriptorChange(Number((event.currentTarget as HTMLSelectElement).value));
            }}
          >
            {#each descriptorOptions as option, index (option.value)}
              <option value={index}>{option.label}</option>
            {/each}
          </select>
        </label>
      {/if}

      {#if loadState === "loading"}
        <div
          class="flex aspect-video items-center justify-center rounded-xl bg-(--archive-surface-sunken)"
          role="status"
        >
          <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
          <span class="sr-only">{loadingLabel}</span>
        </div>
      {:else if loadState === "error" || mediaError}
        <div
          class="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl bg-(--archive-surface-sunken) px-6 text-center"
          role="alert"
        >
          <p class="text-sm text-base-content/70">{unsupportedLabel}</p>
          <button type="button" class="btn btn-outline btn-sm min-h-11" onclick={retry}
            >{retryLabel}</button
          >
        </div>
      {:else if videoSource}
        <!-- Caption assets are not part of the current music detail payload. -->
        <video
          bind:this={videoElement}
          class="mx-auto aspect-video h-full w-auto max-w-full rounded-xl bg-black object-contain"
          controls
          preload="metadata"
          playsinline
          {poster}
          title={`${title} ${videoLabel}`}
          aria-label={`${title} ${videoLabel}`}
          onplay={handleVideoPlay}
          onpause={handleVideoPause}
          onended={handleVideoEnded}
          onseeking={handleVideoSeeking}
          onseeked={handleVideoSeeked}
          ontimeupdate={() => syncAudioTime(0.25)}
          onwaiting={handleVideoWaiting}
          oncanplay={handleVideoCanPlay}
          onplaying={handleVideoCanPlay}
          onloadedmetadata={() => syncAudioTime()}
          onratechange={handleVideoRateChange}
          onvolumechange={handleVideoVolumeChange}
          onerror={handleVideoError}
        >
          <p>{noVideoLabel}</p>
        </video>
        {#if audioSource}
          <audio
            bind:this={audioElement}
            class="sr-only"
            aria-hidden="true"
            preload="metadata"
            onerror={handleAudioError}
            oncanplay={handleAudioCanPlay}
            onloadedmetadata={() => syncAudioTime()}
            onwaiting={handleAudioWaiting}
            onended={stopPlayback}
          ></audio>
        {/if}
        {#if audioError}
          <p class="text-sm text-error" role="alert">{audioUnavailableLabel}</p>
          <button type="button" class="btn btn-outline btn-sm min-h-11 self-start" onclick={retry}
            >{retryLabel}</button
          >
        {/if}
      {/if}
    </div>
  </svelte:element>
{/if}
