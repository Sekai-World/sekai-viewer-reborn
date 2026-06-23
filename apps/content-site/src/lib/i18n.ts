import { browser } from "$app/environment";
import { PUBLIC_SEKAI_I18N_BASE_URL } from "$env/static/public";
import {
  createScopedI18nLoader,
  createRemoteI18nRuntime,
  type I18nFetcher,
  type I18nMessages,
  type I18nTranslator
} from "@platform/i18n-runtime";
import cardSourceMessages from "@platform/i18n-source/content-site/card.json";
import commonSourceMessages from "@platform/i18n-source/content-site/common.json";
import errorSourceMessages from "@platform/i18n-source/content-site/error.json";
import eventSourceMessages from "@platform/i18n-source/content-site/event.json";
import homeSourceMessages from "@platform/i18n-source/content-site/home.json";
import musicSourceMessages from "@platform/i18n-source/content-site/music.json";
import serverSourceMessages from "@platform/i18n-source/content-site/server.json";
import { repoLocaleByUiLocale, type SupportedUiLocale } from "$lib/i18n-config";
import { normalizeUiLocale } from "$lib/region";

const toRepoLocale = (uiLocale: SupportedUiLocale): string =>
  repoLocaleByUiLocale[uiLocale] ?? "en";

export const contentSiteI18nNamespaces = [
  "common",
  "home",
  "card",
  "event",
  "music",
  "error",
  "server"
] as const;

export type I18nNamespace = (typeof contentSiteI18nNamespaces)[number];
export type ContentSiteTranslator = I18nTranslator;
export type ContentSiteServerMessageKey =
  | "homeEventDataUnavailable"
  | "homeEventDataRequestFailed"
  | "invalidEventId"
  | "eventUnavailableInCurrentRegion"
  | "failedToLoadEventData"
  | "invalidCardId"
  | "cardUnavailableInCurrentRegion"
  | "failedToLoadCardData";

const DEFAULT_SEKAI_I18N_BASE_URL = "https://sekai-world.github.io/sekai-i18n-reborn";
const FALLBACK_UI_LOCALE: SupportedUiLocale = "en";
const LEGACY_COMMON_COMPAT_NAMESPACES = new Set<I18nNamespace>([
  "home",
  "card",
  "event",
  "music",
  "error"
]);
const localSourceMessagesByNamespace: Record<I18nNamespace, I18nMessages> = {
  card: cardSourceMessages,
  common: commonSourceMessages,
  error: errorSourceMessages,
  event: eventSourceMessages,
  home: homeSourceMessages,
  music: musicSourceMessages,
  server: serverSourceMessages
};

const getI18nBaseUrl = (): string => {
  const value = PUBLIC_SEKAI_I18N_BASE_URL?.trim() || DEFAULT_SEKAI_I18N_BASE_URL;
  return value.replace(/\/+$/, "");
};

const i18nRuntime = createRemoteI18nRuntime({
  baseUrl: getI18nBaseUrl(),
  fallbackLocale: "en",
  isBrowser: () => browser,
  normalizeLocale: (localeValue) => normalizeUiLocale(localeValue),
  toRemoteLocale: (localeValue) => toRepoLocale(normalizeUiLocale(localeValue))
});

export const isLocaleLoading = i18nRuntime.isLocaleLoading;

const scopedI18nLoader = createScopedI18nLoader<I18nNamespace>({
  commonNamespace: "common",
  fallbackLocale: FALLBACK_UI_LOCALE,
  legacyCommonCompatNamespaces: LEGACY_COMMON_COMPAT_NAMESPACES,
  localSourceMessagesByNamespace,
  loadRemoteMessages: (localeValue, namespace, fetcher) =>
    i18nRuntime.loadMessages(localeValue, namespace, fetcher),
  normalizeLocale: (localeValue) => normalizeUiLocale(localeValue),
  toRemoteLocale: (localeValue) => toRepoLocale(normalizeUiLocale(localeValue))
});

export const loadI18nMessages = (
  localeValue: string,
  namespace: I18nNamespace,
  fetcher?: I18nFetcher
): Promise<I18nMessages> => scopedI18nLoader.loadMessages(localeValue, namespace, fetcher);

export const loadI18nMessageBundle = (
  localeValue: string,
  namespaces: readonly I18nNamespace[],
  fetcher?: I18nFetcher
): Promise<I18nMessages> => scopedI18nLoader.loadMessageBundle(localeValue, namespaces, fetcher);

export const createI18nTranslator = (
  localeValue: string,
  messages: I18nMessages
): ContentSiteTranslator => i18nRuntime.createTranslator(localeValue, messages);

export const getServerI18nText = async (
  localeValue: string,
  key: ContentSiteServerMessageKey,
  fetcher?: I18nFetcher
): Promise<string> => {
  const messages = await scopedI18nLoader.loadMessages(localeValue, "server", fetcher);
  return messages[key] ?? key;
};

export const setI18nLocale = (
  localeValue: string,
  messages?: I18nMessages
): Promise<SupportedUiLocale> =>
  Promise.resolve(messages ?? scopedI18nLoader.loadMessages(localeValue, "common"))
    .then((resolvedMessages) =>
      i18nRuntime.setLocale(localeValue, scopedI18nLoader.mergeCommonMessages(resolvedMessages))
    )
    .then((locale) => normalizeUiLocale(locale));

export const tCommon = (localeValue: string, key: string, fallback?: string): string =>
  i18nRuntime.translate(localeValue, key, fallback);

export const getThemeModeLabel = (
  localeValue: string,
  themeMode: "light" | "dark" | "auto"
): string => {
  return tCommon(localeValue, `themeMode.${themeMode}`, themeMode);
};
