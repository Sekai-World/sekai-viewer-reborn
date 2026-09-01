<script lang="ts">
  import StoryReaderRouteShell from "$lib/components/StoryReaderRouteShell.svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import type { StoryRouteStoryType } from "$lib/live2d/story-route";
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
</script>

<svelte:head>
  <title>{translate("storyReader.textOnly.title")}</title>
</svelte:head>

<StoryReaderRouteShell
  identity={data.identity}
  backHref="/story-reader"
  backLabel={translate("storyReader.backToModes")}
  kicker={translate("storyReader.textOnly.kicker")}
  title={translate("storyReader.textOnly.title")}
  description={translate("storyReader.textOnly.description")}
  metaLabels={{
    region: translate("storyReader.meta.region"),
    storyType: translate("storyReader.meta.storyType"),
    storyId: translate("storyReader.meta.storyId")
  }}
  regionLabel={translate(`region.${data.identity.region}`)}
  storyTypeLabel={storyTypeLabels[data.identity.storyType]}
  statusTitle={translate("storyReader.textOnly.status.title")}
  statusDescription={translate("storyReader.textOnly.status.description")}
  stageNote={translate("storyReader.textOnly.loading.label")}
  switchModeHref={`/live2d/story-reader/${data.identity.region}/${data.identity.storyType}/${data.identity.storyId}`}
  switchModeLabel={translate("storyReader.textOnly.switchToPlayer")}
/>
