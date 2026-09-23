<script lang="ts">
  import Icon from "@iconify/svelte";
  import StoryReaderHeader from "$lib/components/story-reader/StoryReaderHeader.svelte";
  import StoryPlayerHost from "$lib/components/story-reader/StoryPlayerHost.svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import type { StoryRouteStoryType } from "$lib/live2d/story-route";
  import { readerBackPath } from "$lib/story/story-picker";
  import { createPageTitle } from "$lib/page-title";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

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
  const playerReady = $derived(data.readerStatus === "ok");
  // Generated PageData types flatten the load union into optional fields;
  // gate playback data behind an explicit runtime guard so Svelte 5 keeps
  // the narrowed object.
  const player = $derived(
    playerReady && data.scenarioData
      ? {
          scenarioData: data.scenarioData,
          voiceCharacters: data.voiceCharacters ?? [],
          region: data.identity.region,
          assetBase: data.assetBase ?? "https://storage.sekai.best",
          regionBucket: data.regionBucket ?? "sekai-jp-assets",
          isCardStory: data.isCardStory ?? false,
          isActionSet: data.isActionSet ?? false
        }
      : null
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
  />

  {#if player}
    <StoryPlayerHost
      scenarioData={player.scenarioData}
      voiceCharacters={player.voiceCharacters}
      region={player.region}
      assetBase={player.assetBase}
      regionBucket={player.regionBucket}
      isCardStory={player.isCardStory}
      isActionSet={player.isActionSet}
      labels={{
        tapToLoad: translate("storyReader.player.hint.tapToLoad"),
        tapToPlay: translate("storyReader.player.hint.tapToPlay"),
        previous: translate("storyReader.player.controls.previous"),
        next: translate("storyReader.player.controls.next"),
        autoplay: translate("storyReader.player.controls.autoplay"),
        fullscreen: translate("storyReader.player.controls.fullscreen"),
        rotateToPlay: translate("storyReader.player.hint.rotateToPlay"),
        tapToContinue: translate("storyReader.player.hint.tapToContinue"),
        textAnimation: translate("storyReader.player.controls.textAnimation"),
        voiceVolume: translate("storyReader.player.controls.voiceVolume"),
        bgmVolume: translate("storyReader.player.controls.bgmVolume"),
        seVolume: translate("storyReader.player.controls.seVolume"),
        loading: translate("storyReader.player.loading.label"),
        loadFailed: translate("storyReader.player.loading.failed"),
        warnings: translate("storyReader.player.warnings"),
        phaseAssets: translate("storyReader.player.loading.phase.assets"),
        phaseModels: translate("storyReader.player.loading.phase.models"),
        phaseModelFiles: translate("storyReader.player.loading.phase.modelFiles"),
        phaseMotions: translate("storyReader.player.loading.phase.motions"),
        phaseStage: translate("storyReader.player.loading.phase.stage")
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
