import type { ContentSiteCommonMessages } from "../../types";

const commonEn: ContentSiteCommonMessages = {
  home: "Home",
  darkmode: "Appearance",
  startAt: "Start",
  endAt: "End",
  countdownStartsIn: "Starts In",
  countdownEndsIn: "Ends In",
  eventEnded: "Event Ended",
  idLabel: "#",
  nameLabel: "Name",
  unitLabel: "Unit",
  mixedUnitLabel: "Mixed",
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
  eventListTitle: "Event List",
  eventListEmpty: "No events found.",
  eventListLoadingMore: "Loading more events...",
  eventListLoadMoreHintDesktop: "Scroll down again to load more.",
  eventListLoadMoreHintMobile: "Swipe up again to load more.",
  eventListLoadFailed: "Failed to load events.",
  eventListRetry: "Retry",
  eventListEnd: "No more events.",
  eventListCurrentEvent: "Current Event",
  spoilerContent: "Spoiler Content",
  loadingLanguagePack: "Loading language pack...",
  eventAssetTabs: {
    banner: "Banner",
    title: "Title",
    background: "Background",
    characters: "Characters"
  },
  eventTypeValues: {
    marathon: "Marathon",
    cheerfulCarnival: "Cheerful Carnival",
    worldLink: "World Link"
  },
  eventInfoTitle: "Event Info",
  eventCountdownTitle: "Event Countdown",
  debugEventJsonButton: "Debug JSON",
  debugEventJsonTitle: "Event JSON",
  closeLabel: "Close",
  backToTopLabel: "Back to top",
  settings: {
    title: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    gameContentRegion: "Game Content Region",
    interfaceLanguage: "Interface Language",
    currentLanguage: "Current"
  },
  navigation: {
    sidebarTitle: "Navigation",
    database: "Database",
    cards: "Cards",
    songs: "Songs",
    events: "Events",
    virtualLives: "Virtual Lives"
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
  disclaimer:
    "All game content and assets featured on this site remain the property of their respective copyright holders, including but not limited to SEGA, Colorful Palette, and Crypton Future Media. This is an independent, fan-made research database with no official affiliation with any of the above. Content is provided for informational and educational purposes only.",
  pageTitle: {
    eventPrefix: "Event"
  },
  themeMode: {
    light: "Light",
    dark: "Dark",
    auto: "Auto"
  },
  themeName: {
    default: "Default",
    sakura: "Sakura",
    mint: "Mint"
  },
  versionInfo: {
    title: "Version Info",
    appLabel: "APP",
    dataLabel: "DATA",
    assetLabel: "ASSET"
  }
};

export default commonEn;
