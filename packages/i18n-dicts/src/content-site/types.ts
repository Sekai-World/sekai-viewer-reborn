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
  bannerAltSuffix: string;
  noCurrentEventData: string;
  loadingLanguagePack: string;
  eventAssetTabs: {
    banner: string;
    title: string;
    background: string;
    characters: string;
  };
  eventInfoTitle: string;
  debugEventJsonButton: string;
  debugEventJsonTitle: string;
  closeLabel: string;
  settings: {
    title: string;
    gameContentRegion: string;
    interfaceLanguage: string;
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
