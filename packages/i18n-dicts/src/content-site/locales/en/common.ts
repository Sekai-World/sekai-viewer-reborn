import type { ContentSiteCommonMessages } from "../../types";

const commonEn: ContentSiteCommonMessages = {
  home: "Home",
  darkmode: "Theme",
  startAt: "Start",
  endAt: "End",
  countdownStartsIn: "Starts In",
  countdownEndsIn: "Ends In",
  eventEnded: "Event Ended",
  idLabel: "ID",
  nameLabel: "Name",
  unitLabel: "Unit",
  eventTypeLabel: "Event Type",
  eventBgmTitle: "Event BGM",
  audioPlayLabel: "Play audio",
  audioPauseLabel: "Pause audio",
  audioDownloadLabel: "Download",
  audioVolumeLabel: "Adjust volume",
  audioSeekLabel: "Seek audio",
  audioUnavailableLabel: "No event BGM available",
  audioDownloadStages: {
    preparing: "Preparing download",
    fetchingAudio: "Downloading audio",
    fetchingCover: "Downloading cover",
    writingMetadata: "Writing metadata",
    finalizing: "Finalizing file",
    ready: "Download ready",
    failed: "Download failed",
    cancelled: "Download cancelled"
  },
  audioDownloadCloseLabel: "Close download dialog",
  bannerAltSuffix: "banner",
  imageUnavailable: "Image unavailable",
  noCurrentEventData: "No current event data.",
  loadingLanguagePack: "Loading language pack...",
  eventAssetTabs: {
    banner: "Banner",
    title: "Title",
    background: "Background",
    characters: "Characters"
  },
  eventInfoTitle: "Event Info",
  debugEventJsonButton: "Debug JSON",
  debugEventJsonTitle: "Event JSON",
  closeLabel: "Close",
  settings: {
    title: "Settings",
    gameContentRegion: "Game Content Region",
    interfaceLanguage: "Interface Language"
  },
  labels: {
    primary: "Primary",
    secondary: "Secondary",
    primarySecondary: "Primary|Secondary",
    timeUnit: {
      day: "Day",
      hour: "Hour",
      minute: "Minute",
      second: "Second"
    }
  },
  aria: {
    switchTheme: "Switch theme mode",
    switchUiLanguageCurrent: "Switch UI language. Current language"
  },
  pageTitle: {
    eventPrefix: "Event"
  },
  themeMode: {
    light: "Light Mode",
    dark: "Dark Mode",
    auto: "Auto"
  }
};

export default commonEn;
