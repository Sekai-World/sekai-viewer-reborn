<script lang="ts">
  import StoryPicker from "$lib/components/story-reader/StoryPicker.svelte";
  import { createI18nTranslator } from "$lib/i18n/runtime";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const translate = $derived(createI18nTranslator(data.uiLocale, data.i18nMessages));

  // Validated by `+page.ts`; type navigation lives in the sidebar. The reader
  // mode is asked per story in the picker dialog (optionally remembered in
  // localStorage), so the page itself carries no mode state.
  const storyType = $derived(data.storyType);
</script>

<svelte:head>
  <title>{translate("storyReader.landing.title")}</title>
</svelte:head>

<section aria-labelledby="story-reader-landing-title" class="flex flex-col gap-6">
  <header>
    <h1 id="story-reader-landing-title" class="text-3xl font-bold tracking-tight text-base-content">
      {translate("storyReader.landing.title")}
    </h1>
  </header>

  <StoryPicker
    {storyType}
    labels={{
      search: translate("storyReader.picker.search"),
      loading: translate("storyReader.picker.loading"),
      loadFailed: translate("storyReader.picker.loadFailed"),
      empty: translate("storyReader.picker.empty"),
      noMatch: translate("storyReader.picker.noMatch"),
      open: translate("storyReader.picker.open"),
      backToUnits: translate("storyReader.picker.backToUnits"),
      modeDialogTitle: translate("storyReader.modeDialog.title"),
      textMode: translate("storyReader.modes.textOnly.title"),
      playerMode: translate("storyReader.modes.live2dPlayer.title"),
      rememberChoice: translate("storyReader.modeDialog.remember"),
      cancel: translate("storyReader.modeDialog.cancel")
    }}
  />
</section>
