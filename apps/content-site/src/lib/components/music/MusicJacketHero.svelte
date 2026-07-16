<script lang="ts">
  import { getMusicAssetServer, getMusicJacketAssetURL } from "$lib/assets/index";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import type { MusicDetail } from "$lib/domain/music-detail";
  import type { SupportedRegion } from "$lib/domain/regions";
  import {
    DETAIL_MEDIA_BUTTON_CLASS,
    DETAIL_MEDIA_RADIUS_CLASS
  } from "$lib/styles/detail-media";

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
  <figure
    class={`content-card-inset relative mx-auto aspect-square w-full overflow-hidden ${DETAIL_MEDIA_RADIUS_CLASS}`}
  >
    <AssetImage
      src={jacketUrl}
      alt="{music.title} {jacketAltSuffix}"
      fallbackLabel={imageUnavailableLabel}
      buttonClass={DETAIL_MEDIA_BUTTON_CLASS}
      imageClass={`h-full w-full object-cover ${DETAIL_MEDIA_RADIUS_CLASS}`}
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
