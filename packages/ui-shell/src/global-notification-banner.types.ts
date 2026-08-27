export type GlobalNoticeSeverity = "info" | "success" | "warning" | "error";

export type GlobalNoticeAction = {
  label: string;
  href: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
};

export type GlobalNotice = {
  /** Stable notice identity. Change `version` when the same announcement changes. */
  id: string;
  version: string | number;
  severity: GlobalNoticeSeverity;
  title: string;
  message: string;
  action?: GlobalNoticeAction;
  /** Set to false for an announcement that must stay visible. Defaults to true. */
  dismissible?: boolean;
};

export type GlobalNotificationBannerProps = {
  /** Pass an empty array, or omit this prop, when a site has no announcements. */
  notices?: readonly GlobalNotice[];
  /** Local-storage key used for dismissed notice/version pairs. */
  storageKey?: string;
  announcementsLabel?: string;
  dismissLabel?: string;
  severityLabels?: Partial<Record<GlobalNoticeSeverity, string>>;
};
