<script lang="ts">
  import Icon from "@iconify/svelte";

  let {
    src,
    playLabel = "Play",
    stopLabel = "Stop",
    errorLabel = "Audio unavailable",
    class: className
  }: {
    src: string;
    playLabel?: string;
    stopLabel?: string;
    errorLabel?: string;
    class?: string;
  } = $props();

  let audio: HTMLAudioElement | null = $state(null);
  let isPlaying = $state(false);
  let loadError = $state(false);
  let currentSrc = $state("");
  let progress = $state(0);

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

  const stopPlayback = (): void => {
    if (!audio) {
      isPlaying = false;
      progress = 0;
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    isPlaying = false;
    progress = 0;
  };

  $effect(() => {
    if (src === currentSrc) return;

    currentSrc = src;
    loadError = false;
    stopPlayback();
  });

  $effect(() => {
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  });

  const handleAudioError = (): void => {
    loadError = true;
    stopPlayback();
  };

  const toggle = async (): Promise<void> => {
    if (!audio || loadError) return;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (audio.ended || audio.currentTime >= audio.duration) {
      audio.currentTime = 0;
    }

    progress = 0;
    isPlaying = true;
    try {
      await audio.play();
    } catch {
      if (audio.error) {
        handleAudioError();
        return;
      }

      stopPlayback();
    }
  };

  let currentIcon = $derived(loadError ? "mdi:volume-off" : isPlaying ? "mdi:stop" : "mdi:play");
  let currentLabel = $derived(loadError ? errorLabel : isPlaying ? stopLabel : playLabel);
</script>

<div
  class="relative inline-flex size-13 shrink-0 items-center justify-center {loadError
    ? 'tooltip tooltip-error tooltip-left'
    : ''} {className ?? ''}"
  data-tip={loadError ? errorLabel : undefined}
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
    class="btn btn-circle btn-md relative z-10 shrink-0 shadow-sm {loadError
      ? 'btn-ghost text-base-content/40 cursor-not-allowed'
      : 'btn-primary'}"
    aria-label={currentLabel}
    title={currentLabel}
    onclick={toggle}
    disabled={loadError}
  >
    <Icon icon={currentIcon} class="size-5" aria-hidden="true" />
  </button>
</div>

<audio
  bind:this={audio}
  {src}
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
