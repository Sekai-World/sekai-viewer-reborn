<script lang="ts">
  import Icon from "@iconify/svelte";
  import StoryReaderHeader from "$lib/components/story-reader/StoryReaderHeader.svelte";
  import StoryTextRows from "$lib/components/story-reader/StoryTextRows.svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import type { StoryRouteStoryType } from "$lib/live2d/story-route";
  import { readerBackPath } from "$lib/story/story-picker";
  import { createPageTitle } from "$lib/page-title";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));

  const storyTypeLabels = $derived({
    unit: translate("storyReader.storyType.unit"),
    event: translate("storyReader.storyType.event"),
    character: translate("storyReader.storyType.character"),
    card: translate("storyReader.storyType.card"),
    "area-talk": translate("storyReader.storyType.area-talk"),
    special: translate("storyReader.storyType.special"),
    profile: translate("storyReader.storyType.profile")
  }) satisfies Record<StoryRouteStoryType, string>;

  // The back link returns to the picker list page this story was opened
  // from; profile has no picker surface and falls back to the unit list.
  const backLabels = $derived({
    unit: translate("storyReader.picker.backToUnits"),
    event: translate("storyReader.picker.backToEvents"),
    character: translate("storyReader.picker.backToCharacters"),
    card: translate("storyReader.picker.backToCards"),
    "area-talk": translate("storyReader.picker.backToAreas"),
    special: translate("storyReader.picker.backToSpecials"),
    profile: translate("storyReader.picker.backToUnits")
  }) satisfies Record<StoryRouteStoryType, string>;

  const subtitle = $derived(
    [data.story?.chapterTitle, data.story?.episodeTitle]
      .filter((part) => part && part.length > 0)
      .join(" · ") || undefined
  );
  const readerReady = $derived(data.readerStatus === "ok");
  const castNames = $derived(
    (data.cast ?? [])
      .map((member) => member.name)
      .filter((name, index, names) => name && names.indexOf(name) === index)
  );
</script>

<svelte:head>
  <title>
    {createPageTitle(
      subtitle ?? translate("storyReader.textOnly.title"),
      storyTypeLabels[data.identity.storyType]
    )}
  </title>
</svelte:head>

<section aria-labelledby="story-reader-text-title" class="flex flex-col gap-6">
  <StoryReaderHeader
    identity={data.identity}
    backHref={readerBackPath(data.identity.storyType)}
    backLabel={backLabels[data.identity.storyType]}
    title={translate("storyReader.textOnly.title")}
    metaLabels={{
      region: translate("storyReader.meta.region"),
      storyType: translate("storyReader.meta.storyType"),
      storyId: translate("storyReader.meta.storyId")
    }}
    regionLabel={translate(`region.${data.identity.region}`)}
    storyTypeLabel={storyTypeLabels[data.identity.storyType]}
    {subtitle}
    bannerUrl={data.story?.bannerUrl}
    switchModeHref={`/live2d/story-reader/${data.identity.region}/${data.identity.storyType}/${data.identity.storyId}`}
    switchModeLabel={translate("storyReader.textOnly.switchToPlayer")}
  />

  {#if readerReady}
    {#if castNames.length > 0}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
          {translate("storyReader.textOnly.cast")}
        </span>
        {#each castNames as name (name)}
          <span class="badge badge-outline badge-secondary">{name}</span>
        {/each}
      </div>
    {/if}

    <StoryTextRows
      rows={data.rows ?? []}
      labels={{
        voicePlay: translate("storyReader.textOnly.voice.play"),
        voiceStop: translate("storyReader.textOnly.voice.stop"),
        voiceUnavailable: translate("storyReader.textOnly.voice.unavailable"),
        backgroundLabel: translate("storyReader.textOnly.row.background"),
        showBackground: translate("storyReader.textOnly.row.showBackground"),
        bgmLabel: translate("storyReader.textOnly.row.bgm"),
        seLabel: translate("storyReader.textOnly.row.se"),
        seStopLabel: translate("storyReader.textOnly.row.seStop"),
        fullscreenLabel: translate("storyReader.textOnly.row.fullscreen"),
        movieLabel: translate("storyReader.textOnly.row.movie"),
        previewClose: translate("storyReader.textOnly.preview.close"),
        previewDownload: translate("storyReader.textOnly.preview.download"),
        previewOpenInNewWindow: translate("storyReader.textOnly.preview.openInNewWindow"),
        audioPlay: translate("storyReader.textOnly.audio.play"),
        audioPause: translate("storyReader.textOnly.audio.pause"),
        audioDownload: translate("storyReader.textOnly.audio.download"),
        audioDownloadClose: translate("storyReader.textOnly.audio.downloadClose"),
        audioVolume: translate("storyReader.textOnly.audio.volume"),
        audioSeek: translate("storyReader.textOnly.audio.seek"),
        audioUnavailable: translate("storyReader.textOnly.audio.unavailable"),
        audioDownloadPreparing: translate("storyReader.textOnly.audio.downloadProgress.preparing"),
        audioDownloadFetchingAudio: translate(
          "storyReader.textOnly.audio.downloadProgress.fetchingAudio"
        ),
        audioDownloadFetchingCover: translate(
          "storyReader.textOnly.audio.downloadProgress.fetchingCover"
        ),
        audioDownloadWritingMetadata: translate(
          "storyReader.textOnly.audio.downloadProgress.writingMetadata"
        ),
        audioDownloadFinalizing: translate(
          "storyReader.textOnly.audio.downloadProgress.finalizing"
        ),
        audioDownloadReady: translate("storyReader.textOnly.audio.downloadProgress.ready"),
        audioDownloadFailed: translate("storyReader.textOnly.audio.downloadProgress.failed"),
        audioDownloadCancelled: translate("storyReader.textOnly.audio.downloadProgress.cancelled")
      }}
    />
  {:else if data.readerStatus === "unavailable"}
    <div class="alert alert-soft alert-warning" role="alert">
      <Icon icon="mdi:alert-circle-outline" class="size-5 shrink-0" aria-hidden="true" />
      <span>{translate("storyReader.state.unavailable")}</span>
    </div>
  {:else if data.readerStatus === "scenario-error"}
    <div class="alert alert-soft alert-error" role="alert">
      <Icon icon="mdi:alert-circle-outline" class="size-5 shrink-0" aria-hidden="true" />
      <span>{translate("storyReader.state.scenarioError")}</span>
    </div>
  {:else if data.readerStatus === "unsupported-story"}
    <div class="alert alert-soft" role="status">
      <Icon icon="mdi:progress-wrench" class="size-5 shrink-0" aria-hidden="true" />
      <span>{translate("storyReader.state.unsupported")}</span>
    </div>
  {/if}
</section>
