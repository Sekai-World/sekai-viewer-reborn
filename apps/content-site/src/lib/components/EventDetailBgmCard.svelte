<script lang="ts">
  import { getEventBgmAssetURL } from "$lib/assets";
  import type { EventDetail } from "$lib/event-detail";
  import type { SupportedRegion } from "$lib/regions";
  import { AudioPlayer } from "@platform/ui-shell";
  import Icon from "@iconify/svelte";

  type DownloadProgressMessages = {
    preparing: string;
    fetchingAudio: string;
    fetchingCover: string;
    writingMetadata: string;
    finalizing: string;
    ready: string;
    failed: string;
    cancelled: string;
  };

  let {
    event,
    region,
    title,
    unitName,
    bgmDownloadHref,
    bgmProgressHref,
    downloadProgressMessages,
    playLabel,
    pauseLabel,
    downloadLabel,
    downloadCloseLabel,
    volumeLabel,
    seekLabel,
    unavailableLabel
  }: {
    event: EventDetail;
    region: SupportedRegion;
    title: string;
    unitName: string;
    bgmDownloadHref: (format: "mp3" | "wav") => string;
    bgmProgressHref: string;
    downloadProgressMessages: DownloadProgressMessages;
    playLabel: string;
    pauseLabel: string;
    downloadLabel: string;
    downloadCloseLabel: string;
    volumeLabel: string;
    seekLabel: string;
    unavailableLabel: string;
  } = $props();

  const getDownloadName = (format: "mp3" | "wav"): string =>
    `${event.id}-${region}-event-bgm.${format}`;
</script>

<article class="card content-card-shell overflow-hidden shadow-sm">
  <div class="card-body gap-4 p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon icon="mdi:music-note-outline" class="size-4 shrink-0" aria-hidden="true" />
      <span>{title}</span>
    </p>
    <div class="content-card-inset rounded-[1.75rem] p-4">
      <AudioPlayer
        src={event.bgmAssetbundleName
          ? getEventBgmAssetURL(event.bgmAssetbundleName, region)
          : null}
        title={event.title}
        subtitle={unitName}
        downloadName={getDownloadName("mp3")}
        downloadOptions={[
          {
            label: "MP3",
            href: bgmDownloadHref("mp3"),
            progressHref: bgmProgressHref,
            downloadName: getDownloadName("mp3")
          },
          {
            label: "WAV",
            href: bgmDownloadHref("wav"),
            progressHref: bgmProgressHref,
            downloadName: getDownloadName("wav")
          }
        ]}
        {downloadProgressMessages}
        {playLabel}
        {pauseLabel}
        {downloadLabel}
        {downloadCloseLabel}
        {volumeLabel}
        {seekLabel}
        {unavailableLabel}
      />
    </div>
  </div>
</article>
