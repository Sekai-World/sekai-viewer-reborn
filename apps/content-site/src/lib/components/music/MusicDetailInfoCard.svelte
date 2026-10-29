<script lang="ts">
  import { formatDisplayDateTime } from "#lib/time/date-time.js";
  import type { MusicDetail } from "#lib/domain/music-detail.js";
  import MusicYoutubeCard from "#lib/components/music/MusicYoutubeCard.svelte";
  import { getMusicVideoReferences } from "#lib/domain/music-youtube.js";
  import { unitCodeByMusicTag } from "#lib/domain/unit-profile.js";
  import { resolveCanonicalUnitSlug } from "#lib/domain/unit-icon.js";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";

  type VideoLinksSection = {
    originals: NonNullable<MusicDetail["musicOriginals"]>;
    songKey: string;
    songTitle: string;
    heading: string;
    openLabel: string;
    previewLabel: string;
    selectionLabel: string;
    closeLabel: string;
    unloadToken?: number;
    onEmbedOpen?: () => void;
  };

  let {
    music,
    displayLocale,
    region,
    title,
    idLabel,
    internalResourceCodeLabel,
    nameLabel,
    composerLabel,
    arrangerLabel,
    lyricistLabel,
    categoryLabel,
    tagLabel,
    publishedAtLabel,
    getCategoryLabel,
    getTagLabel,
    videoLinks
  }: {
    music: MusicDetail;
    displayLocale: string;
    region: string;
    title: string;
    idLabel: string;
    internalResourceCodeLabel: string;
    nameLabel: string;
    composerLabel: string;
    arrangerLabel: string;
    lyricistLabel: string;
    categoryLabel: string;
    tagLabel: string;
    publishedAtLabel: string;
    getCategoryLabel: (value: string) => string;
    getTagLabel: (value: string) => string;
    videoLinks?: VideoLinksSection;
  } = $props();

  const hasVideoLinks = $derived(
    videoLinks ? getMusicVideoReferences(videoLinks.originals).length > 0 : false
  );
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
      <span class="badge border-base-content/25 bg-base-100/80 font-semibold text-base-content">
        {idLabel}{music.id}
      </span>
    </div>

    <dl class="space-y-2">
      <div class="content-card-inset rounded-xl p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
        <dd class="mt-1 text-sm font-medium">{music.title}</dd>
      </div>

      {#if music.composer}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {composerLabel}
          </dt>
          <dd class="mt-1 text-sm font-medium">{music.composer}</dd>
        </div>
      {/if}

      {#if music.arranger}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {arrangerLabel}
          </dt>
          <dd class="mt-1 text-sm font-medium">{music.arranger}</dd>
        </div>
      {/if}

      {#if music.lyricist}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {lyricistLabel}
          </dt>
          <dd class="mt-1 text-sm font-medium">{music.lyricist}</dd>
        </div>
      {/if}

      {#if music.categories.length > 0}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {categoryLabel}
          </dt>
          <dd class="mt-1 flex flex-wrap gap-1.5">
            {#each music.categories as category (category)}
              <span
                class="badge badge-sm border-base-content/25 bg-base-100/80 font-semibold text-base-content"
                >{getCategoryLabel(category)}</span
              >
            {/each}
          </dd>
        </div>
      {/if}

      {#if music.tags.length > 0}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{tagLabel}</dt>
          <dd class="mt-1 flex flex-wrap gap-1.5">
            {#each music.tags as tag (tag)}
              {@const unitSlug = resolveCanonicalUnitSlug(unitCodeByMusicTag[tag])}
              {#if unitSlug}
                <a
                  href={resolve("/unit/[region]/[unit]", { region, unit: unitSlug })}
                  class="badge badge-sm border-base-content/25 bg-base-100/80 font-semibold text-base-content outline-none transition-colors duration-150 hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                  >{getTagLabel(tag)}</a
                >
              {:else}
                <span
                  class="badge badge-sm border-base-content/25 bg-base-100/80 font-semibold text-base-content"
                  >{getTagLabel(tag)}</span
                >
              {/if}
            {/each}
          </dd>
        </div>
      {/if}

      {#if music.publishedAt}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {publishedAtLabel}
          </dt>
          <dd class="mt-1 text-sm font-medium">
            {formatDisplayDateTime(music.publishedAt, displayLocale)}
          </dd>
        </div>
      {/if}
      {#if hasVideoLinks && videoLinks}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {videoLinks.heading}
          </dt>
          <dd class="mt-2 min-w-0">
            <MusicYoutubeCard {...videoLinks} />
          </dd>
        </div>
      {/if}
      <div class="content-card-inset rounded-xl p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {internalResourceCodeLabel}
        </dt>
        <dd class="mt-1 text-sm font-medium">{music.assetBundleName ?? "--"}</dd>
      </div>
    </dl>
  </div>
</article>
