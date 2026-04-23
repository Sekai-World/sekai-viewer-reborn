export type ContentSiteCommonMessages = {
  home: string;
  darkmode: string;
  startAt: string;
  endAt: string;
  countdownStartsIn: string;
  countdownEndsIn: string;
  eventEnded: string;
  idLabel: string;
  nameLabel: string;
  unitLabel: string;
  mixedUnitLabel: string;
  eventTypeLabel: string;
  eventBgmTitle: string;
  audioPlayLabel: string;
  audioPauseLabel: string;
  audioDownloadLabel: string;
  audioVolumeLabel: string;
  audioSeekLabel: string;
  audioUnavailableLabel: string;
  audioDownloadStages: {
    preparing: string;
    fetchingAudio: string;
    fetchingCover: string;
    writingMetadata: string;
    finalizing: string;
    ready: string;
    failed: string;
    cancelled: string;
  };
  audioDownloadCloseLabel: string;
  bannerAltSuffix: string;
  imageUnavailable: string;
  noCurrentEventData: string;
  eventListTitle: string;
  eventListEmpty: string;
  eventListLoadingMore: string;
  eventListLoadMoreHintDesktop: string;
  eventListLoadMoreHintMobile: string;
  eventListLoadFailed: string;
  eventListRetry: string;
  eventListEnd: string;
  eventListCurrentEvent: string;
  spoilerContent: string;
  loadingLanguagePack: string;
  eventAssetTabs: {
    banner: string;
    title: string;
    background: string;
    characters: string;
  };
  eventTypeValues: {
    marathon: string;
    cheerfulCarnival: string;
    worldLink: string;
  };
  eventInfoTitle: string;
  eventCountdownTitle: string;
  debugEventJsonButton: string;
  debugEventJsonTitle: string;
  closeLabel: string;
  backToTopLabel: string;
  settings: {
    title: string;
    gameContentRegion: string;
    interfaceLanguage: string;
    currentLanguage: string;
  };
  navigation: {
    database: string;
    cards: string;
    songs: string;
    events: string;
    virtualLives: string;
  };
  labels: {
    primary: string;
    secondary: string;
    primarySecondary: string;
    timeUnit: {
      day: string;
      hour: string;
      minute: string;
      second: string;
    };
  };
  aria: {
    switchTheme: string;
    switchUiLanguageCurrent: string;
  };
  pageTitle: {
    eventPrefix: string;
  };
  themeMode: {
    light: string;
    dark: string;
    auto: string;
  };
};

export type ContentSiteServerMessageKey =
  | "homeEventDataUnavailable"
  | "homeEventDataRequestFailed"
  | "invalidEventId"
  | "eventUnavailableInCurrentRegion"
  | "failedToLoadEventData";

export type ContentSiteServerMessages = Record<ContentSiteServerMessageKey, string>;
