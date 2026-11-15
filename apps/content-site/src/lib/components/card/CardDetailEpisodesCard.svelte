<script lang="ts">
  import type { CardDetailEpisode } from "#lib/domain/card-detail.js";
  import type { SupportedRegion } from "#lib/domain/regions.js";
  import { getCardStoryReaderHref } from "#lib/media-lab-site.js";
  import Icon from "@iconify/svelte";

  let {
    episodes,
    region,
    title,
    releaseConditionLabel,
    costsLabel,
    rewardsLabel,
    noEpisodesLabel,
    storyReaderLabel
  }: {
    episodes: CardDetailEpisode[];
    region: SupportedRegion;
    title: string;
    releaseConditionLabel: string;
    costsLabel: string;
    rewardsLabel: string;
    noEpisodesLabel: string;
    storyReaderLabel: string;
  } = $props();
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon icon="mdi:book-open-page-variant-outline" class="size-4" aria-hidden="true" />
      <span>{title}</span>
    </p>

    {#if episodes.length > 0}
      <div class="grid gap-3">
        {#each episodes as episode (episode.id)}
          {@const storyReaderHref = getCardStoryReaderHref(region, episode.id)}
          <section class="content-card-inset rounded-xl p-3 sm:px-4">
            <div class="flex items-start justify-between gap-3">
              <h3 class="text-sm font-semibold">{episode.title}</h3>
              {#if episode.episodeNo !== null}
                <span class="badge badge-outline border-base-content/20">#{episode.episodeNo}</span>
              {/if}
            </div>

            {#if episode.releaseConditionSentence || episode.releaseConditionType}
              <p class="mt-2 text-xs font-semibold uppercase tracking-[0.14em] opacity-60">
                {releaseConditionLabel}
              </p>
              <p class="mt-1 text-sm">
                {episode.releaseConditionSentence ?? episode.releaseConditionType}
              </p>
            {/if}

            {#if episode.costs.length > 0}
              <p class="mt-3 text-xs font-semibold uppercase tracking-[0.14em] opacity-60">
                {costsLabel}
              </p>
              <p class="mt-1 text-sm">{episode.costs.join(", ")}</p>
            {/if}

            {#if episode.rewards.length > 0}
              <p class="mt-3 text-xs font-semibold uppercase tracking-[0.14em] opacity-60">
                {rewardsLabel}
              </p>
              <p class="mt-1 text-sm">{episode.rewards.join(", ")}</p>
            {/if}

            {#if storyReaderHref}
              <a
                href={storyReaderHref}
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-ghost btn-sm mt-3 min-h-11 gap-1.5 px-2 font-medium"
                aria-label={`${storyReaderLabel}: ${episode.title}`}
              >
                <Icon icon="mdi:open-in-new" class="size-4 shrink-0" aria-hidden="true" />
                {storyReaderLabel}
              </a>
            {/if}
          </section>
        {/each}
      </div>
    {:else}
      <div class="alert">{noEpisodesLabel}</div>
    {/if}
  </div>
</article>
