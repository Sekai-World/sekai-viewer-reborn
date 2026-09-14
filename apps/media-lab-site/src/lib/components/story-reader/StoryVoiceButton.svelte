<script lang="ts">
  /**
   * Audio playback button for story voice/BGM/SE rows. Tries the provided
   * sources in order (canonical path first, part-voice fallbacks after) and
   * exposes an unavailable state when every candidate fails.
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
  <button type="button" class="btn btn-sm btn-ghost no-animation" disabled aria-disabled="true">
    <span class="iconify" data-icon="mdi:volume-off"></span>
    {unavailableLabel}
  </button>
{:else}
  <button
    type="button"
    class="btn btn-sm btn-ghost text-primary"
    onclick={toggle}
    aria-pressed={playing}
  >
    {#if playing}
      <span class="iconify" data-icon="mdi:stop-circle-outline"></span>
      {stopLabel}
    {:else}
      <span class="iconify" data-icon="mdi:play-circle-outline"></span>
      {playLabel}
    {/if}
  </button>
{/if}
