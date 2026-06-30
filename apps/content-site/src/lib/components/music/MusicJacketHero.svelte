<script lang="ts">
  import { getMusicAssetServer, getMusicJacketAssetURL } from "$lib/assets/index";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import type { MusicDetail } from "$lib/domain/music-detail";
  import type { SupportedRegion } from "$lib/domain/regions";

  let {
    music,
    region,
    availableRegions,
    jacketAltSuffix,
    imageUnavailableLabel,
    closeLabel
  }: {
    music: MusicDetail;
    region: SupportedRegion;
    availableRegions: SupportedRegion[];
    jacketAltSuffix: string;
    imageUnavailableLabel: string;
    closeLabel: string;
  } = $props();

  const jacketUrl = $derived(
    music.assetBundleName
      ? getMusicJacketAssetURL(music.assetBundleName, getMusicAssetServer(region, availableRegions))
      : null
  );

  let previewOpen = $state(false);
</script>

{#if jacketUrl}
  <figure class="relative mx-auto w-full overflow-hidden rounded-2xl shadow-sm">
    <EventAssetImage
      src={jacketUrl}
      alt="{music.title} {jacketAltSuffix}"
      fallbackLabel={imageUnavailableLabel}
      buttonClass="block w-full overflow-hidden"
      imageClass="w-full object-cover aspect-square"
      interactive={true}
      onclick={() => { previewOpen = true; }}
    />
  </figure>

  <ImagePreviewDialog
    bind:open={previewOpen}
    src={jacketUrl}
    alt="{music.title} {jacketAltSuffix}"
    fallbackLabel={imageUnavailableLabel}
    {closeLabel}
    dialogImageClass="h-auto max-h-[88vh] w-auto max-w-full object-contain rounded-2xl"
  />
{/if}
