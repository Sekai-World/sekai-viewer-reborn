<script lang="ts">
  import type { MusicDetail } from "$lib/domain/music-detail";
  import { getMusicChartPreviewAssetURL } from "$lib/assets/index";
  import type { SupportedRegion } from "$lib/domain/regions";
  import Icon from "@iconify/svelte";

  const difficultyOrder = ["easy", "normal", "hard", "expert", "master", "append"];
  const difficultyColor: Record<string, string> = {
    easy: "badge-info",
    normal: "badge-success",
    hard: "badge-warning",
    expert: "badge-error",
    master: "badge-primary",
    append: "badge-secondary"
  };

  let {
    music,
    region,
    difficultyLabel,
    levelLabel,
    noteCountLabel,
    chartPreviewLabel,
    noDifficulties,
    getDifficultyLabel
  }: {
    music: MusicDetail;
    region: SupportedRegion;
    difficultyLabel: string;
    levelLabel: string;
    noteCountLabel: string;
    chartPreviewLabel: string;
    noDifficulties: string;
    getDifficultyLabel: (value: string) => string;
  } = $props();

  const sortedDifficulties = $derived(
    [...music.difficulties].sort(
      (a, b) =>
        difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty)
    )
  );
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon
        icon="mdi:chart-bar"
        class="size-4 shrink-0 translate-y-[0.5px]"
        aria-hidden="true"
      />
      <span>{difficultyLabel}</span>
    </p>

    {#if sortedDifficulties.length > 0}
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th></th>
              <th>{levelLabel}</th>
              <th>{noteCountLabel}</th>
              <th class="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {#each sortedDifficulties as diff (diff.difficulty)}
              <tr>
                <td>
                  <span class="badge badge-sm min-w-20 justify-center {difficultyColor[diff.difficulty] ?? 'badge-ghost'}">
                    {getDifficultyLabel(diff.difficulty)}
                  </span>
                </td>
                <td class="font-medium">{diff.playLevel}</td>
                <td>{diff.noteCount}</td>
                <td>
                  <a
                    href={getMusicChartPreviewAssetURL(region, music.id, diff.difficulty)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-ghost btn-xs"
                    aria-label={chartPreviewLabel}
                  >
                    <Icon icon="mdi:eye-outline" class="size-4" aria-hidden="true" />
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="text-sm opacity-60">{noDifficulties}</p>
    {/if}
  </div>
</article>
