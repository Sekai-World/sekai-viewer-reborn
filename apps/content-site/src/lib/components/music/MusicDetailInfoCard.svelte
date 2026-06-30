<script lang="ts">
  import { formatDisplayDateTime } from "$lib/time/date-time";
  import type { MusicDetail } from "$lib/domain/music-detail";
  import Icon from "@iconify/svelte";

  let {
    music,
    displayLocale,
    title,
    idLabel,
    nameLabel,
    composerLabel,
    arrangerLabel,
    lyricistLabel,
    categoryLabel,
    tagLabel,
    publishedAtLabel,
    getCategoryLabel,
    getTagLabel
  }: {
    music: MusicDetail;
    displayLocale: string;
    title: string;
    idLabel: string;
    nameLabel: string;
    composerLabel: string;
    arrangerLabel: string;
    lyricistLabel: string;
    categoryLabel: string;
    tagLabel: string;
    publishedAtLabel: string;
    getCategoryLabel: (value: string) => string;
    getTagLabel: (value: string) => string;
  } = $props();
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <div class="flex items-start justify-between gap-3">
      <p
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon
          icon="mdi:information-outline"
          class="size-4 shrink-0 translate-y-[0.5px]"
          aria-hidden="true"
        />
        <span>{title}</span>
      </p>
      <span class="badge badge-outline border-base-content/20 font-semibold">
        {idLabel}{music.id}
      </span>
    </div>

    <dl class="space-y-2">
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
        <dd class="mt-1 text-sm font-medium">{music.title}</dd>
      </div>

      {#if music.composer}
        <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{composerLabel}</dt>
          <dd class="mt-1 text-sm font-medium">{music.composer}</dd>
        </div>
      {/if}

      {#if music.arranger}
        <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{arrangerLabel}</dt>
          <dd class="mt-1 text-sm font-medium">{music.arranger}</dd>
        </div>
      {/if}

      {#if music.lyricist}
        <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{lyricistLabel}</dt>
          <dd class="mt-1 text-sm font-medium">{music.lyricist}</dd>
        </div>
      {/if}

      {#if music.categories.length > 0}
        <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{categoryLabel}</dt>
          <dd class="mt-1 flex flex-wrap gap-1.5">
            {#each music.categories as category (category)}
              <span class="badge badge-outline badge-sm">{getCategoryLabel(category)}</span>
            {/each}
          </dd>
        </div>
      {/if}

      {#if music.tags.length > 0}
        <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{tagLabel}</dt>
          <dd class="mt-1 flex flex-wrap gap-1.5">
            {#each music.tags as tag (tag)}
              <span class="badge badge-outline badge-sm">{getTagLabel(tag)}</span>
            {/each}
          </dd>
        </div>
      {/if}

      {#if music.publishedAt}
        <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{publishedAtLabel}</dt>
          <dd class="mt-1 text-sm font-medium">{formatDisplayDateTime(music.publishedAt, displayLocale)}</dd>
        </div>
      {/if}
    </dl>
  </div>
</article>

