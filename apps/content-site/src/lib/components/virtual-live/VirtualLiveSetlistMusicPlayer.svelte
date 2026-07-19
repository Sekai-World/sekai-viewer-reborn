<script lang="ts">
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { getMusicJacketAssetURL, getMusicLongPreviewAssetURL } from "$lib/assets/index";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { VirtualLiveSetlistMusicDisplay } from "$lib/domain/virtual-live";
  import { AudioPlayer } from "@platform/ui-shell";

  let {
    music,
    region,
    t
  }: {
    music: VirtualLiveSetlistMusicDisplay;
    region: SupportedRegion;
    t: (key: string, fallback?: string) => string;
  } = $props();

  const jacketUrl = $derived(
    music.jacketAssetBundleName
      ? getMusicJacketAssetURL(music.jacketAssetBundleName, music.assetRegion)
      : undefined
  );
  const audioUrl = $derived(
    music.vocal?.assetBundleName
      ? getMusicLongPreviewAssetURL(music.vocal.assetBundleName, music.assetRegion)
      : null
  );
  const vocalType = $derived(
    music.vocal?.vocalType
      ? t(
          `virtualLiveMusicVocalType.${music.vocal.vocalType}`,
          music.vocal.vocalType.replaceAll("_", " ")
        )
      : ""
  );
  const downloadProgressMessages = $derived({
    preparing: t("audioDownloadStages.preparing"),
    fetchingAudio: t("audioDownloadStages.fetchingAudio"),
    fetchingCover: t("audioDownloadStages.fetchingCover"),
    writingMetadata: t("audioDownloadStages.writingMetadata"),
    finalizing: t("audioDownloadStages.finalizing"),
    ready: t("audioDownloadStages.ready"),
    failed: t("audioDownloadStages.failed"),
    cancelled: t("audioDownloadStages.cancelled")
  });
</script>

<div class="grid gap-3 sm:grid-cols-[5rem_minmax(0,1fr)]">
  {#if jacketUrl}
    <img
      src={jacketUrl}
      alt={music.title}
      class="size-20 rounded-xl object-cover shadow-sm"
      loading="lazy"
      decoding="async"
    />
  {/if}
  <div class="min-w-0">
    <a
      href={`/music/${region}/${music.id}`}
      class="text-base font-bold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
      >{music.title}</a
    >
    {#if music.artist || vocalType}
      <p class="mt-0.5 text-xs opacity-65">
        {[music.artist, vocalType].filter(Boolean).join(" · ")}
      </p>
    {/if}
    {#if music.vocal?.characters.length}
      <div class="mt-2 flex flex-wrap gap-1.5">
        {#each music.vocal.characters as performer (performer.characterId)}
          {@const label = `${t("virtualLiveCharacterIdentifierLabel")} #${performer.characterId}`}
          {#if performer.characterId > 0}
            <a
              href={`/character/${region}/${performer.characterId}`}
              class="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={label}
              title={label}
            >
              <CharacterAvatar
                src={getLocalCharacterThumbnailAssetURL(performer.characterId)}
                {label}
                characterId={performer.characterId}
                variant="xs"
                decorative
              />
            </a>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<div class="mt-3 rounded-xl border border-base-content/10 bg-base-100/55 p-3">
  <AudioPlayer
    src={audioUrl}
    title={music.title}
    subtitle={vocalType}
    artist={music.artist ?? ""}
    artworkUrl={jacketUrl}
    offset={music.fillerSec ?? 0}
    {downloadProgressMessages}
    playLabel={t("audioPlayLabel")}
    pauseLabel={t("audioPauseLabel")}
    downloadLabel={t("audioDownloadLabel")}
    downloadCloseLabel={t("audioDownloadCloseLabel")}
    volumeLabel={t("audioVolumeLabel")}
    seekLabel={t("audioSeekLabel")}
    unavailableLabel={t("audioUnavailableLabel")}
  />
</div>
