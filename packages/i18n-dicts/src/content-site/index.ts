import { repoLocaleByUiLocale, supportedUiLocales, type SupportedUiLocale } from "../ui-locales";
import commonEn from "./locales/en/common";
import serverEn from "./locales/en/server";
import commonJaJp from "./locales/ja-JP/common";
import serverJaJp from "./locales/ja-JP/server";
import commonKoKr from "./locales/ko-KR/common";
import serverKoKr from "./locales/ko-KR/server";
import commonZhCn from "./locales/zh-CN/common";
import serverZhCn from "./locales/zh-CN/server";
import commonZhTw from "./locales/zh-TW/common";
import serverZhTw from "./locales/zh-TW/server";
import type {
  ContentSiteCommonMessages,
  ContentSiteServerMessageKey,
  ContentSiteServerMessages
} from "./types";

export type {
  ContentSiteCommonMessages,
  ContentSiteServerMessageKey,
  ContentSiteServerMessages
} from "./types";

export const contentSiteCommonByUiLocale: Record<SupportedUiLocale, ContentSiteCommonMessages> = {
  en: commonEn,
  "ja-JP": commonJaJp,
  "ko-KR": commonKoKr,
  "zh-CN": commonZhCn,
  "zh-TW": commonZhTw
};

export const contentSiteServerByUiLocale: Record<SupportedUiLocale, ContentSiteServerMessages> = {
  en: serverEn,
  "ja-JP": serverJaJp,
  "ko-KR": serverKoKr,
  "zh-CN": serverZhCn,
  "zh-TW": serverZhTw
};

const readKeyPath = (source: unknown, keyPath: string): string | null => {
  const value = keyPath.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }

    return null;
  }, source);

  return typeof value === "string" ? value : null;
};

export const getContentSiteCommonText = (
  locale: SupportedUiLocale,
  keyPath: string,
  fallback = keyPath
): string => {
  return readKeyPath(contentSiteCommonByUiLocale[locale], keyPath) ?? fallback;
};

export const getContentSiteServerText = (
  locale: SupportedUiLocale,
  key: ContentSiteServerMessageKey
): string => {
  return contentSiteServerByUiLocale[locale][key];
};

export const contentSiteCommonByRepoLocale: Record<string, ContentSiteCommonMessages> =
  supportedUiLocales.reduce<Record<string, ContentSiteCommonMessages>>((acc, locale) => {
    const repoLocale = repoLocaleByUiLocale[locale];
    if (!(repoLocale in acc)) {
      acc[repoLocale] = contentSiteCommonByUiLocale[locale];
    }
    return acc;
  }, {});

export const themeModeLabelsByLocale: Record<
  SupportedUiLocale,
  { light: string; dark: string }
> = supportedUiLocales.reduce<Record<SupportedUiLocale, { light: string; dark: string }>>(
  (acc, locale) => {
    acc[locale] = contentSiteCommonByUiLocale[locale].themeMode;
    return acc;
  },
  {} as Record<SupportedUiLocale, { light: string; dark: string }>
);

export const regionRoleLabelsByLocale: Record<
  SupportedUiLocale,
  { primary: string; secondary: string }
> = supportedUiLocales.reduce<Record<SupportedUiLocale, { primary: string; secondary: string }>>(
  (acc, locale) => {
    const labels = contentSiteCommonByUiLocale[locale].labels;
    acc[locale] = { primary: labels.primary, secondary: labels.secondary };
    return acc;
  },
  {} as Record<SupportedUiLocale, { primary: string; secondary: string }>
);

export const primarySecondaryLabelByLocale: Record<SupportedUiLocale, string> =
  supportedUiLocales.reduce<Record<SupportedUiLocale, string>>(
    (acc, locale) => {
      acc[locale] = contentSiteCommonByUiLocale[locale].labels.primarySecondary;
      return acc;
    },
    {} as Record<SupportedUiLocale, string>
  );

export const noEventTextByLocale: Record<SupportedUiLocale, string> =
  supportedUiLocales.reduce<Record<SupportedUiLocale, string>>(
    (acc, locale) => {
      acc[locale] = contentSiteCommonByUiLocale[locale].noCurrentEventData;
      return acc;
    },
    {} as Record<SupportedUiLocale, string>
  );
