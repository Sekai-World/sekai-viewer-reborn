<script lang="ts">
  import Icon from "@iconify/svelte";
  import StoryReaderHeader from "#lib/components/story-reader/StoryReaderHeader.svelte";
  import StoryPlayerHost from "#lib/components/story-reader/StoryPlayerHost.svelte";
  import { createI18nTranslator } from "#lib/i18n/runtime.js";
  import type { StoryRouteStoryType } from "#lib/live2d/story-route.js";
  import { readerBackPath } from "#lib/story/story-picker.js";
  import { createPageTitle } from "#lib/page-title.js";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));

  const identityKey = $derived(
    `${data.identity.region}/${data.identity.storyType}/${data.identity.storyId}`
  );
  // Reload remounts the host for the current story only: the count is scoped
  // to the identity it was requested on, so navigating to another story starts
  // from "Click to load" again instead of inheriting auto-start.
  let reloadRequest = $state({ identity: "", count: 0 });
  const reloadCount = $derived(reloadRequest.identity === identityKey ? reloadRequest.count : 0);

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
  const playerReady = $derived(data.readerStatus === "ok");
  // Generated PageData types flatten the load union into optional fields;
  // gate playback data behind an explicit runtime guard so Svelte 5 keeps
  // the narrowed object.
  const player = $derived(
    playerReady && data.storyDocument ? { documentReference: data.storyDocument } : null
  );
</script>

<svelte:head>
  <title>
    {createPageTitle(
      subtitle ?? translate("storyReader.player.title"),
      storyTypeLabels[data.identity.storyType]
    )}
  </title>
</svelte:head>

<section aria-labelledby="story-reader-player-title" class="flex flex-col gap-6">
  <StoryReaderHeader
    identity={data.identity}
    backHref={readerBackPath(data.identity.storyType)}
    backLabel={backLabels[data.identity.storyType]}
    kicker={translate("storyReader.player.kicker")}
    title={translate("storyReader.player.title")}
    metaLabels={{
      region: translate("storyReader.meta.region"),
      storyType: translate("storyReader.meta.storyType"),
      storyId: translate("storyReader.meta.storyId")
    }}
    regionLabel={translate(`region.${data.identity.region}`)}
    storyTypeLabel={storyTypeLabels[data.identity.storyType]}
    {subtitle}
    bannerUrl={data.story?.bannerUrl}
    switchModeHref={`/story-reader/${data.identity.region}/${data.identity.storyType}/${data.identity.storyId}`}
    switchModeLabel={translate("storyReader.player.switchToTextOnly")}
    switchModeHint={translate("storyReader.player.switchToTextOnlyHint")}
  />

  {#if player}
    <!-- The host only builds its player on mount; key it on story identity so
         client-side navigation between stories or regions tears the old player
         down and starts a fresh one. -->
    {#key `${identityKey}#${reloadCount}`}
      <StoryPlayerHost
        documentReference={player.documentReference}
        autoStart={reloadCount > 0}
        onReload={() => {
          reloadRequest = { identity: identityKey, count: reloadCount + 1 };
        }}
        labels={{
          tapToLoad: translate("storyReader.player.hint.tapToLoad"),
          tapToPlay: translate("storyReader.player.hint.tapToPlay"),
          restart: translate("storyReader.player.controls.restart"),
          previous: translate("storyReader.player.controls.previous"),
          next: translate("storyReader.player.controls.next"),
          autoplay: translate("storyReader.player.controls.autoplay"),
          fullscreen: translate("storyReader.player.controls.fullscreen"),
          textLog: translate("storyReader.player.controls.textLog"),
          textLogClose: translate("storyReader.player.controls.textLogClose"),
          textLogEmpty: translate("storyReader.player.controls.textLogEmpty"),
          hideInterface: translate("storyReader.player.controls.hideInterface"),
          showInterface: translate("storyReader.player.controls.showInterface"),
          rotateToPlay: translate("storyReader.player.hint.rotateToPlay"),
          tapToContinue: translate("storyReader.player.hint.tapToContinue"),
          textAnimation: translate("storyReader.player.controls.textAnimation"),
          voiceVolume: translate("storyReader.player.controls.voiceVolume"),
          bgmVolume: translate("storyReader.player.controls.bgmVolume"),
          seVolume: translate("storyReader.player.controls.seVolume"),
          loading: translate("storyReader.player.loading.label"),
          loadFailed: translate("storyReader.player.loading.failed"),
          loadFailedMediaMissing: translate("storyReader.player.loading.mediaMissing"),
          retry: translate("storyReader.player.loading.retry"),
          reload: translate("storyReader.player.controls.reload"),
          statusPlaying: translate("storyReader.player.status.playing"),
          statusFinished: translate("storyReader.player.status.finished"),
          cancel: translate("storyReader.modeDialog.cancel"),
          warnings: translate("storyReader.player.warnings"),
          phaseAssets: translate("storyReader.player.loading.phase.assets"),
          phaseModels: translate("storyReader.player.loading.phase.models"),
          phaseModelFiles: translate("storyReader.player.loading.phase.modelFiles"),
          phaseMotions: translate("storyReader.player.loading.phase.motions"),
          phaseStage: translate("storyReader.player.loading.phase.stage")
        }}
      />
    {/key}
    {#if data.neighbors && (data.neighbors.previous || data.neighbors.next)}
      <nav aria-label={translate("storyReader.player.nav.label")} class="grid gap-3 sm:grid-cols-2">
        {#if data.neighbors.previous}
          <a
            class="btn h-auto justify-start gap-3 py-3 text-left btn-outline sm:col-start-1"
            href={`/live2d/story-reader/${data.identity.region}/${data.identity.storyType}/${data.neighbors.previous.storyId}`}
            rel="prev"
          >
            <Icon icon="mdi:arrow-left" class="size-5 shrink-0" aria-hidden="true" />
            <span class="flex min-w-0 flex-col items-start">
              <span class="text-xs font-normal text-base-content/60">
                {translate("storyReader.player.nav.previous")}
              </span>
              <span class="max-w-full truncate">{data.neighbors.previous.title}</span>
            </span>
          </a>
        {/if}
        {#if data.neighbors.next}
          <a
            class="btn h-auto justify-end gap-3 py-3 text-right btn-outline sm:col-start-2"
            href={`/live2d/story-reader/${data.identity.region}/${data.identity.storyType}/${data.neighbors.next.storyId}`}
            rel="next"
          >
            <span class="flex min-w-0 flex-col items-end">
              <span class="text-xs font-normal text-base-content/60">
                {translate("storyReader.player.nav.next")}
              </span>
              <span class="max-w-full truncate">{data.neighbors.next.title}</span>
            </span>
            <Icon icon="mdi:arrow-right" class="size-5 shrink-0" aria-hidden="true" />
          </a>
        {/if}
      </nav>
    {/if}
  {:else if data.readerStatus === "region-unavailable"}
    <div class="alert alert-soft" role="status">
      <Icon icon="mdi:alert-circle-outline" class="size-5 shrink-0" aria-hidden="true" />
      <span>{translate("storyReader.state.regionUnavailable")}</span>
    </div>
  {:else if data.readerStatus === "unavailable"}
    <div class="alert alert-soft alert-warning" role="alert">
      <Icon icon="mdi:alert-circle-outline" class="size-5 shrink-0" aria-hidden="true" />
      <span>{translate("storyReader.state.unavailable")}</span>
    </div>
  {:else if data.readerStatus === "unsupported-story"}
    <div class="alert alert-soft" role="status">
      <Icon icon="mdi:progress-wrench" class="size-5 shrink-0" aria-hidden="true" />
      <span>{translate("storyReader.state.unsupported")}</span>
    </div>
  {/if}
</section>
