<script lang="ts">
  import Icon from "@iconify/svelte";
  import { CirclePlayButton } from "@platform/ui-shell";

  /**
   * Audio playback button for story voice/SE rows. Tries the provided sources
   * in order (canonical path first, part-voice fallbacks after) and exposes an
   * unavailable state when every candidate fails. The control mirrors the
   * circular play button used by the shared AudioPlayer.
   */
  interface Props {
    sources: string[];
    loop?: boolean;
    playLabel: string;
    stopLabel: string;
    unavailableLabel: string;
  }

  let { sources, loop = false, playLabel, stopLabel, unavailableLabel }: Props = $props();

  let audio: HTMLAudioElement | null = null;
  let playing = $state(false);
  let exhausted = $state(false);
  let sourceIndex = 0;

  const stop = (): void => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    playing = false;
  };

  const cleanup = (): void => {
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
  };

  $effect(() => () => cleanup());

  const toggle = (): void => {
    if (playing) {
      stop();
      return;
    }
    if (exhausted || sources.length === 0) return;
    cleanup();
    const source = sources[sourceIndex];
    const element = new Audio();
    element.loop = loop;
    element.onended = () => {
      playing = false;
    };
    element.onerror = () => {
      sourceIndex += 1;
      if (sourceIndex >= sources.length) {
        exhausted = true;
        playing = false;
        cleanup();
        return;
      }
      element.src = sources[sourceIndex];
      element.play().catch(() => undefined);
    };
    element.onplay = () => {
      playing = true;
    };
    audio = element;
    element.src = source;
    element.play().catch(() => undefined);
  };
</script>

{#if exhausted}
  <button
    type="button"
    class="btn btn-circle btn-sm btn-ghost no-animation"
    disabled
    aria-disabled="true"
    aria-label={unavailableLabel}
    title={unavailableLabel}
  >
    <Icon icon="mdi:volume-off" class="size-4" aria-hidden="true" />
  </button>
{:else}
  <CirclePlayButton
    size="md"
    playing={playing}
    label={playing ? stopLabel : playLabel}
    onclick={toggle}
  />
{/if}
