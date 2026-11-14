<script lang="ts">
  export interface ChibiAnimationPickerLabels {
    title: string;
    filterLabel: string;
    filterPlaceholder: string;
    noMatches: string;
    /** Contains a `{count}` token. */
    count: string;
  }

  interface Props {
    animations: readonly string[];
    selected: string;
    labels: ChibiAnimationPickerLabels;
    disabled?: boolean;
    onSelect: (animation: string) => void;
  }

  let { animations, selected, labels, disabled = false, onSelect }: Props = $props();

  let filter = $state("");
  // A filter typed for one model would hide the next model's selection.
  $effect(() => {
    void animations;
    filter = "";
  });
  const visibleAnimations = $derived.by(() => {
    const query = filter.trim().toLowerCase();
    return query ? animations.filter((name) => name.toLowerCase().includes(query)) : animations;
  });
</script>

<section
  class="flex min-w-0 flex-col gap-3 rounded-xl border border-base-content/10 bg-base-100 p-4"
  aria-labelledby="chibi-animation-title"
>
  <div class="flex items-center justify-between gap-3">
    <h2 id="chibi-animation-title" class="text-lg font-semibold">{labels.title}</h2>
    <span class="text-sm text-base-content/65 tabular-nums">
      {labels.count.replace("{count}", String(visibleAnimations.length))}
    </span>
  </div>
  <input
    type="search"
    class="input min-h-11 w-full"
    aria-label={labels.filterLabel}
    placeholder={labels.filterPlaceholder}
    autocomplete="off"
    {disabled}
    bind:value={filter}
  />
  <!-- Fixed height: the list keeps its geometry while the model loads. -->
  <div class="h-72 overflow-y-auto rounded-lg border border-base-content/10 lg:h-96">
    {#if visibleAnimations.length > 0}
      <ul class="flex flex-col p-1" role="list">
        {#each visibleAnimations as animation (animation)}
          <li>
            <button
              type="button"
              class="btn btn-ghost min-h-11 w-full justify-start font-mono text-sm font-normal break-all focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              class:btn-active={animation === selected}
              aria-pressed={animation === selected}
              {disabled}
              onclick={() => onSelect(animation)}>{animation}</button
            >
          </li>
        {/each}
      </ul>
    {:else if animations.length > 0}
      <p class="p-4 text-sm text-base-content/70" role="status">{labels.noMatches}</p>
    {/if}
  </div>
</section>
