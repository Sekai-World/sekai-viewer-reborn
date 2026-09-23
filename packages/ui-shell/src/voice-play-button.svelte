<script lang="ts">
  import Icon from "@iconify/svelte";

  /**
   * Circular voice playback button with a progress ring. Plays the given
   * sources in order (canonical path first, fallbacks after; a load or
   * decode error advances to the next candidate) and renders an unavailable
   * state once every candidate has failed.
   */
  let {
    sources,
    loop = false,
    playLabel = "Play",
    stopLabel = "Stop",
    errorLabel = "Audio unavailable",
    class: className
  }: {
    sources: string[];
    loop?: boolean;
    playLabel?: string;
    stopLabel?: string;
    errorLabel?: string;
    class?: string;
  } = $props();

  let audio: HTMLAudioElement | null = $state(null);
  let isPlaying = $state(false);
  let unavailable = $state(false);
  let progress = $state(0);
  let sourceIndex = 0;
  let sourcesKey = "";
  let disposed = false;

  const ringCenter = 26;
  const ringRadius = 25;
  const ringCircumference = 2 * Math.PI * ringRadius;

  const clampProgress = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  };

  const updateProgressFromAudio = (): void => {
    if (!audio) {
      progress = 0;
      return;
    }
    const { currentTime, duration } = audio;
    if (!Number.isFinite(duration) || duration <= 0) {
      progress = 0;
      return;
    }
    if (!Number.isFinite(currentTime) || currentTime <= 0) {
      progress = 0;
      return;
    }
    progress = clampProgress(currentTime / duration);
  };

  const resetPlayback = (): void => {
    audio?.pause();
    if (audio) {
      audio.currentTime = 0;
    }
    isPlaying = false;
    progress = 0;
  };

  const markUnavailable = (): void => {
    resetPlayback();
    unavailable = true;
  };

  function handleAudioError(): void {
    if (disposed) return;
    sourceIndex += 1;
    if (sourceIndex >= sources.length) {
      markUnavailable();
      return;
    }
    attemptPlay();
  }

  function attemptPlay(): void {
    const source = sources[sourceIndex];
    if (!audio || !source) {
      markUnavailable();
      return;
    }
    audio.src = source;
    isPlaying = true;
    void audio.play().catch(() => {
      if (disposed) return;
      if (audio?.error) {
        handleAudioError();
        return;
      }
      resetPlayback();
    });
  }

  const toggle = (): void => {
    if (unavailable || sources.length === 0) return;
    if (isPlaying) {
      resetPlayback();
      return;
    }
    attemptPlay();
  };

  $effect(() => {
    const key = `${sources.join("\u0000")}\u0000${loop}`;
    if (key === sourcesKey) return;
    sourcesKey = key;
    sourceIndex = 0;
    unavailable = false;
    resetPlayback();
  });

  $effect(() => {
    return () => {
      disposed = true;
      audio?.pause();
      if (audio) {
        audio.removeAttribute("src");
        audio.load();
      }
    };
  });

  let currentIcon = $derived(unavailable ? "mdi:volume-off" : isPlaying ? "mdi:stop" : "mdi:play");
  let currentLabel = $derived(unavailable ? errorLabel : isPlaying ? stopLabel : playLabel);
</script>

<div
  class="relative inline-flex size-13 shrink-0 items-center justify-center {unavailable
    ? 'tooltip tooltip-error tooltip-left'
    : ''} {className ?? ''}"
  data-tip={unavailable ? errorLabel : undefined}
>
  <svg
    class="pointer-events-none absolute inset-0 z-0 size-full -rotate-90"
    viewBox="0 0 52 52"
    aria-hidden="true"
    fill="none"
  >
    <circle
      cx={ringCenter}
      cy={ringCenter}
      r={ringRadius}
      class="stroke-base-content/8"
      stroke-width="1.5"
    />
    <circle
      cx={ringCenter}
      cy={ringCenter}
      r={ringRadius}
      class="stroke-primary/55 transition-[stroke-dashoffset] duration-150 ease-linear"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-dasharray={ringCircumference}
      stroke-dashoffset={ringCircumference * (1 - progress)}
    />
  </svg>

  <button
    type="button"
    class="btn btn-circle btn-md relative z-10 shrink-0 shadow-sm {unavailable
      ? 'btn-ghost text-base-content/40 cursor-not-allowed'
      : 'btn-primary'}"
    aria-label={currentLabel}
    title={currentLabel}
    onclick={toggle}
    disabled={unavailable}
  >
    <Icon icon={currentIcon} class="size-5" aria-hidden="true" />
  </button>
</div>

<audio
  bind:this={audio}
  {loop}
  preload="none"
  ontimeupdate={updateProgressFromAudio}
  ondurationchange={updateProgressFromAudio}
  onloadedmetadata={updateProgressFromAudio}
  onerror={handleAudioError}
  onended={() => {
    isPlaying = false;
    progress = 0;
    if (audio) {
      audio.currentTime = 0;
    }
  }}
></audio>
